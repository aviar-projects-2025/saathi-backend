import express from 'express'
import multer from 'multer'
import { createPost,getPosts } from '../controller/community.js';
import { getUploadSignature } from '../../config/cloudinary.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/',getPosts)
router.post('/',upload.single("postImage"), createPost)

// cloudinary image
router.get("/upload-signature", getUploadSignature);

export default router