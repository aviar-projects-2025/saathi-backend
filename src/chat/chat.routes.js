import express from "express";

import {
  getOrCreateChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  markChatMessagesAsRead,
  listChattableUsers,
  deleteMessage,
  hideChat,
} from "./chat.controller.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/with/:userId",
  verifyToken,
  getOrCreateChat
);

router.get(
  "/",
  verifyToken,
  getUserChats
);

router.get(
  "/:chatId/messages",
  verifyToken,
  getChatMessages
);

router.post(
  "/:chatId/messages",
  verifyToken,
  sendMessage
);

router.patch(
  "/:chatId/read",
  verifyToken,
  markChatMessagesAsRead
);

router.get("/users", verifyToken, listChattableUsers);
router.delete("/:chatId/messages/:messageId", verifyToken, deleteMessage);
router.delete("/:chatId", verifyToken, hideChat);

export default router;