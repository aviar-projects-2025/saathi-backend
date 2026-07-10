import express from 'express'
import {
    deleteComment,
    editComment,
    getComments,
    postComment,
    postReplyComment,
} from "../controller/comments.js"


const router = express.Router();

router.get("/:postId/", getComments);
router.post("/:postId/:userId", postComment);
router.post("/:postId/reply/:parentId/:userId", postReplyComment);
router.patch("/:commentId/:userId", editComment);
router.delete("/:commentId/:userId", deleteComment);

export default router