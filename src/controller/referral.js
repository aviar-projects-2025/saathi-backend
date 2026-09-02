import { sendApprovalEmail } from '../../config/sendMail.js';
import twilioClient from '../../config/twilio.js';
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

            // send mail
            sendApprovalEmail(
                approvedUser?.email,
                approvedUser.firstName + " " + approvedUser.lastName
            );
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

export const sendReferralLink = async (req, res) => {
    try {
        const { mobile_number } = req.body;

        if (!mobile_number || !/^\d{10}$/.test(mobile_number)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit mobile number",
            });
        }

        const phoneNumber = `+91${mobile_number}`;

        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verifications.create({
                to: phoneNumber,
                channel: "sms",
            });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            status: verification.status,
        });

    } catch (error) {
        console.error("Twilio OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
        });
    }
};