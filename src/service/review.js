// src/service/review.js
import Review from "../model/review.js";
import Ride from "../model/ride.js";

export const createReviewService = async (data) => {
    const { rideId, reviewerId, revieweeId, rating, tags, comment } = data;

    const ride = await Ride.findById(rideId);
    if (!ride) throw new Error("Ride not found");
    if (ride.travelStatus !== "Completed") throw new Error("You can only review a completed ride");

    const existing = await Review.findOne({ rideId, reviewerId, revieweeId });
    if (existing) throw new Error("You have already reviewed this user for this ride");

    return Review.create({
        rideId, reviewerId, revieweeId, rating, tags, comment,
        autoRated: false,
        ratedBy: "user",
    });
};

// ★ NEW: system-driven auto-review, idempotent
export const createSystemReviewService = async ({ rideId, reviewerId, revieweeId, rating = 5 }) => {
    const existing = await Review.findOne({ rideId, reviewerId, revieweeId }).lean();
    if (existing) return existing;

    try {
        return await Review.create({
            rideId,
            reviewerId,
            revieweeId,
            rating,
            tags: [],
            comment: "",
            autoRated: true,
            ratedBy: "system",
        });
    } catch (err) {
        // Race condition — another process just created it
        if (err?.code === 11000) {
            return Review.findOne({ rideId, reviewerId, revieweeId }).lean();
        }
        throw err;
    }
};

export const getUserReviewsService = async (userId) => {
    return await Review.find({ revieweeId: userId })
        .populate("reviewerId", "firstName lastName profileImage")
        .sort({ createdAt: -1 });
};