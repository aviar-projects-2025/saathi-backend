import cloudinary from "../../config/cloudinary.js";
import Community from "../model/community.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js"; // <-- ADDED

/* ─── Helper: sign profile images ─── */
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;
  const userData = typeof user.toObject === "function" ? user.toObject() : { ...user };
  if (!userData.profileImage) {
    return { ...userData, profileImageUrl: null };
  }
  try {
    return {
      ...userData,
      profileImageUrl: await getProfileImageSignedUrl(userData.profileImage),
    };
  } catch (error) {
    console.error("Failed to sign profile image URL:", error.message);
    return { ...userData, profileImageUrl: null };
  }
};

export const createPostService = async (data) => {
  return await Community.create(data);
};

export const deletePostService = async (postId, userId) => {
  const post = await Community.findById(postId);
  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  if (post.authorId.toString() !== userId) {
    const error = new Error("You are not authorized to delete this post");
    error.statusCode = 403;
    throw error;
  }

  if (post?.communityImgPublicId) {
    await cloudinary.uploader.destroy(post?.communityImgPublicId);
  }

  await Community.findByIdAndDelete(postId);

  return {
    message: "Post deleted successfully",
  };
};

export const getPostsService = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const posts = await Community.find()
    .populate(
      "authorId",
      "firstName lastName referralCode profileImage bio zipcode"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Community.countDocuments();

  // Format posts and sign author images
  const formattedPosts = await Promise.all(
    posts.map(async (post) => {
      const signedAuthor = await addProfileImageUrl(post.authorId);
      return {
        ...post,
        authorId: signedAuthor,
        commentCount: post.comments?.length || 0,
      };
    })
  );

  return {
    posts: formattedPosts,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + posts.length < total,
    },
  };
};

export const getProfilePostsService = async (
  authorId,
  page = 1,
  limit = 12
) => {
  const skip = (page - 1) * limit;

  const posts = await Community.find({ authorId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Community.countDocuments({ authorId });

  // Format posts and sign author images
  const formattedPosts = await Promise.all(
    posts.map(async (post) => {
      const signedAuthor = await addProfileImageUrl(post.authorId);
      return {
        ...post,
        authorId: signedAuthor,
        commentCount: post?.comments?.length || 0,
        description: post?.description,
      };
    })
  );

  return {
    posts: formattedPosts,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + posts.length < total,
    },
  };
};

export const editPostService = async (
  postId,
  userId,
  description,
  imageUrl,
  communityImgPublicId
) => {
  const post = await Community.findById(postId);

  if (post?.communityImgPublicId) {
    await cloudinary.uploader.destroy(post?.communityImgPublicId);
  }

  if (!post) {
    const error = new Error("Post not found");
    error.statusCode = 404;
    throw error;
  }

  if (post.authorId.toString() !== userId) {
    const error = new Error("You are not authorized to edit this post");
    error.statusCode = 403;
    throw error;
  }

  post.description = description;

  // Only update image if a new one was uploaded
  if (imageUrl) {
    post.postImage = imageUrl;
    post.communityImgPublicId = communityImgPublicId;
  }

  await post.save();

  return post;
};