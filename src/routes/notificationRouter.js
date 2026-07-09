import express from 'express'
import { createNotification, getNotificationById, updateNotificationStatus } from '../controller/notification.js';

const router = express.Router();

router.get('/:userId', getNotificationById)
router.post('/', createNotification);
router.patch('/:id', updateNotificationStatus);


export default router