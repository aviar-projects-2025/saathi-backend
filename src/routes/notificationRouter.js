import express from "express";

import {
  createNotification,
  getNotificationById,
  updateNotificationStatus,
  markAsRead,
  updateOptin,
  getUnreadNotificationById,
} from "../controller/notification.js";

const router = express.Router();

// Keep the existing referral SMS opt-in endpoint.
router.patch("/optin", updateOptin);

// Mark one notification as read.
router.patch("/single/:id", updateNotificationStatus);

// Get unread notification count.
router.get("/unread/:userId", getUnreadNotificationById);

// Fetch notifications for a user.
router.get("/:userId", getNotificationById);

// Mark all notifications as read for a user.
router.patch("/:userId", markAsRead);

// Optional API endpoint for creating notifications.
// Existing controllers should generally use createNotificationService directly.
router.post("/", createNotification);

export default router;