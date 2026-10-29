// src/model/review.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    tags: { type: [String], default: [] },
    comment: { type: String, trim: true, maxLength: 1000 },

    // ★ NEW
    autoRated: { type: Boolean, default: false, index: true },
    ratedBy: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },
  },
  { timestamps: true }
);

reviewSchema.index({ rideId: 1, reviewerId: 1, revieweeId: 1 }, { unique: true });

// ★ Fast lookup for the auto-rater cron
reviewSchema.index({ autoRated: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model("Review", reviewSchema);