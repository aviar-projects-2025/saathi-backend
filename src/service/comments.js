import Comment from '../model/comments.js'

export const postCommentService = async (postId, userId, comment) => {
    const payload = {
        postId,
        userId,
        comment,
    }

    console.log(payload)
    const postComment = await Comment.create(payload)
    return {
        postComment,
        message: "Comment posted",
    }
}

export const replyCommentService = async (postId, parentId, userId, comment) => {
    const payload = {
        postId,
        parentCommentId : parentId,
        userId,
        comment,
    }
    console.log(payload)
    const postComment = await Comment.create(payload)
    console.log(postComment)

    return {
        postComment,
        message: "Comment posted",
    }
}

export const getCommentService = async (postId) => {
    const comments = await Comment.find({ postId }).populate("userId", "firstName lastName profileImage").sort({ createdAt: -1 });;
    console.log(comments, 'comments')
    return {
        comments,
        message: "Comments fetched"
    }
}

export const editCommentService = async (commentId, userId, body) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  // Check ownership
  if (comment.userId.toString() !== userId) {
    throw new Error("You are not authorized to edit this comment");
  }

  comment.comment = body.comment;

  await comment.save();

  return comment;
};

export const deleteCommentService = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  // Only the owner can delete
  if (comment.userId.toString() !== userId) {
    throw new Error("You are not authorized to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);

  return comment;
};