import cloudinary from "../../config/cloudinary.js";
import Community from "../model/community.js";
import {
  getProfileImageSignedUrl,
  deleteS3Object,
} from "../controller/s3Controller.js";

/* ─── Helpers ─── */

const isHttpUrl = (value) =>
  typeof value === "string" && /^https?:\/\//i.test(value);

// Sign a populated author's profile image
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;

  const userData =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

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

// Sign a post (author + post image) and add postImageUrl
const addSignedUrls = async (post) => {
  if (!post || typeof post !== "object") return post;

  const plain =
    typeof post.toObject === "function" ? post.toObject() : { ...post };

  let author = plain.authorId;
  if (author && typeof author === "object") {
    author = await addProfileImageUrl(author);
  }

  let postImageUrl = null;
  if (plain.postImage) {
    try {
      postImageUrl = await getProfileImageSignedUrl(plain.postImage);
    } catch (error) {
      console.error("Failed to sign post image URL:", error.message);
      postImageUrl = null;
    }
  }

  return {
    ...plain,
    authorId: author,
    postImageUrl,
    postImage: plain.postImage,
  };
};

/* ─── Create ─── */
export const createPostService = async (data) => {
  return await Community.create(data);
};

/* ─── Delete ─── */
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

  // New S3 key
  if (post.postImage && !isHttpUrl(post.postImage)) {
    await deleteS3Object(post.postImage);
  }

  // Legacy Cloudinary object
  if (post.communityImgPublicId) {
    try {
      await cloudinary.uploader.destroy(post.communityImgPublicId);
    } catch (error) {
      console.error("Cloudinary delete failed:", error.message);
    }
  }

  await Community.findByIdAndDelete(postId);

  return { message: "Post deleted successfully" };
};

/* ─── Read: feed ─── */
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

  const formattedPosts = await Promise.all(
    posts.map(async (post) => {
      const signed = await addSignedUrls(post);
      return {
        ...signed,
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

/* ─── Read: profile feed ─── */
export const getProfilePostsService = async (authorId, page = 1, limit = 12) => {
  const skip = (page - 1) * limit;

  const posts = await Community.find({ authorId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Community.countDocuments({ authorId });

  const formattedPosts = await Promise.all(
    posts.map(async (post) => {
      const signed = await addSignedUrls(post);
      return {
        ...signed,
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

/* ─── Edit ─── */
export const editPostService = async (
  postId,
  userId,
  description,
  imageKey,
  communityImgPublicId
) => {
  const post = await Community.findById(postId);
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

  if (imageKey) {
    // Delete the previous S3 key (new posts)
    if (post.postImage && !isHttpUrl(post.postImage)) {
      await deleteS3Object(post.postImage);
    }

    // Delete legacy Cloudinary object
    if (post.communityImgPublicId) {
      try {
        await cloudinary.uploader.destroy(post.communityImgPublicId);
      } catch (error) {
        console.error("Cloudinary delete failed:", error.message);
      }
      post.communityImgPublicId = undefined;
    }

    post.postImage = imageKey;

    if (communityImgPublicId) {
      post.communityImgPublicId = communityImgPublicId;
    }
  }

  await post.save();
  return post;
};