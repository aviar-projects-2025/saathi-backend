import mongoose from 'mongoose'

const savePost = mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    }
})

const SavedPost = mongoose.model('SavedPost', savePost)

export default SavedPost;