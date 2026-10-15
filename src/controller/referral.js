import { sendApprovalEmail } from '../../config/sendMail.js';
import twilioClient from '../../config/twilio.js';
import { emitNotification } from '../../socket.js';
import User from '../model/user.js';
import { buildNotification, createNotificationService } from '../service/notification.js';
import { getReferralService, updateService, removeService } from '../service/referral.js'


export const getReferrals = async (req, res) => {
    try {
        const { id } = req.params;

        const data = await getReferralService(id);

        return res.status(200).json({
            status: true,
            data,
        });

    } catch (error) {
        console.error("Get referrals error:", error);

        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const updateReferrals = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        // Validate status value
        if (
            !data.refApprove ||
            !["Approved", "Rejected", "Waiting"].includes(data.refApprove)
        ) {
            return res.status(400).json({
                status: false,
                message: "Invalid refApprove value",
            });
        }

        console.log(id, data,'id, data')

        const approvedUser = await updateService(id, data);
        console.log(approvedUser,'approvedUser')
        if (!approvedUser) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        const user = approvedUser; // they're the same object now
        const status = data.refApprove;

        const notifType =
            status === "Approved" ? "referral_approved" : "referral_rejected";

        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

        // ----- Notify the referrer (the person who approved/rejected) -----
        if (user.referredBy) {
            try {
                const notif = buildNotification({
                    type: notifType,
                    actorName: fullName,
                });

                await createNotificationService({
                    userId: user.referredBy,
                    actorId: user._id,
                    type: notifType,
                    ...notif,
                    data: { status },
                });

                emitNotification(user.referredBy.toString(), {
                    type: notifType,
                    message: notif.message,
                    data: { status },
                });
            } catch (notifErr) {
                console.error("Notification failed (non-fatal):", notifErr);
            }
        }

        // ----- Email the approved/rejected user -----
        try {
            if (status === "Approved") {
                await sendApprovalEmail(user?.email, fullName);
            } else if (status === "Rejected") {
                // await sendRejectionEmail(user?.email, fullName);
            }
        } catch (mailErr) {
            console.error("Approval email failed (non-fatal):", mailErr);
        }

        return res.status(200).json({
            status: true,
            data: approvedUser,
        });
    } catch (error) {
        console.error("updateReferrals error:", error);
        return res.status(500).json({
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
        // console.log(req.body)
        const {
            mobile_number,
            referralCode,
            shareLink,
            referrerName
        } = req.body;

        // if (!mobile_number || !/^\d{10}$/.test(mobile_number)) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Enter a valid 10-digit mobile number",
        //     });
        // }

        const phoneNumber = mobile_number

        // const referralLink = `https://saathirides.net/register?ref=${referralCode}`;
        const referralLink = shareLink;

        const message = await twilioClient.messages.create({
            body: `${referrerName} has invited you to join Saathi Rides.

Connect with trusted community members for rides and travel companionship.

Join Saathi Rides: ${shareLink}
- Saathi Rides`,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phoneNumber,
        });

        // console.log("Message SID:", message.sid);
        // console.log("Initial Status:", message.status);

        return res.status(200).json({
            success: true,
            message: "Referral link sent successfully",
            sid: message.sid,
        });

    } catch (error) {
        console.error("Twilio SMS Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to send referral link",
        });
    }
};