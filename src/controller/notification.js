import mongoose from "mongoose";
import Notification from "../model/notification.js";
import Referral from "../model/referral.js";

import {
  buildNotification,
  createNotificationService,
  getNotificationService,
  updateNotificationStatusService,
  markAllNotificationsReadService,
  getUnreadNotificationCountService,
} from "../service/notification.js";

import { emitNotification } from "../../socket.js";

const getCurrentUserId = (req) =>
  req.user?._id ||
  req.user?.id ||
  req.user?.userId ||
  req.userId ||
  null;

const normalizeId = (value) =>
  value?._id?.toString?.() ||
  value?.id?.toString?.() ||
  value?.toString?.() ||
  null;

/*
 * Maintains compatibility with your existing userId-based routes.
 * If authentication middleware is configured, it must match the requested ID.
 */
const canAccessUser = (req, requestedUserId) => {
  const authenticatedId = getCurrentUserId(req);

  if (!authenticatedId) {
    // Legacy compatibility only. Protect these routes with auth middleware
    // in production; a userId in the URL is not proof of identity.
    return true;
  }

  return normalizeId(authenticatedId) === normalizeId(requestedUserId);
};

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

export const createNotification = async (req, res) => {
  try {
    const {
      userId,
      actorId,
      type,
      title,
      message,
      data = {},
    } = req.body || {};

    if (!userId || !type) {
      return sendError(
        res,
        400,
        "userId and type are required"
      );
    }

    if (!mongoose.isValidObjectId(userId)) {
      return sendError(res, 400, "Invalid recipient userId");
    }

    if (actorId && !mongoose.isValidObjectId(actorId)) {
      return sendError(res, 400, "Invalid actorId");
    }

    // If this route is authenticated, don't allow an ordinary user
    // to create notifications for arbitrary recipients.
    const authenticatedId = getCurrentUserId(req);

    if (
      authenticatedId &&
      normalizeId(authenticatedId) !== normalizeId(userId)
    ) {
      return sendError(
        res,
        403,
        "You cannot create notifications for another user through this endpoint"
      );
    }

    const defaults = buildNotification({
      type,
      actorName: data?.actorName || "Someone",
    });

    const notification = await createNotificationService({
      userId,
      actorId,
      type,
      title: title || defaults.title,
      message: message || defaults.message,
      data,
    });

    const populatedNotification = await Notification.findById(
      notification._id
    ).populate("actorId", "firstName lastName profileImage");

    const notificationObject = populatedNotification
      ? populatedNotification.toObject()
      : notification.toObject();

    // Keep the database record and real-time event in sync.
    emitNotification(String(userId), {
      ...notificationObject,
      _id: String(notification._id),
      type,
      title: notificationObject.title,
      category: notificationObject.title,
      message: notificationObject.message,
      isRead: false,
      data: {
        ...data,
        _id: String(notification._id),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notificationObject,
    });
  } catch (error) {
    console.error("[NOTIFICATION][CREATE]", error);

    return sendError(
      res,
      500,
      "Failed to create notification"
    );
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return sendError(res, 400, "Invalid userId");
    }

    if (!canAccessUser(req, userId)) {
      return sendError(res, 403, "Not authorized to view these notifications");
    }

    // Important: await the service so data contains the actual list.
    const notifications = await getNotificationService(userId);

    return res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length,
      unreadCount: notifications.filter((item) => !item.isRead).length,
    });
  } catch (error) {
    console.error("[NOTIFICATION][FETCH]", error);

    return sendError(res, 500, "Failed to fetch notifications");
  }
};

export const updateNotificationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid notification ID");
    }

    const authenticatedId = getCurrentUserId(req);

    // When authenticated, find the notification first to check its owner.
    const existing = await Notification.findById(id).select("userId isRead");

    if (!existing) {
      return sendError(res, 404, "Notification not found");
    }

    if (
      authenticatedId &&
      normalizeId(existing.userId) !== normalizeId(authenticatedId)
    ) {
      return sendError(res, 403, "Not authorized to update this notification");
    }

    const updated = await updateNotificationStatusService(
      id,
      { isRead: true },
      authenticatedId || null
    );

    if (!updated) {
      return sendError(res, 404, "Notification not found");
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: updated,
    });
  } catch (error) {
    console.error("[NOTIFICATION][MARK_SINGLE_READ]", error);

    return sendError(res, 500, "Failed to update notification status");
  }
};

export const getUnreadNotificationById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return sendError(res, 400, "Invalid userId");
    }

    if (!canAccessUser(req, userId)) {
      return sendError(res, 403, "Not authorized to view these notifications");
    }

    const unreadCount =
      await getUnreadNotificationCountService(userId);

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("[NOTIFICATION][UNREAD_COUNT]", error);

    return sendError(res, 500, "Failed to fetch unread notification count");
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return sendError(res, 400, "Invalid userId");
    }

    if (!canAccessUser(req, userId)) {
      return sendError(res, 403, "Not authorized to update these notifications");
    }

    const result = await markAllNotificationsReadService(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("[NOTIFICATION][MARK_ALL_READ]", error);

    return sendError(res, 500, "Failed to mark notifications as read");
  }
};

export const updateOptin = async (req, res) => {
  try {
    const { messageNumber } = req.body || {};

    if (!messageNumber) {
      return sendError(res, 400, "Mobile number is required");
    }

    const referral = await Referral.findOne({
      mobile: messageNumber,
    });

    if (!referral) {
      return res.status(200).json({
        success: true,
        message: "No referral found for this mobile number",
      });
    }

    referral.isMessageApproved = true;
    referral.messageNumber = messageNumber;

    await referral.save();

    return res.status(200).json({
      success: true,
      message: "SMS opt-in updated successfully",
      data: referral,
    });
  } catch (error) {
    console.error("[NOTIFICATION][OPTIN]", error);

    return sendError(res, 500, "Failed to update SMS opt-in");
  }
};