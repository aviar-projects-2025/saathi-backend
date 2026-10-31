import mongoose from "mongoose";
import Chat from "./chat.model.js";
import Message from "./message.model.js";
import User from "../model/user.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js"; // <-- ADDED
import {
  getBlockStatusService,
  listMutuallyBlockedIdsService,
} from "./block.service.js";

const DELETE_FOR_EVERYONE_WINDOW_MS = 15 * 60 * 1000;

const createParticipantKey = (userId1, userId2) =>
  [String(userId1), String(userId2)].sort().join("_");

/* ─── Helper: sign profile images ─── */
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;
  const userData = typeof user.toObject === "function" ? user.toObject() : { ...user };
  if (!userData.profileImage) {
    return { ...userData, profileImageUrl: null };
  }
  try {
    console.log("Signing image for:", userData.firstName, "Key:", userData.profileImage); // <-- ADD THIS
    const url = await getProfileImageSignedUrl(userData.profileImage);
    console.log("Success! Signed URL:", url); // <-- ADD THIS
    return {
      ...userData,
      profileImageUrl: url,
    };
  } catch (error) {
    console.error("🔥 SIGNING FAILED for:", userData.profileImage, "Error:", error.message); // <-- ADD THIS
    return { ...userData, profileImageUrl: null };
  }
};

const formatChat = async (chat) => {
  if (!chat) return chat;
  const chatData = typeof chat.toObject === "function" ? chat.toObject() : { ...chat };
  
  if (chatData.participants && Array.isArray(chatData.participants)) {
    chatData.participants = await Promise.all(
      chatData.participants.map(addProfileImageUrl)
    );
  }
  
  if (chatData.lastMessage && chatData.lastMessage.senderId) {
    chatData.lastMessage.senderId = await addProfileImageUrl(chatData.lastMessage.senderId);
  }
  return chatData;
};

/* ─────────── Get or create ─────────── */
export const getOrCreateChatService = async ({
  currentUserId,
  otherUserId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw new Error("Invalid user ID");
  }
  if (String(currentUserId) === String(otherUserId)) {
    throw new Error("You cannot chat with yourself");
  }

  const status = await getBlockStatusService({
    userId: currentUserId,
    otherUserId,
  });
  if (status.isBlocked) {
    throw new Error(
      status.blockedByMe
        ? "You have blocked this user. Unblock to message."
        : "You cannot message this user."
    );
  }

  const participantKey = createParticipantKey(currentUserId, otherUserId);

  let chat = await Chat.findOne({ participantKey })
    .populate("participants", "firstName lastName profileImage")
    .populate("lastMessage");

  if (!chat) {
    chat = await Chat.create({
      participants: [currentUserId, otherUserId],
      participantKey,
    });
    chat = await Chat.findById(chat._id)
      .populate("participants", "firstName lastName profileImage")
      .populate("lastMessage");
  }

  if (chat.hiddenFor?.some((id) => String(id) === String(currentUserId))) {
    await Chat.updateOne(
      { _id: chat._id },
      { $pull: { hiddenFor: currentUserId } }
    );
  }

  return await formatChat(chat);
};

/* ─────────── Get all conversations ─────────── */
export const getUserChatsService = async (userId) => {
  const blockedIds = await listMutuallyBlockedIdsService(userId);
  const blockedArr = [...blockedIds].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const chats = await Chat.find({
    participants: userId,
    hiddenFor: { $ne: userId },
    participants: { $nin: blockedArr, $in: [userId] },
  })
    .populate("participants", "firstName lastName profileImage")
    .populate(
      "lastMessage",
      "senderId receiverId text messageType status createdAt deletedForEveryone deletedFor"
    )
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  return await Promise.all(chats.map(formatChat));
};

/* ─────────── Get messages ─────────── */
export const getChatMessagesService = async ({
  chatId,
  userId,
  page = 1,
  limit = 30,
}) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  const chat = await Chat.findOne({ _id: chatId, participants: userId });
  if (!chat) throw new Error("Chat not found or access denied");

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;

  const baseFilter = {
    chatId,
    deletedFor: { $ne: userId },
  };

  const [messages, totalMessages] = await Promise.all([
    Message.find(baseFilter)
      .populate("senderId", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    Message.countDocuments(baseFilter),
  ]);

  // Convert tombstones AND sign images
  const sanitized = await Promise.all(messages.reverse().map(async (m) => {
    m.senderId = await addProfileImageUrl(m.senderId);
    
    if (m.deletedForEveryone) {
      return {
        ...m,
        text: "",
        messageType: "TEXT",
        tombstone: true,
      };
    }
    return m;
  }));

  return {
    messages: sanitized,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total: totalMessages,
      hasMore: skip + messages.length < totalMessages,
    },
  };
};

/* ─────────── Send message ─────────── */
export const sendMessageService = async ({ chatId, senderId, text }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  const cleanText = text?.trim();
  if (!cleanText) throw new Error("Message cannot be empty");

  const chat = await Chat.findOne({ _id: chatId, participants: senderId });
  if (!chat) throw new Error("Chat not found or access denied");

  const receiverId = chat.participants.find(
    (p) => String(p) !== String(senderId)
  );
  if (!receiverId) throw new Error("Receiver not found");

  const status = await getBlockStatusService({
    userId: senderId,
    otherUserId: receiverId,
  });
  if (status.isBlocked) {
    throw new Error(
      status.blockedByMe
        ? "You have blocked this user. Unblock to send messages."
        : "You cannot send messages to this user."
    );
  }

  const message = await Message.create({
    chatId,
    senderId,
    receiverId,
    text: cleanText,
    messageType: "TEXT",
    status: "SENT",
  });

  await Chat.findByIdAndUpdate(chatId, {
    lastMessage: message._id,
    lastMessageAt: message.createdAt,
    $pull: { hiddenFor: { $in: chat.participants } },
  });

  const populatedMessage = await Message.findById(message._id)
    .populate("senderId", "firstName lastName profileImage")
    .lean();
    
  populatedMessage.senderId = await addProfileImageUrl(populatedMessage.senderId);

  return populatedMessage;
};

/* ─────────── Mark read ─────────── */
export const markChatMessagesAsReadService = async ({ chatId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  const chat = await Chat.findOne({ _id: chatId, participants: userId });
  if (!chat) throw new Error("Chat not found or access denied");

  const result = await Message.updateMany(
    { chatId, receiverId: userId, status: { $ne: "READ" } },
    { $set: { status: "READ", readAt: new Date() } }
  );

  return { modifiedCount: result.modifiedCount };
};

/* ─────────── List all chattable users + existing chats ─────────── */
export const listChattableUsersService = async ({
  userId,
  search = "",
  page = 1,
  limit = 20,
}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (pageNumber - 1) * limitNumber;

  const blockedIds = await listMutuallyBlockedIdsService(userId);
  const blockedArr = [...blockedIds].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const userFilter = {
    _id: { $ne: userObjectId, $nin: blockedArr },
  };

  if (search.trim()) {
    const rx = new RegExp(search.trim(), "i");
    userFilter.$or = [
      { firstName: rx },
      { lastName: rx },
      { $expr: { $regexMatch: { input: { $concat: ["$firstName", " ", "$lastName"] }, regex: rx } } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(userFilter)
      .select("firstName lastName profileImage")
      .sort({ firstName: 1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    User.countDocuments(userFilter),
  ]);

  const chats = await Chat.find({
    participants: userObjectId,
    hiddenFor: { $ne: userObjectId },
  })
    .populate("lastMessage")
    .lean();

  const chatByOtherUserId = {};
  chats.forEach((c) => {
    const other = c.participants.find(
      (p) => String(p) !== String(userObjectId)
    );
    if (other) chatByOtherUserId[String(other)] = c;
  });

  const enriched = await Promise.all(users.map(async (u) => {
    const chat = chatByOtherUserId[String(u._id)];
    const last = chat?.lastMessage;
    const signedUser = await addProfileImageUrl(u);

    return {
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImage: u.profileImage,
      profileImageUrl: signedUser.profileImageUrl, // <-- ADDED SIGNED URL
      lastMessage: last?.deletedForEveryone
        ? "This message was deleted"
        : last?.text || null,
      lastMessageAt: chat?.lastMessageAt || null,
      chatId: chat?._id || null,
      isBlockedByMe: false,
    };
  }));

  enriched.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (aTime && bTime) return bTime - aTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return (a.firstName || "").localeCompare(b.firstName || "");
  });

  return {
    users: enriched,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      hasMore: skip + users.length < total,
    },
  };
};

/* ─────────── Delete a message ─────────── */
export const deleteMessageService = async ({
  messageId,
  userId,
  scope = "me",
}) => {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new Error("Invalid message ID");
  }
  if (!["me", "everyone"].includes(scope)) {
    throw new Error("Invalid scope");
  }

  const message = await Message.findById(messageId);
  if (!message) throw new Error("Message not found");

  const chat = await Chat.findOne({
    _id: message.chatId,
    participants: userId,
  });
  if (!chat) throw new Error("You are not a participant in this chat");

  if (scope === "me") {
    if (!message.deletedFor.some((id) => String(id) === String(userId))) {
      message.deletedFor.push(userId);
      await message.save();
    }
    return {
      messageId: message._id,
      chatId: message.chatId,
      scope: "me",
    };
  }

  if (String(message.senderId) !== String(userId)) {
    throw new Error("Only the sender can delete for everyone");
  }
  const ageMs = Date.now() - new Date(message.createdAt).getTime();
  if (ageMs > DELETE_FOR_EVERYONE_WINDOW_MS) {
    throw new Error("Delete-for-everyone window (15 min) has expired");
  }
  if (message.deletedForEveryone) {
    return {
      messageId: message._id,
      chatId: message.chatId,
      scope: "everyone",
    };
  }

  message.deletedForEveryone = true;
  message.deletedAt = new Date();
  message.text = "";
  await message.save();

  return {
    messageId: message._id,
    chatId: message.chatId,
    scope: "everyone",
  };
};

/* ─────────── Hide chat from my list ─────────── */
export const hideChatForUserService = async ({ chatId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  const chat = await Chat.findOne({ _id: chatId, participants: userId });
  if (!chat) throw new Error("Chat not found or access denied");

  await Chat.updateOne(
    { _id: chatId },
    { $addToSet: { hiddenFor: userId } }
  );

  return { chatId };
};