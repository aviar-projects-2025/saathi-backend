
import mongoose from "mongoose";

const travelBuddyRequestSchema = new mongoose.Schema(
  {
    targetTripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelBuddy",
      required: true,
      index: true,
    },
    submittedTripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelBuddy",
      required: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    publishOnReject: { type: Boolean, default: false },

    // Contact-sharing consent from each participant.
    requesterContactConsent: { type: Boolean, default: false },
    requesterConsentAt: { type: Date, default: null },
    recipientContactConsent: { type: Boolean, default: false },
    recipientConsentAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

travelBuddyRequestSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
travelBuddyRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });
travelBuddyRequestSchema.index({ targetTripId: 1, status: 1 });

export default mongoose.models.TravelBuddyRequest ||
  mongoose.model("TravelBuddyRequest", travelBuddyRequestSchema);
