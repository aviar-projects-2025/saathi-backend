import Notification from "../model/notification.js"

// export const createNotificaitonService = async (data, type, title, message) => {

//     console.log(data, 'data')
//     let userId = type === 'request_accepted' ? data?.requestedBy : data?.rideOwner;
//     let requestedById = type === 'request_accepted' ? data?.requestedBy : data?.rideOwner;
//     const details = {
//         userId,
//         requestedById,
//         type: type,
//         title: title,
//         message: data?.message || message || 'click to see the notification',
//         data: data,
//     }
//     return await Notification.create(details);

// }

export const buildNotification = ({ type, actorName }) => {
    switch (type) {
        case "new_request":
            return {
                title: "New Ride Request",
                message: `${actorName} requested to join your ride`,
            };

        case "request_accepted":
            return {
                title: "Request Accepted",
                message: `Your ride request was accepted`,
            };

        case "request_rejected":
            return {
                title: "Request Rejected",
                message: `Your ride request was rejected`,
            };

        case "request_cancelled":
            return {
                title: "Request Cancelled",
                message: `A ride request was cancelled`,
            };

        case "ride_update":
            return {
                title: "Ride Updated",
                message: `Ride details have been updated`,
            };

        case "new_ride_added":
            return {
                title: "New Rides",
                message: `Ride details have been updated`,
            };

        case "referral_pending":
            return {
                title: "New Referral",
                message: `${actorName} signed up using your referral code`,
            };

        case "referral_approved":
            return {
                title: "Referral Approved 🎉",
                message: `Your referral has been approved`,
            };

        case "referral_rejected":
            return {
                title: "Referral Rejected",
                message: `Your referral was rejected`,
            };

        default:
            return {
                title: "Notification",
                message: "You have a new update",
            };
    }
};

export const createNotificationService = async ({
    userId,
    actorId,
    type,
    title,
    message,
    data = {},
}) => {
    return await Notification.create({
        userId,
        actorId,
        type,
        title,
        message,
        data,
    });
};

export const getNotificationService = async (userId) => {

    return await Notification
        .find({ userId })
        .populate('actorId', 'firstName lastName profileImage')
        .sort({ createdAt: -1 });
};

export const updateNotificationStatusService = async (id, data) => {
    return await Notification.findByIdAndUpdate(
        id,
        data,
        { new: true }
    )
}