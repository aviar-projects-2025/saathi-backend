import supabase from "../../config/supabase.js";
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

        const { data, error } = await supabase
            .from("saved_posts")
            .select(`
                id,
                user_id,
                post_id,
                created_at,
                community_posts (
                    id,
                    post_image,
                    description,
                    author_id,
                    likes,
                    community_img_public_id,
                    created_at,
                    updated_at
                )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        return res.status(200).json({
            status: true,
            savedPosts: data
        });

    } catch (error) {
        console.error("Get saved posts error:", error);

        return res.status(500).json({
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
