import cloudinary from "../../config/cloudinary.js";
import streamifier from 'streamifier'
import { createPostService, getPostsService, deletePostService, editPostService } from "../service/community.js";
import { getLikedPostService, likePostService, unlikePostService } from "../service/likes.js";
import Community from "../model/community.js";

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "saathi-posts",
                resource_type: "image",
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};

export const editPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, description } = req.body;

        let imageUrl = "";
        let communityImgPublicId = "";

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            imageUrl = result.secure_url;
            communityImgPublicId = result.public_id;
        }

        const post = await editPostService(
            postId,
            userId,
            description,
            imageUrl,
            communityImgPublicId
        );

        return res.status(200).json({
            success: true,
            data: post,
            message: "Post updated successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
export const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        const result = await deletePostService(postId, userId);

        return res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message,
        });
    }
};

export const createPost = async (req, res) => {
    try {

        let imageUrl = "";
        let communityImgPublicId = "";


        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            imageUrl = result.secure_url;
            communityImgPublicId = result.public_id;
        }

        const data = {
            ...req.body,
            postImage: imageUrl,
            communityImgPublicId,
        };

        const post = await createPostService(data);
        res.status(201).json({
            success: true,
            data: post,
            message: 'Posted Successfully'
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const getPosts = async (req, res) => {
  try {
    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Number(req.query.limit) || 10,
      50
    );

    const result = await getPostsService(page, limit);

    res.status(200).json({
      success: true,
      data: result.posts,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error("Get community posts error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const likePost = async (req, res) => {
    try {
        const { postId, userId } = req.params;

        const result = await likePostService(postId, userId);

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const unlikePost = async (req, res) => {
    try {
        const { postId, userId } = req.params;

        const result = await unlikePostService(postId, userId);

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const getLikedPost = async (req, res) => {
    try {
        const { userId } = req.params;

        const likedPostIds = await getLikedPostService(userId);

        return res.status(200).json({
            success: true,
            data: likedPostIds,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


