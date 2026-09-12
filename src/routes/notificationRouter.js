import express from 'express'
import { createNotification, getNotificationById, updateNotificationStatus, markAsRead } from '../controller/notification.js';

const router = express.Router();

router.get('/:userId', getNotificationById)
router.patch('/:userId', markAsRead)
router.post('/', createNotification);
router.patch('/single/:id', updateNotificationStatus);


export default router