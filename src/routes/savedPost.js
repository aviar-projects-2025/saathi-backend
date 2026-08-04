import express from 'express'
import { savePost, getPostById , removeSavedPost} from '../controller/SavedPost.js';


const router = express.Router()

router.post('/:postId/:userId', savePost);
router.get('/:userId', getPostById);
router.delete('/:postId/:userId', removeSavedPost);

export default router;