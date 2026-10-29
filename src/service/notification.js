import Notification from "../model/notification.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js";

/* ─────────────────────────────────────────────────────────────
   Build message templates
   ───────────────────────────────────────────────────────────── */
export const buildNotification = ({ type, actorName = "Someone" }) => {
  switch (type) {
    case "new_request":
      return {
        title: "New Ride Request",
        message: `${actorName} requested to join your ride`,
      };

    case "ride_request_update":
      return {
        title: "Requested Extra Seats",
        message: `${actorName} requested extra seats`,
      };

    case "request_accepted":
      return { title: "Ride Request Accepted", message: "Your ride request was accepted" };

    case "request_rejected":
      return { title: "Request Rejected", message: "Your ride request was rejected" };

    case "request_cancelled":
      return { title: "Request Cancelled", message: "A ride request was cancelled" };

    case "ride_update":
      return { title: "Ride Updated", message: "Ride details have been updated" };

    case "new_ride_added":
      return { title: "New Ride Available", message: "A new ride has been added" };

    case "ride_started":
      return { title: "Ride Started", message: "Your ride has started" };

    case "ride_completed":
      return { title: "Ride Completed", message: "Your ride has been completed" };

    case "help_proposal_received":
    case "help_proposal_created":
      return {
        title: "New Help Offer",
        message: `${actorName} offered to help with your ride`,
      };

    case "help_proposal_pending":
      return { title: "Help Offer Submitted", message: "Your help offer has been submitted" };

    case "help_proposal_accepted":
    case "help_accepted":
      return { title: "Help Offer Accepted", message: "Your help offer has been accepted" };

    case "help_proposal_rejected":
    case "help_rejected":
      return { title: "Help Offer Declined", message: "Your help offer was declined" };

    case "help_proposal_cancelled":
    case "help_cancelled":
      return { title: "Help Offer Cancelled", message: "A help offer has been cancelled" };

    case "help_proposal_updated":
      return { title: "Help Offer Updated", message: "A help offer has been updated" };

    case "referral_pending":
      return {
        title: "New Referral",
        message: `${actorName} signed up using your referral code`,
      };

    case "referral_approved":
      return { title: "Referral Approved 🎉", message: "Your referral has been approved" };

    case "referral_rejected":
      return { title: "Referral Rejected", message: "Your referral was rejected" };

    default:
      return { title: "Notification", message: "You have a new update" };
  }
};

/* ─────────────────────────────────────────────────────────────
   Image signing helpers (shared)
   ───────────────────────────────────────────────────────────── */
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;

  const userData =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  if (!userData.profileImage) {
    return { ...userData, profileImageUrl: null };
  }

  try {
    return {
      ...userData,
      profileImageUrl: await getProfileImageSignedUrl(userData.profileImage),
    };
  } catch (error) {
    console.error("[NOTIFICATION][SIGN_FAILED]", error.message);
    return { ...userData, profileImageUrl: null };
  }
};

/* Notifications have `actorId`, NOT `createdBy`/`actualDriver` */
const addNotificationImageUrl = async (notification) => {
  if (!notification) return notification;

  const data =
    typeof notification.toObject === "function"
      ? notification.toObject()
      : { ...notification };

  if (!data.actorId || typeof data.actorId !== "object") {
    return data; // no populated actor → nothing to sign
  }

  const actorId = await addProfileImageUrl(data.actorId);
  return { ...data, actorId };
};

const addNotificationImageUrlsToList = async (list) =>
  Promise.all((list || []).map(addNotificationImageUrl));

/* ─────────────────────────────────────────────────────────────
   Create
   ───────────────────────────────────────────────────────────── */
export const createNotificationService = async ({
  userId,
  actorId = null,
  type,
  title,
  message,
  data = {},
}) => {
  if (!userId) throw new Error("Notification recipient userId is required");
  if (!type) throw new Error("Notification type is required");

  const actorName =
    data?.actorName || data?.requestedByName || data?.helperName || "Someone";

  const defaults = buildNotification({ type, actorName });

  const notification = await Notification.create({
    userId,
    ...(actorId ? { actorId } : {}),
    type,
    title: title || defaults.title,
    message: message || data?.message || defaults.message,
    data,
    isRead: false,
  });

  return notification;
};

/* ─────────────────────────────────────────────────────────────
   Get list — ★ RETURNS AN ARRAY (fixes "filter is not a function")
   ───────────────────────────────────────────────────────────── */
export const getNotificationService = async (userId) => {
  if (!userId) throw new Error("Notification userId is required");

  const notifications = await Notification.find({ userId })
    .populate("actorId", "firstName lastName profileImage")
    .sort({ createdAt: -1 })
    .lean();

  return addNotificationImageUrlsToList(notifications);
};

/* ─────────────────────────────────────────────────────────────
   Rest of the service (unchanged)
   ───────────────────────────────────────────────────────────── */
export const updateNotificationStatusService = async (id, data, userId = null) => {
  if (!id) throw new Error("Notification ID is required");

  const updates = {};
  if (typeof data?.isRead === "boolean") updates.isRead = data.isRead;
  if (Object.keys(updates).length === 0) {
    throw new Error("No valid notification status provided");
  }

  const filter = { _id: id };
  if (userId) filter.userId = userId;

  return Notification.findOneAndUpdate(
    filter,
    { $set: updates },
    { new: true, runValidators: true },
  );
};

export const markAllNotificationsReadService = async (userId) => {
  if (!userId) throw new Error("Notification userId is required");
  return Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
};

export const getUnreadNotificationCountService = async (userId) => {
  if (!userId) throw new Error("Notification userId is required");
  return Notification.countDocuments({ userId, isRead: false });
};