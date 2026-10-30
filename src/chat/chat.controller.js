import {
  getOrCreateChatService,
  getUserChatsService,
  getChatMessagesService,
  sendMessageService,
  markChatMessagesAsReadService,
  listChattableUsersService,   // ADD
  deleteMessageService,        // ADD
  hideChatForUserService,
} from "./chat.service.js";
import { getIO } from "../../socket.js";

/**
 * Create or get a 1-to-1 chat
 */
export const getOrCreateChat = async (req, res) => {
  try {
    console.log("Decoded JWT payload:", req.user);

    const currentUserId = req.user?.id || req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user ID is missing from token",
      });
    }
    const { userId } = req.params;


    console.log(currentUserId, 'currentUserId')
    console.log(userId, 'userId')

    const chat = await getOrCreateChatService({
      currentUserId,
      otherUserId: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Chat retrieved successfully",
      data: chat,
    });
  } catch (error) {
    console.error("getOrCreateChat error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to get chat",
    });
  }
};

/**
 * Get all conversations of logged-in user
 */
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id || req.user?.userId;

    const chats = await getUserChatsService(userId);

    return res.status(200).json({
      success: true,
      message: "Chats retrieved successfully",
      data: chats,
    });
  } catch (error) {
    console.error("getUserChats error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get chats",
    });
  }
};

/**
 * Get messages of a chat
 */
export const getChatMessages = async (req, res) => {
  try {
    const userId = req.user.id || req.user?.userId;
    const { chatId } = req.params;

    const { page = 1, limit = 30 } = req.query;

    const result = await getChatMessagesService({
      chatId,
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("getChatMessages error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to get messages",
    });
  }
};


/**
 * Send a message
 */
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id || req.user.userId;
    const { chatId } = req.params;
    const { text } = req.body;

    const message = await sendMessageService({ chatId, senderId, text });

    const io = getIO();
    io.to(String(senderId)).emit("chat:message", message);
    if (message.receiverId) {
      io.to(String(message.receiverId._id || message.receiverId)).emit(
        "chat:message",
        message
      );
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Mark messages as read
 */
export const markChatMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user?.userId;
    const { chatId } = req.params;

    const result = await markChatMessagesAsReadService({
      chatId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      data: result,
    });
  } catch (error) {
    console.error(
      "markChatMessagesAsRead error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to mark messages as read",
    });
  }
};


export const listChattableUsers = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { search = "", page = 1, limit = 20 } = req.query;

    const result = await listChattableUsersService({
      userId,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { messageId } = req.params;
    const scope = req.query.scope === "everyone" ? "everyone" : "me";

    const result = await deleteMessageService({
      messageId,
      userId,
      scope,
    });

    // Emit to both participants
    const io = getIO();
    const chat = await Chat.findById(result.chatId).lean();
    if (chat) {
      chat.participants.forEach((pid) => {
        io.to(String(pid)).emit("chat:message:deleted", result);
      });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const hideChat = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { chatId } = req.params;

    const result = await hideChatForUserService({ chatId, userId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};