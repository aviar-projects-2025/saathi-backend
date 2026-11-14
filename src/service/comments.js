import Comment from "../model/comments.js";
import Like from "../model/likes.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js";

/* ───────────────────────────────────────────────────────
   Helper: attach a signed `profileImageUrl` to a populated user.
   - Works on lean() plain objects and hydrated docs.
   - Keeps the raw `profileImage` key too.
   - Never throws; falls back to `profileImageUrl: null`.
   ─────────────────────────────────────────────────────── */
const attachProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;
  const data = typeof user.toObject === "function" ? user.toObject() : { ...user };
  if (!data.profileImage) {
    return { ...data, profileImageUrl: null };
  }
  try {
    return {
      ...data,
      profileImageUrl: await getProfileImageSignedUrl(data.profileImage),
    };
  } catch (err) {
    console.error("[comments] Failed to sign profile image:", err.message);
    return { ...data, profileImageUrl: null };
  }
};

/* ───────────────────────────────────────────────────────
   Create
   ─────────────────────────────────────────────────────── */
export const postCommentService = async (postId, userId, comment) => {
  const payload = {
    postId,
    userId,
    comment,
  };

  const postComment = await Comment.create(payload);

  // Populate the creator so the frontend can render the avatar immediately
  // from the POST response, without a follow-up GET.
  const populated = await Comment.findById(postComment._id)
    .populate("userId", "firstName lastName profileImage")
    .lean();

  const withUrl = {
    ...populated,
    userId: await attachProfileImageUrl(populated.userId),
  };

  return {
    postComment: withUrl,
    message: "Comment posted",
  };
};

export const replyCommentService = async (postId, parentId, userId, comment) => {
  const payload = {
    postId,
    parentCommentId: parentId,
    userId,
    comment,
  };

  const postComment = await Comment.create(payload);

  const populated = await Comment.findById(postComment._id)
    .populate("userId", "firstName lastName profileImage")
    .lean();

  const withUrl = {
    ...populated,
    userId: await attachProfileImageUrl(populated.userId),
  };

  return {
    postComment: withUrl,
    message: "Comment posted",
  };
};

/* ───────────────────────────────────────────────────────
   Read
   ─────────────────────────────────────────────────────── */
export const getCommentService = async (postId, userId) => {
  const comments = await Comment.find({ postId })
    .populate("userId", "firstName lastName profileImage")
    .sort({ createdAt: -1 })
    .lean();   // ← .lean() so we can safely spread + map

  const updatedComments = await Promise.all(
    comments.map(async (comment) => {
      const liked = await Like.exists({
        commentId: comment._id,
        userId,
      });

      return {
        ...comment,
        userId: await attachProfileImageUrl(comment.userId),
        likedByCurrentUser: !!liked,
      };
    })
  );

  return {
    comments: updatedComments,
    message: "Comments fetched",
  };
};

/* ───────────────────────────────────────────────────────
   Update
   ─────────────────────────────────────────────────────── */
export const editCommentService = async (commentId, userId, body) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.userId.toString() !== userId) {
    throw new Error("You are not authorized to edit this comment");
  }

  comment.comment = body.comment;
  await comment.save();

  // Return the populated + signed version so the client can update the row
  // in place without a refetch.
  const populated = await Comment.findById(comment._id)
    .populate("userId", "firstName lastName profileImage")
    .lean();

  return {
    ...populated,
    userId: await attachProfileImageUrl(populated.userId),
  };
};

/* ───────────────────────────────────────────────────────
   Delete
   ─────────────────────────────────────────────────────── */
export const deleteCommentService = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.userId.toString() !== userId) {
    throw new Error("You are not authorized to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);
  await Comment.deleteMany({ parentCommentId: commentId });

  return comment;
};