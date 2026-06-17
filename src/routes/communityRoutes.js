import express from 'express'
import { createPost,getPosts } from '../controller/community.js';
import { getUploadSignature } from '../../config/cloudinary.js';

const router = express.Router();

router.get('/',getPosts)
router.post('/', createPost)

// cloudinary image
router.get("/upload-signature", getUploadSignature);

export default router