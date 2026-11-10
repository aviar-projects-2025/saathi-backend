import cloudinary from "../../config/cloudinary.js";
import streamifier from "streamifier";
import {
  createPostService,
  getPostsService,
  deletePostService,
  editPostService,
  getProfilePostsService,
} from "../service/community.js";
import {
  getLikedPostService,
  likePostService,
  unlikePostService,
} from "../service/likes.js";
import { getProfileImageSignedUrl } from "./s3Controller.js";

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "saathi-posts", resource_type: "image" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const withSignedPostImage = async (post) => {
  if (!post) return post;
  const plain = typeof post.toObject === "function" ? post.toObject() : { ...post };
  let postImageUrl = null;
  if (plain.postImage) {
    try {
      postImageUrl = await getProfileImageSignedUrl(plain.postImage);
    } catch (error) {
      console.error("Failed to sign post image URL:", error.message);
    }
  }
  return { ...plain, postImageUrl };
};

export const editPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, description, title } = req.body;

    let imageKey = req.body.postImage || "";
    let communityImgPublicId = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageKey = result.secure_url;
      communityImgPublicId = result.public_id;
    }

    const post = await editPostService(
      postId,
      userId,
      { description, title },
      imageKey,
      communityImgPublicId
    );
    const signedPost = await withSignedPostImage(post);

    return res.status(200).json({
      success: true,
      data: signedPost,
      message: "Post updated successfully",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    const result = await deletePostService(postId, userId);

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    let postImage = req.body.postImage || "";
    let communityImgPublicId = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      postImage = result.secure_url;
      communityImgPublicId = result.public_id;
    }

    const data = { ...req.body, postImage, communityImgPublicId };
    const post = await createPostService(data);
    const signedPost = await withSignedPostImage(post);

    res.status(201).json({ success: true, data: signedPost, message: "Posted Successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ─── Get feed (rooms + sub-categories) ─── */
export const getPosts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const room = req.query.room || "all";
    const subCategory = req.query.subCategory || "all"; // was missing before

    const result = await getPostsService(page, limit, room, subCategory);

    res.status(200).json({
      success: true,
      data: result.posts,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get community posts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPostedImage = async (req, res) => {
  const { userId } = req.params;
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const result = await getProfilePostsService(userId, page, limit);

    return res.status(200).json({
      success: true,
      data: result.posts,
      pagination: {
        currentPage: result.pagination.page,
        limit: result.pagination.limit,
        totalCount: result.pagination.total,
        hasMore: result.pagination.hasMore,
        totalPages: Math.ceil(result.pagination.total / result.pagination.limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const likePost = async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const result = await likePostService(postId, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const unlikePost = async (req, res) => {
  try {
    const { postId, userId } = req.params;
    const result = await unlikePostService(postId, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getLikedPost = async (req, res) => {
  try {
    const { userId } = req.params;
    const likedPostIds = await getLikedPostService(userId);
    return res.status(200).json({ success: true, data: likedPostIds });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
