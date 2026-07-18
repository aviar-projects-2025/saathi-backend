import Ride from "../model/ride.js";
import riderRatingmodal from "../model/riderRatingmodal.js";

export const createRatingService = async ({
    rideId,
    rating,
    review,
    //   passengerId,
}) => {
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
        throw {
            status: 400,
            message: "Rating must be between 1 and 5.",
        };
    }
    console.log("asdfgn")
    // Check ride
    const ride = await Ride.findById(rideId);

    if (!ride) {
        throw {
            status: 404,
            message: "Ride not found.",
        };
    }

    // Check ride completed
    if (ride.travelStatus !== "Completed") {
        throw {
            status: 400,
            message: "You can rate only completed rides.",
        };
    }

    // Check duplicate rating
    const alreadyRated = await riderRatingmodal.findOne({
        rideId,
        // passengerId,
    });

    if (alreadyRated) {
        throw {
            status: 400,
            message: "You have already rated this ride.",
        };
    }

    // Save rating
    const newRating = await riderRatingmodal.create({
        rideId,
        riderId: ride.createdBy,
        // passengerId,
        rating,
        review,
    });

    return newRating;
};