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

        // Pagination values
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const skip = (page - 1) * limit;

        // Total saved posts
        const totalPosts = await SavedPost.countDocuments({ userId });

        // Get paginated saved posts
        const savedPosts = await SavedPost.find({ userId })
            .populate("postId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalPosts / limit);

        res.status(200).json({
            status: true,
            savedPosts,

            pagination: {
                currentPage: page,
                limit,
                totalPosts,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
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
