import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";

const createBookRideService = async (data) => {
  return await BookRide.create(data)
}
 const getSentRequestsService = async (userId) => {
  return await BookRide.find({ requestedBy: userId })
    .populate({
      path: "rideId",
      populate: {
        path: "createdBy",
        select: "firstName lastName email profileImage",
      },
    })
    .populate("requestedBy", "firstName lastName email profileImage")
    .sort({ createdAt: -1 });
};

const editBookRideService = async (id, data) => {
  return await BookRide.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );
}
// get all 
const getBookRideService = async (userId, type) => {

  if (type === "requested") {
    return await BookRide.find({
      requestedBy: userId,
    });
  }

  if (type === "received") {
    return await BookRide.find({
      rideOwner: userId,
    }).populate('requestedBy', 'firstName lastName profileImage');
  }

  return [];
};

const statusBookRide = async (requestId, type) => {
  try {
    // 1. Update request
    const request = await BookRide.findByIdAndUpdate(
      requestId,
      { status: type === "Approve" ? "ACCEPTED" : "REJECTED" },
      { new: true }
    );

    if (!request) throw new Error("Request not found");

    // 2. Only proceed if approved
    if (type === "Approve") {
      const rideId = request.rideId;
      const seatsRequested = request.seatsRequested || 1;

      // 3. Get current ride
      const ride = await Ride.findById(rideId);

      if (!ride) throw new Error("Ride not found");

      // 4. Reduce seats
      const updatedSeats = ride.availableSeats - seatsRequested;

      // 5. Decide status
      let updatedStatus = ride.status;
      if (updatedSeats <= 0) {
        updatedStatus = "FULL"; // or "CLOSED"
      }

      // 6. Update ride
      await Ride.findByIdAndUpdate(
        rideId,
        {
          availableSeats: updatedSeats,
          status: updatedStatus
        },
        { new: true }
      );
    }

    return request;
  } catch (err) {
    console.error(err);
    throw err;
  }
};


// Get single Ride
const getBookRideById = async (id) => {
  return await BookRide.findById(id);
}
const deleteBookRideService = async (userId) => {
  return await BookRide.findByIdAndDelete(userId);
}

export {
  createBookRideService,
  editBookRideService,
  getBookRideService,
  getBookRideById,
  getSentRequestsService,
  deleteBookRideService,
  statusBookRide
};