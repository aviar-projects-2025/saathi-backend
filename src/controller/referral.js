import { emitNotification } from '../../socket.js';
import User from '../model/user.js';
import { buildNotification, createNotificationService } from '../service/notification.js';
import { getReferralService, updateService, removeService } from '../service/referral.js'


export const getReferrals = async (req, res) => {
    try {
        const { id } = req.params
        const data = await getReferralService(id);
        res.status(200).json({
            status: true,
            data: data
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

export const updateReferrals = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        console.log(data, "data");

        const approvedUser = await updateService(id, data);

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        if (data.refApprove) {
            const status = data.refApprove;

            const notifType =
                status === "Approved"
                    ? "referral_approved"
                    : "referral_rejected";

            const notif = buildNotification({
                type: notifType,
                actorName: "",
            });

            await createNotificationService({
                userId: user._id,
                actorId: user.referredBy,
                type: notifType,
                ...notif,
                data: { status },
            });

            emitNotification(user._id.toString(), {
                type: notifType,
                message: notif.message,
                data: { status },
            });

            // 🔥 OPTIONAL: Notify referrer also
            //   if (user.referredBy) {
            //     emitNotification(user.referredBy.toString(), {
            //       type: notifType,
            //       message:
            //         status === "Approved"
            //           ? "Your referral was approved 🎉"
            //           : "Your referral was rejected",
            //       data: { userId: user._id },
            //     });
            //   }
        }

        res.status(200).json({
            status: true,
            data: approvedUser,
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const removeReferrals = async (req, res) => {
    try {
        const { id } = req.params
        const approvedUser = await removeService(id);
        res.status(200).json({
            status: true,
            data: approvedUser
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

