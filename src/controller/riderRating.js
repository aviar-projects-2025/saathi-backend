import { createRatingService } from "../service/riderRatingService.js";

export const createRating = async (req, res) => {
  try {
    const { rideId, rating, review } = req.body;
    const {id} = req.params;
    console.log("id",id)
    // const passengerId = req.id;
//    console.log("pass",passengerId)
    const ratingData = await createRatingService({
      rideId,
      rating,
      review,
    //   passengerId,
    });
   console.log("rideId,rating,review,passengerId",rideId,
      rating,
      review,
     )
    return res.status(201).json({
      success: true,
      message: "Rating submitted successfully.",
      data: ratingData,
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};