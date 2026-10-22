import mongoose from "mongoose";

const helpProposalSchema = new mongoose.Schema(
  {
    requestRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    helperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    offerDetails: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    confirmedRideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

helpProposalSchema.index({ requestRideId: 1, helperId: 1, status: 1 });
helpProposalSchema.index({ requesterId: 1, status: 1, createdAt: -1 });

export default mongoose.models.HelpProposal || mongoose.model("HelpProposal", helpProposalSchema);
