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
        const data =  {
            isRead: true
        }
        console.log("notif update", id , data)
        const updateNotification = await updateNotificationStatusService(id, data);
        console.log(updateNotification,'updatation notif')
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