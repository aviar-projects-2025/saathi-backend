import express from "express";
import { likePost, unlikePost, getLikedPost } from "../controller/community.js";

const router = express.Router();

router.post("/:postId/:userId", likePost);
router.get("/liked-posts/:userId", getLikedPost)
router.delete("/:postId/:userId", unlikePost);

export default router;