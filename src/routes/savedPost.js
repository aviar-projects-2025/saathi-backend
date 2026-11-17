import express from "express";
import {
  savePost,
  getSavedPosts,
  getPostById, // backward-compat alias
  removeSavedPost,
} from "../controller/savedPost.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
// router.use(verifyToken);

router.post("/:postId/:userId", savePost);
router.get("/:userId", getSavedPosts);
router.delete("/:postId/:userId", removeSavedPost);

export default router;