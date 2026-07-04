import { getNotificationService } from "../service/notification.js";

export const createNotification = async (req, res) => {
    try {




    } catch (error) {

    }
}


export const getNotificationById = async (req, res) => {
    try {
        const { userId } = req.params
        console.log(userId,'useriD')
        const getNotification = await getNotificationService(userId);
        res.status(200).json({
            success : true,
            data : getNotification,
        })
    } catch (error) {
        res.status(500).json({
            success : false,
            message : 'failed to fetch notification'
        })
    }
}

export const getUnreadNotificationById = async (req, res) => {
    try {

    } catch (error) {

    }
}