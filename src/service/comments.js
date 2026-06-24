import Comments from '../model/comments.js'

export const postCommentService = async (postId, userId, comment) => {
    const payload = {
        postId,
        userId,
        comment,
    }

    console.log(payload)
    const postComment = await Comments.create(payload)
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
    const postComment = await Comments.create(payload)
    console.log(postComment)

    return {
        postComment,
        message: "Comment posted",
    }
}

export const getCommentService = async (postId) => {
    const comments = await Comments.find({ postId }).populate("userId", "firstName lastName").sort({ createdAt: -1 });;
    console.log(comments, 'comments')
    return {
        comments,
        message: "Comments fetched"
    }
}

export const editCommentService = (postId, userId) => {

}

export const deleteCommentService = (postId, userId) => {

}