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

  await Community.findByIdAndDelete(postId);

  return {
    message: "Post deleted successfully",
  };
};
export const getPostsService = async () => {
    return await Community.find().populate("authorId", "firstName lastName referralCode profileImage bio").sort({ createdAt: -1 });;
}
export const editPostService = async (
  postId,
  userId,
  description,
  imageUrl
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

  // Only update image if a new one was uploaded
  if (imageUrl) {
    post.postImage = imageUrl;
  }

  await post.save();

  return post;
};