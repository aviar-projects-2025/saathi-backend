import Notification from "../model/notification.js"

export const createNotificaitonService = async (data, type, title, message) => {

    console.log(data, 'data')
    let userId = type === 'request_accepted' ? data?.requestedBy : data?.rideOwner;
    let requestedById = type === 'request_accepted' ? data?.requestedBy : data?.rideOwner;
    const details = {
        userId,
        requestedById,
        type: type,
        title: title,
        message: data?.message || message || 'click to see the notification',
        data: data,
    }
    return await Notification.create(details);

}

export const getNotificationService = async (userId) => {

    return await Notification
        .find({ userId })
        .populate('requestedById', 'firstName lastName profileImage')
        .sort({ createdAt: -1 });
};