import SavedPost from "../model/communitySaved.js";


export const savePost = async (req, res) => {
    try {
        const { postId, userId } = req.params;

        // prevent duplicate save
        const alreadySaved = await SavedPost.findOne({ postId, userId });

        if (alreadySaved) {
            return res.status(400).json({
                status: false,
                message: "Post already saved"
            });
        }

        const saved = await SavedPost.create({ postId, userId });

        res.status(201).json({
            status: true,
            message: "Post Saved!",
            data: saved
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

export const getPostById = async (req, res) => {
    try {
        const { userId } = req.params;

        const savedPosts = await SavedPost.find({ userId }).populate("postId");

        res.status(200).json({
            status: true,
            savedPosts
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

export const removeSavedPost = async (req, res) => {
    try {
        const { postId, userId } = req.params;

        await SavedPost.findOneAndDelete({ postId, userId });

        res.status(200).json({
            status: true,
            message: "Post unsaved"
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        });
    }
};
