import cloudinary from "../../config/cloudinary.js";
import Community from "../model/community.js";



export const createPostService = async (data) => {
  return await Community.create(data);
}
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
// export const getPostsService = async () => {
//   return await Community.find()
//   .populate("authorId", "firstName lastName referralCode profileImage bio zipcode")
//   .sort({ createdAt: -1 });;
// }

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

  const formattedPosts = posts.map((post) => ({
    ...post,
    commentCount: post.comments?.length || 0,
  }));

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