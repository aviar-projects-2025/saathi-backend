import BookRide from "../model/bookride.js";
import { createReviewService, getUserReviewsService } from "../service/review.js";

export const createReview = async (req, res) => {
    try {
        const reviewerId = req.user?.userId || req.user?.id;
        if (!reviewerId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { rideId, revieweeId, rating, tags, comment } = req.body;

        if (!rideId || !revieweeId || !rating) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const review = await createReviewService({
            rideId,
            reviewerId,
            revieweeId,
            rating,
            tags,
            comment,
        });

        await BookRide.findOneAndUpdate(
            { rideId, requestedBy: reviewerId },
            { hasRated: true }
        );

        res.status(201).json({ success: true, message: "Rating submitted successfully", data: review });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getUserReviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const reviews = await getUserReviewsService(userId);
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};