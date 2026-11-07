// controllers/referralController.js
import { sendApprovalEmail } from '../../config/sendMail.js';
import twilioClient from '../../config/twilio.js';
import { emitNotification } from '../../socket.js';
import User from '../model/user.js';
import { buildNotification, createNotificationService } from '../service/notification.js';
import { getReferralService, updateService, removeService } from '../service/referral.js';


/**
 * Normalize a stored mobile number to E.164 for Twilio.
 * User.mobile is already stored in E.164 by the auth flow, but this guard
 * protects against legacy/edge-case values and prevents a bad `to` from
 * throwing at send time.
 */
const normalizeApprovalSmsNumber = (mobile) => {
    if (!mobile) return null;

    let phone = String(mobile).trim().replace(/[\s()-]/g, "");

    if (phone.startsWith("+")) {
        return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
    }

    // 10-digit Indian
    if (phone.length === 10 && phone.startsWith("9")) {
        return `+91${phone}`;
    }

    // 10-digit US
    if (phone.length === 10) {
        return `+1${phone}`;
    }

    // 91XXXXXXXXXX
    if (phone.length === 12 && phone.startsWith("91")) {
        return `+${phone}`;
    }

    // 1XXXXXXXXXX
    if (phone.length === 11 && phone.startsWith("1")) {
        return `+${phone}`;
    }

    return null;
};


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

        const approvedUser = await updateService(id, data);

        if (!approvedUser) {
            return res.status(404).json({
                status: false,
                message: "User not found",
            });
        }

        const user = approvedUser;
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

        // ----- SMS the user on approval -----
        if (status === "Approved") {
            try {
                const phoneNumber = normalizeApprovalSmsNumber(user?.mobile);

                if (phoneNumber) {
                    const smsBody =
                        `${fullName ? `Hi ${fullName}, ` : ""}` +
                        `your Saathi Rides request has been approved.\n\n` +
                        `You can now log in at https://saathirides.net/login ` +
                        `and start finding rides.\n\n` +
                        `- Saathi Rides`;

                    await twilioClient.messages.create({
                        body: smsBody,
                        messagingServiceSid:
                            process.env.TWILIO_MESSAGING_SERVICE_SID,
                        to: phoneNumber,
                    });
                } else {
                    console.warn(
                        "Approval SMS skipped: could not normalize mobile for user",
                        user?._id
                    );
                }
            } catch (smsErr) {
                console.error("Approval SMS failed (non-fatal):", smsErr);
            }
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
        const { id } = req.params;
        const approvedUser = await removeService(id);
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

export const sendReferralLink = async (req, res) => {
    try {
        const {
            mobile_number,
            referralCode,
            shareLink,
            referrerName,
        } = req.body;

        const phoneNumber = mobile_number;

        const message = await twilioClient.messages.create({
            body: `${referrerName} has invited you to join Saathi Rides.

Connect with trusted community members for rides and travel companionship.

Join Saathi Rides: ${shareLink}
- Saathi Rides`,
            messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: phoneNumber,
        });

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