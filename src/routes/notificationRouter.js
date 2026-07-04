import express from 'express'
import { createNotification, getNotificationById } from '../controller/notification.js';

const router = express.Router();

router.get('/:userId', getNotificationById)
router.post('/', createNotification);

export default router