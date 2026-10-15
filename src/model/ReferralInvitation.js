
import mongoose from "mongoose";

const referralInvitationSchema = new mongoose.Schema(
    {
        // User who sent the invitation
        referrerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // SHA-256 hash of the invitation token
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },

        // Normalized recipient phone number, preferably E.164
        mobile: {
            type: String,
            required: true,
        },

        // Invitation delivery channel
        channel: {
            type: String,
            enum: ["SMS", "WHATSAPP", "LINK"],
            default: "SMS",
        },

        // Invitation lifecycle
        status: {
            type: String,
            enum: ["PENDING", "USED", "EXPIRED", "REVOKED"],
            default: "PENDING",
            index: true,
        },

        // User created through this invitation
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        usedAt: {
            type: Date,
            default: null,
        },

        // Invitation expiration time
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },

        // Optional delivery tracking
        sentAt: {
            type: Date,
            default: null,
        },

        deliveryStatus: {
            type: String,
            enum: ["NOT_SENT", "SENT", "FAILED"],
            default: "NOT_SENT",
        },
    },
    {
        timestamps: true,
    }
);

// Useful when listing a referrer's active invitations
referralInvitationSchema.index({
    referrerId: 1,
    status: 1,
    createdAt: -1,
});

const ReferralInvitation = mongoose.model(
    "ReferralInvitation",
    referralInvitationSchema
);

export default ReferralInvitation;
