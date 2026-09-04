import Notification from "../model/notification.js";
import { getNotificationService, updateNotificationStatusService } from "../service/notification.js";

export const createNotification = async (req, res) => {
    try {




    } catch (error) {

    }
}


export const getNotificationById = async (req, res) => {
    try {
        const { userId } = req.params
        const getNotification = await getNotificationService(userId);
        res.status(200).json({
            success: true,
            data: getNotification,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'failed to fetch notification'
        })
    }
}

export const updateNotificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const data = {
            isRead: true
        }
        const updateNotification = await updateNotificationStatusService(id, data);

        res.status(200).json({
            success: true,
            data: updateNotification
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'failed'
        })
    }
}

export const getUnreadNotificationById = async (req, res) => {
    try {

    } catch (error) {

    }
}

export const markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await Notification.updateMany(
      {
        userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });

  } catch (error) {
    console.error("Error marking notifications as read:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
    });
  }
};