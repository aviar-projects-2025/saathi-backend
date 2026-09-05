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

/**
 * Edits a booking request.
 *
 * IMPORTANT (per schema):
 * - `members` = already APPROVED members. This function never lets the
 *   client overwrite it directly — approval only happens in statusBookRide.
 * - `pendingMembers` = members awaiting approval. This IS editable here —
 *   it's replaced wholesale with whatever the client sends.
 * - `membersCount` / `seatsRequested` / `pendingReqSeats` are always
 *   derived server-side from the actual array lengths, never trusted
 *   from the client, so they can never drift out of sync with the data.
 */
const editBookRideService = async (requestId, updates) => {
  const existingRequest = await BookRide.findById(requestId);
  if (!existingRequest) {
    throw new Error("Request not found");
  }

  const ride = await Ride.findById(existingRequest.rideId);
  if (!ride) {
    throw new Error("Ride not found");
  }

  // Only pendingMembers can be edited here. Fall back to the existing
  // pending list if the client didn't send one.
  const newPendingMembers = Array.isArray(updates.pendingMembers)
    ? updates.pendingMembers
    : existingRequest.pendingMembers || [];

  const approvedCount = existingRequest.members?.length || 0;
  const pendingCount = newPendingMembers.length;
  const totalMembersCount = approvedCount + pendingCount;

  // pendingReqSeats = seats that still need owner approval.
  // For an already-ACCEPTED request, that's just the pending (new) ones.
  // For a still-PENDING request, the whole thing is pending.
  const pendingReqSeats =
    existingRequest.status === "ACCEPTED" ? pendingCount : totalMembersCount;

  const finalUpdates = {
    ...updates,
    pendingMembers: newPendingMembers,
    membersCount: totalMembersCount,
    seatsRequested: totalMembersCount,
    pendingReqSeats,
  };

  // Never allow a client-supplied `members` array to overwrite the
  // approved list — that can only change via statusBookRide.
  delete finalUpdates.members;

  const updatedRequest = await BookRide.findByIdAndUpdate(
    requestId,
    finalUpdates,
    { new: true }
  ).populate("requestedBy", "firstName lastName email profileImage")
    .populate({
      path: "rideId",
      populate: {
        path: "createdBy",
        select: "firstName lastName email profileImage",
      },
    });

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
    })
      .populate({
        path: "rideId",
        populate: {
          path: "createdBy",
          select: "firstName lastName email profileImage",
        },
      })
      .populate('requestedBy', 'firstName lastName profileImage');
  }

  return [];
};

const statusBookRide = async (requestId, type) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {

    const rideRequested = await BookRide.findById(requestId).session(session);
    if (!rideRequested) {
      throw new Error("Request not found");
    }

    let status;
    let approvedSeats = rideRequested.approvedSeats || 0;
    let rejectedSeats = rideRequested.rejectedSeats || 0;
    let pendingReqSeats = rideRequested.pendingReqSeats || 0;
    let members = rideRequested.members || [];
    let pendingMembers = rideRequested.pendingMembers || [];
    let seatsRequested = rideRequested.seatsRequested || 0;

    // Track exactly how many *new* seats get approved in this call, so we
    // only ever deduct that delta from the ride — never the cumulative total.
    let newlyApprovedSeats = 0;

    if (type === "Approve") {
      status = "ACCEPTED";

      if (pendingReqSeats > 0) {
        newlyApprovedSeats = pendingReqSeats;

        approvedSeats += pendingReqSeats;
        pendingReqSeats = 0;

        members = [...members, ...pendingMembers];
        pendingMembers = [];
      }

    } else if (type === "Reject") {
      // Reject the pending seats
      status = approvedSeats > 0 ? "ACCEPTED" : "REJECTED";

      if (pendingReqSeats > 0) {
        rejectedSeats += pendingReqSeats;
      }

      pendingReqSeats = 0;
      pendingMembers = [];
      seatsRequested = 0;

    } else if (type === "Cancel") {
      status = "CANCELLED";
      pendingReqSeats = 0;
      // pendingMembers = [];
      seatsRequested = 0;
      // membersCount=0;
    }

    const request = await BookRide.findByIdAndUpdate(
      requestId,
      {
        status,
        approvedSeats,
        rejectedSeats,
        pendingReqSeats,
        members,
        pendingMembers,
      },
      { new: true, session }
    );

    if (!request) throw new Error("Request not found");

    // Only touch the ride's seat count if something was actually
    // newly approved in this call.
    if (type === "Approve" && newlyApprovedSeats > 0) {
      const rideId = request.rideId;

      const ride = await Ride.findById(rideId).session(session);
      if (!ride) throw new Error("Ride not found");

      if (ride.availableSeats < newlyApprovedSeats) {
        throw new Error(
          `${newlyApprovedSeats} seats not available, ${ride.availableSeats} seats only left`
        );
      }

      const updatedSeats = ride.availableSeats - newlyApprovedSeats;

      let updatedStatus = ride.status;
      if (updatedSeats === 0) {
        updatedStatus = "FULL";
      }

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