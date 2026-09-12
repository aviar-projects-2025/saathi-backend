import express from "express";

import {
    createNotification,
    getNotificationById,
    updateNotificationStatus,
    markAsRead,
    updateOptin,
} from "../controller/notification.js";

const router = express.Router();

router.patch("/optin", updateOptin);

router.patch("/single/:id", updateNotificationStatus);

router.get("/:userId", getNotificationById);

router.patch("/:userId", markAsRead);

router.post("/", createNotification);


export default router;