import mongoose from "mongoose";

const referralInvitationSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    // Phone number — required for SMS/WhatsApp, empty for generic LINK invites
    mobile: {
      type: String,
      default: "",
    },

    channel: {
      type: String,
      enum: ["SMS", "WHATSAPP", "LINK"],
      default: "SMS",
    },

    status: {
      type: String,
      enum: ["PENDING", "USED", "EXPIRED", "REVOKED"],
      default: "PENDING",
      index: true,
    },

    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

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