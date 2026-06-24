import Comment from "../model/comments.js";
import Like from "../model/likes.js";
import {
    postCommentService,
    getCommentService,
    editCommentService,
    deleteCommentService,
    replyCommentService
} from "../service/comments.js"

export const postComment = async (req, res) => {
    try {
        const { postId, userId } = req.params
        const body = req.body
        const data = await postCommentService(postId, userId, body.comment);
        res.status(201).json({
            status: true,
            data: data,
            message: "Comment posted"
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Comment failed to post"
        })
    }
}

export const postReplyComment = async (req, res) => {
    try {
        const { postId, parentId, userId } = req.params
        const body = req.body
        console.log(body, 'body 11')
        const data = await replyCommentService(postId, parentId, userId, body.reply);
        res.status(201).json({
            status: true,
            data: data,
            message: "Reply Comment posted"
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Comment failed to post"
        })
    }
}

export const getComments = async (req, res) => {
    try {
        const { postId } = req.params
        const data = await getCommentService(postId);
        res.status(201).json({
            status: true,
            data: data,
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Comment failed to fetch"
        })
    }
}

export const editComment = async (req, res) => {
    try {
        const { postId, userId } = req.params
        const body = req.body
        const data = await editCommentService(postId, userId, body);
        res.status(201).json({
            status: true,
            data: data,
            message: "Comment edited"
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Comment failed to edit"
        })
    }
}

export const deleteComment = async (req, res) => {
    try {
        const { postId, userId } = req.params
        const deleteData = await deleteCommentService(postId, userId);
        res.status(201).json({
            status: true,
            data: deleteData,
            message: "Comment deleted"
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "Comment failed to delete"
        })
    }
}

export const likeComment = async (req, res) => {
    try {
        const { commentId, userId } = req.params;

        const existingLike = await Like.findOne({ commentId, userId });

        if (existingLike) {
            await Like.deleteOne({ _id: existingLike._id });

            const updatedComment = await Comment.findByIdAndUpdate(
                commentId,
                { $inc: { likes: -1 } },
                { new: true }
            );

            return res.json({
                success: true,
                liked: false,
                likes: updatedComment.likes,
                message: "Comment unliked",
            });
        }

        await Like.create({
            commentId,
            userId,
        });

        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { likes: 1 } },
            { new: true }
        );

        return res.json({
            success: true,
            liked: true,
            likes: updatedComment.likes,
            message: "Comment liked",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};