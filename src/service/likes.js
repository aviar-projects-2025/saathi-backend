import Community from "../model/community.js";
import Like from "../model/likes.js";


export const likePostService = async (postId, userId) => {
    const existingLike = await Like.findOne({ postId, userId });

    if (existingLike) {
        const community = await Community.findById(postId);
        return {
            isLiked: true,
            likesCount: community.likes,
            message: "Already liked",
        };
    }

    await Like.create({ postId, userId });

    const community = await Community.findByIdAndUpdate(
        postId,
        { $inc: { likes: 1 } },
        { new: true }
    );

    return {
        isLiked: true,
        likesCount: community.likes,
        message: "Post liked successfully",
    };
};


export const unlikePostService = async (postId, userId) => {
    const deletedLike = await Like.findOneAndDelete({ postId, userId });

    if (!deletedLike) {
        throw new Error("Like not found");
    }

    await Community.findByIdAndUpdate(postId, {
        $inc: { likes: -1 },
    });
    const community = await Community.findById(postId);

    return {
        isLiked: false,
        likesCount: community.likes,
        message: "Post unliked successfully",
    };
};


export const getLikedPostService = async (userId) => {
    const likedPosts = await Like.find({ userId }).select("postId");

    return likedPosts.map((like) => like?.postId?.toString());
};