import express from "express";
import { likePost, unlikePost, getLikedPost} from "../controller/community.js";
import { likeComment } from "../controller/comments.js";

const router = express.Router();

router.post("/:postId/:userId", likePost);
router.get("/liked-posts/:userId", getLikedPost)
router.delete("/:postId/:userId", unlikePost);
router.post("/comment/:commentId/:userId", likeComment);

export default router;