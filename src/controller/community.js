import { createPostService,getPostsService } from "../service/community.js";

export const createPost = async (req, res) => {
    try {
        const data = req.body;
        console.log(data,'data')
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
        const posts = await getPostsService();
        res.status(200).json({
            success: true,
            data: posts,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}