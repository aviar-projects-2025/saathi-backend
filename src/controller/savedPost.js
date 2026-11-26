import mongoose from "mongoose";
import SavedPost from "../model/communitySaved.js";
import Community from "../model/community.js";
import { getProfileImageSignedUrl } from "./s3Controller.js";

const signPostImage = async (keyOrArray) => {
  if (!keyOrArray) return null;
  const first = Array.isArray(keyOrArray) ? keyOrArray[0] : keyOrArray;
  if (!first || typeof first !== "string") return null;
  if (first.startsWith("http://") || first.startsWith("https://")) return first;
  try {
    return await getProfileImageSignedUrl(first);
  } catch (err) {
    console.error("[savedPost] Failed to sign post image:", err.message);
    return null;
  }
};

const normalizePost = async (post) => {
  if (!post) return null;
  const data = typeof post.toObject === "function" ? post.toObject() : { ...post };
  const postImageUrl = await signPostImage(data.postImage);
  return { ...data, postImageUrl };
};

export const savePost = async (req, res) => {
  try {
    const { postId, userId } = req.params;
    if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid post or user id." });
    }
    
    const postExists = await Community.exists({ _id: postId });
    if (!postExists) return res.status(404).json({ status: false, message: "Post not found." });

    const existing = await SavedPost.findOne({ postId, userId });
    if (existing) {
      return res.status(200).json({ status: true, message: "Post already saved.", data: existing, alreadySaved: true });
    }
    
    const saved = await SavedPost.create({ postId, userId });
    return res.status(201).json({ status: true, message: "Post saved!", data: saved });
    
  } catch (error) {
    if (error?.code === 11000) {
      const { postId, userId } = req.params;
      const existing = await SavedPost.findOne({ postId, userId });
      return res.status(200).json({ status: true, message: "Post already saved.", data: existing, alreadySaved: true });
    }
    console.error("savePost error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getSavedPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid user id." });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const totalPosts = await SavedPost.countDocuments({ userId });
    const rows = await SavedPost.find({ userId })
      .populate("postId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const savedPosts = await Promise.all(
      rows
        .filter((row) => row.postId)
        .map(async (row) => {
          const normalized = await normalizePost(row.postId);
          return {
            ...normalized,
            _id: row.postId._id,
            savedAt: row.createdAt,
            savedRecordId: row._id,
            isSaved: true,
          };
        })
    );
    const totalPages = Math.ceil(totalPosts / limit);

    return res.status(200).json({
      status: true,
      savedPosts,
      totalCount: totalPosts,
      page,
      limit,
      hasMore: skip + savedPosts.length < totalPosts,
      pagination: { currentPage: page, limit, totalPosts, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    });
  } catch (error) {
    console.error("getSavedPosts error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getPostById = getSavedPosts;

export const removeSavedPost = async (req, res) => {
  try {
    const { postId, userId } = req.params;
    if (!mongoose.isValidObjectId(postId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ status: false, message: "Invalid post or user id." });
    }
    const removed = await SavedPost.findOneAndDelete({ postId, userId });
    
    if (!removed) {
      return res.status(404).json({ status: false, message: "Post was not saved." });
    }
    
    return res.status(200).json({ status: true, message: "Post unsaved." });
  } catch (error) {
    console.error("removeSavedPost error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};