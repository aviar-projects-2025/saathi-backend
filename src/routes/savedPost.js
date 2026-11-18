import express from "express";
import {
  savePost,
  getSavedPosts,
  getPostById, // backward-compat alias
  removeSavedPost,
} from "../controller/savedPost.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/:postId/:userId", verifyToken, savePost);
router.get("/:userId",verifyToken, getSavedPosts);
router.delete("/:postId/:userId",verifyToken, removeSavedPost);

export default router;

