import mongoose from "mongoose";

const communitySchema = new mongoose.Schema({
    postImage: {
        type: String,
    },

    description: {
        type: String,
        required: true,
    },

    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],

    comments: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            comment: {
                type: String,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
}, {
    timestamps: true,
});

const Community = mongoose.model("Community", communitySchema);

export default Community;