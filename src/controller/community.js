import {
  createPostService,
  getPostsService,
  deletePostService,
  editPostService,
  getProfilePostsService,
  removeSavesForPostService,
} from "../service/community.js";
import {
  getLikedPostService,
  likePostService,
  unlikePostService,
} from "../service/likes.js";
import { getProfileImageSignedUrl } from "./s3Controller.js";

/* ─── Edit ─── */
export const editPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId, description, title, when } = req.body;

    // ★ The front end already uploaded the image to S3 and sends the KEY.
    //   No req.file, no server-side upload, no Cloudinary.
    const imageKey = req.body.postImage || "";

    const post = await editPostService(
      postId,
      userId,
      { description, title, when },
      imageKey
    );

    return res.status(200).json({
      success: true,
      data: post,   // already populated + signed by the service
      message: "Post updated successfully",
    });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

/* ─── Delete ─── */
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthenticated" });
    }

    const result = await deletePostService(postId, userId);

    try {
      const { deletedCount } = await removeSavesForPostService(postId);
      if (deletedCount > 0) {
        console.log(`[deletePost] removed ${deletedCount} saved record(s) for post ${postId}`);
      }
    } catch (cleanupErr) {
      console.error("[deletePost] saved-post cleanup failed", {
        postId,
        userId,
        error: cleanupErr?.message,
      });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

/* ─── Create — accepts a pre-uploaded S3 key ─── */
export const createPost = async (req, res) => {
  try {
    const data = { ...req.body };

    // ★ If the client sent an S3 key (from uploadImageToS3), use it directly.
    const imageKey = req.body.postImage || "";
    if (imageKey) data.postImage = imageKey;

    const post = await createPostService(data);

    // Sign the image for the response.
    let postImageUrl = null;
    if (post?.postImage) {
      try {
        postImageUrl = await getProfileImageSignedUrl(post.postImage);
      } catch (error) {
        console.error("Failed to sign post image URL:", error.message);
      }
    }
    const plain = typeof post.toObject === "function" ? post.toObject() : post;

    return res.status(201).json({
      success: true,
      data: { ...plain, postImageUrl },
      message: "Posted Successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ─── Get feed ─── */
export const getPosts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const room = req.query.room || "all";
    const subCategory = req.query.subCategory || "all";

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

/* ─── Likes ─── */
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