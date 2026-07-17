import mongoose from "mongoose";
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

// bookRide.service.js (or wherever editBookRideService lives)

const editBookRideService = async (requestId, updates) => {
  // 1. Load the existing request so we know which ride it belongs to
  //    and how many seats it currently holds
  const existingRequest = await BookRide.findById(requestId);
  if (!existingRequest) {
    throw new Error("Request not found");
  }

  // 2. Load the ride to check total seats
  const ride = await Ride.findById(existingRequest.rideId);
  if (!ride) {
    throw new Error("Ride not found");
  }

  // 3. Sum seats held by OTHER pending requests on this ride
  //    (exclude the request being edited, and cancelled/rejected ones)
  const otherRequests = await BookRide.find({
    rideId: ride._id,
    _id: { $ne: requestId },
    status: "PENDING",
  });

  const seatsHeldByOthers = otherRequests.reduce(
    (sum, r) => sum + (r.seatsRequested || 0),
    0
  );

  const seatsAvailableForThisEdit = ride.availableSeats - seatsHeldByOthers;

  // 4. THE CONDITION — this is the check you're asking about
  if (
    ride.modeOfTravel !== "Flight" &&
    Number(updates.seatsRequested) > seatsAvailableForThisEdit
  ) {
    throw new Error(
      `Only ${seatsAvailableForThisEdit} seat(s) available`
    );
  }

  // 5. Safe to update
  const updatedRequest = await BookRide.findByIdAndUpdate(
    requestId,
    updates,
    { new: true }
  );

  return updatedRequest;
};
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Update request
    const request = await BookRide.findByIdAndUpdate(
      requestId,
      { status: type === "Approve" ? "ACCEPTED" : "REJECTED" },
      { new: true, session }
    );

    if (!request) throw new Error("Request not found");

    // 2. Only proceed if approved
    if (type === "Approve") {
      const rideId = request.rideId;
      const seatsRequested = request.seatsRequested;

      // 3. Get current ride
      const ride = await Ride.findById(rideId).session(session);

      if (!ride) throw new Error("Ride not found");

      // 4. Reduce seats
      if (ride.availableSeats < seatsRequested) {
        throw new Error(seatsRequested + ` seats not available, ${ride.availableSeats} seats only left`);
      }
      const updatedSeats = ride.availableSeats - seatsRequested;

      // 5. Decide status
      let updatedStatus = ride.status;
      if (updatedSeats === 0) {
        updatedStatus = "FULL";
      }

      // 6. Update ride
      await Ride.findByIdAndUpdate(
        rideId,
        {
          availableSeats: updatedSeats,
          status: updatedStatus
        },
        { new: true, session }
      );

    }

    await session.commitTransaction();
    session.endSession();
    return request;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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