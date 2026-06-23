import Community from "../model/community.js";

export const createPostService = async (data) => {
    return await Community.create(data);
}

export const getPostsService = async () => {
    return await Community.find().populate("authorId", "firstName lastName referralCode").sort({ createdAt: -1 });;
}