import express from "express";
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from "./block.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, listBlockedUsers);
router.post("/:userId", verifyToken, blockUser);
router.delete("/:userId", verifyToken, unblockUser);

export default router;