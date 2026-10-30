import {
  blockUserService,
  unblockUserService,
  listBlockedByMeService,
} from "./block.service.js";
import Chat from "./chat.model.js";
import { getIO } from "../../socket.js";

export const blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id || req.user.userId;
    const { userId } = req.params;

    const block = await blockUserService({ blockerId, blockedId: userId });

    // Notify both users in realtime
    const io = getIO();
    io.to(String(blockerId)).emit("chat:blocked", {
      blockedId: String(userId),
      blockedByMe: true,
    });
    io.to(String(userId)).emit("chat:blocked", {
      blockedId: String(blockerId),
      blockedByMe: false,
    });

    return res.status(200).json({
      success: true,
      message: "User blocked",
      data: { _id: block._id, blockedId: block.blockedId },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.id || req.user.userId;
    const { userId } = req.params;

    const result = await unblockUserService({
      blockerId,
      blockedId: userId,
    });

    const io = getIO();
    io.to(String(blockerId)).emit("chat:unblocked", {
      unblockedId: String(userId),
    });
    io.to(String(userId)).emit("chat:unblocked", {
      unblockedBy: String(blockerId),
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const listBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const users = await listBlockedByMeService(userId);
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};