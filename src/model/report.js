import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        "Unsafe driving or behavior",
        "Harassment or inappropriate messages",
        "Asked for more than the cost share",
        "No-show or cancelled last minute",
        "Fake profile or not who they said",
        "Other",
      ],
    },
    details: {
      type: String,
      trim: true,
      maxLength: 2000,
    },
    status: {
      type: String,
      enum: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);
export default Report;