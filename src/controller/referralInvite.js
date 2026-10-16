import crypto from "node:crypto";
import twilioClient from "../../config/twilio.js";
import Referral from "../model/referral.js"
import ReferralInvitation from "../model/ReferralInvitation.js";
import User from "../model/user.js"
import { randomBytes, createHash } from "node:crypto";

const FRONTEND_URLS = {
  development: "https://saathi-frontend-sl8k.vercel.app",
  production: "https://saathirides.net",
};

const getFrontendBaseUrl = () =>
  FRONTEND_URLS[process.env.NODE_ENV] || FRONTEND_URLS.development;

export const createReferral = async (req, res) => {
    let invitation;

    try {
        const { mobile, referredBy } = req.body;

        console.log(mobile, referredBy)

        if (!mobile || !referredBy) {
            return res.status(400).json({
                status: false,
                message: "Mobile number and referrer are required",
            });
        }

        // Expect a normalized number such as +14155552671 or +919876543210.
        const normalizedMobile = mobile.replace(/[\s()-]/g, "");

        if (!/^\+[1-9]\d{7,14}$/.test(normalizedMobile)) {
            return res.status(400).json({
                status: false,
                message: "Enter a valid international mobile number",
            });
        }

        const referrer = await User.findById(referredBy);

        console.log(referrer, 'referrer')
        if (!referrer) {
            return res.status(404).json({
                status: false,
                message: "Referrer not found",
            });
        }

        // Do not invite an existing account.
        const existingUser = await User.findOne({
            mobile: normalizedMobile,
        });

        if (existingUser) {
            return res.status(409).json({
                status: false,
                message: "An account already exists with this mobile number",
            });
        }

        // Invalidate previous active invitations for this referrer/number.
        await ReferralInvitation.updateMany(
            {
                referrerId: referrer._id,
                mobile: normalizedMobile,
                status: "PENDING",
            },
            {
                $set: { status: "REVOKED" },
            }
        );

        // Generate a cryptographically secure, unique token.
        const token = randomBytes(32).toString("hex");

        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        invitation = await ReferralInvitation.create({
            referrerId: referrer._id,
            tokenHash,
            mobile: normalizedMobile,
            channel: "SMS",
            status: "PENDING",
            expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
            ),
            deliveryStatus: "NOT_SENT",
        });

        const shareLink = `${getFrontendBaseUrl()}/register?ref=${token}`;

        const referrerName =
            `${referrer.firstName} ${referrer.lastName}`.trim();

        // Send the exact link associated with the saved token.
        const message = await twilioClient.messages.create({
            body: `${referrerName} has invited you to join Saathi Rides.

Connect with trusted community members for rides and travel companionship.

Join Saathi Rides: ${shareLink}
- Saathi Rides`,
            messagingServiceSid:
                process.env.TWILIO_MESSAGING_SERVICE_SID,
            to: normalizedMobile,
        });

        invitation.deliveryStatus = "SENT";
        invitation.sentAt = new Date();
        await invitation.save();

        return res.status(201).json({
            status: true,
            message: "Referral invitation sent successfully",
            sid: message.sid,
        });
    } catch (error) {
        console.error("Create referral invitation error:", error);

        // Prevent a failed SMS invitation from remaining active.
        if (invitation) {
            try {
                invitation.deliveryStatus = "FAILED";
                invitation.status = "REVOKED";
                await invitation.save();
            } catch (saveError) {
                console.error(
                    "Failed to update invitation:",
                    saveError
                );
            }
        }

        if (error.code === 11000) {
            return res.status(409).json({
                status: false,
                message: "Unable to create a unique invitation. Please retry.",
            });
        }

        return res.status(502).json({
            status: false,
            message: "Failed to send referral invitation",
        });
    }
};

export const validateReferralInvitation = async (req, res) => {
  try {
    const { token } = req.query;

    console.log()

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invitation token is required",
      });
    }

    // The invitation stores a hash, not the raw token.
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const invitation = await ReferralInvitation.findOne({
      tokenHash,
      status: "PENDING",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "This invitation is invalid or has expired",
      });
    }

    const referrer = await User.findById(invitation.referrerId)
      .select("firstName lastName referralCode");

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "The person who sent this invitation could not be found",
      });
    }

    return res.status(200).json({
      success: true,
      invitation: {
        referrerName: `${referrer.firstName} ${referrer.lastName}`.trim(),
        referralCode: referrer.referralCode,
      },
    });
  } catch (error) {
    console.error("Validate referral invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to validate invitation",
    });
  }
};

export const findReferral = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        const referral = await Referral.findOne({ mobile });
        const user = await User.findOne({ mobile });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: "Referral not found",
            });
        }

        // User already has an approved account
        if (
            referral.status === "Verified" &&
            user?.refApprove === "Approved"
        ) {
            return res.status(400).json({
                success: false,
                message: "You already have an account with this mobile number",
            });
        }

        // Waiting → Verified
        if (referral.status === "Waiting") {
            // referral.status = "Verified";
            // await referral.save();

            return res.status(200).json({
                success: true,
                message: "Referral verified successfully",
                referral,
            });
        }

        // Already verified - allow OTP again
        if (referral.status === "Verified") {
            return res.status(200).json({
                success: true,
                message: "Referral already verified. OTP can be sent again.",
                referral,
            });
        }

        return res.status(400).json({
            success: false,
            message: `Invalid referral status: ${referral.status}`,
        });

    } catch (error) {
        console.error("Find referral error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to find referral",
        });
    }
};

export const createInviteLink = async (req, res) => {
  try {
    const { referredBy } = req.body;

    if (!referredBy) {
      return res.status(400).json({
        status: false,
        message: "referrerId is required",
      });
    }

    const referrer = await User.findById(referredBy).select(
      "firstName lastName"
    );

    if (!referrer) {
      return res.status(404).json({
        status: false,
        message: "Referrer not found",
      });
    }

    // Always generate a fresh token
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const invitation = await ReferralInvitation.create({
      referrerId: referrer._id,
      tokenHash,
      mobile: "",
      channel: "LINK",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      deliveryStatus: "NOT_SENT",
    });

    const base = getFrontendBaseUrl();
    const shareLink = `${base}/register?ref=${rawToken}`;

    return res.status(200).json({
      status: true,
      token: rawToken,
      link: shareLink,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error("Create invite link error:", error);
    return res.status(500).json({
      status: false,
      message: "Unable to generate invite link",
    });
  }
};