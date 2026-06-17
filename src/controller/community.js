import cloudinary from "../../config/cloudinary.js";
import streamifier from 'streamifier'
import { createPostService, getPostsService } from "../service/community.js";


const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "saathi-posts",
                resource_type: "image",
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};


export const createPost = async (req, res) => {
    try {

        let imageUrl = "";

        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            imageUrl = result.secure_url;
        }

        const data = {
            ...req.body,
            postImage: imageUrl,
        };

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