import express from 'express'
import multer from 'multer'
import { createPost, getPosts, deletePost, editPost } from '../controller/community.js';
import { getUploadSignature } from '../../config/cloudinary.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getPosts)
router.post('/', upload.single("postImage"), createPost)
router.delete('/:postId', deletePost)
// router.put("/:postId", editPost);
router.put("/:postId", upload.single("postImage"), editPost);
router.get("/upload-signature", getUploadSignature);

export default router