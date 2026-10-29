import mongoose from "mongoose";
import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js";

/* ─────────────────────────────────────────────────────────────
   Signed-URL helper for user objects
   ───────────────────────────────────────────────────────────── */
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;

  const userData =
    typeof user.toObject === "function" ? user.toObject() : { ...user };

  if (!("profileImage" in userData)) return userData;

  try {
    return {
      ...userData,
      profileImageUrl: userData.profileImage
        ? await getProfileImageSignedUrl(userData.profileImage)
        : null,
    };
  } catch (err) {
    console.error("[BOOKRIDE][SIGN_FAILED]", err.message);
    return { ...userData, profileImageUrl: null };
  }
};

/* Sign every user ref inside a single booking */
const addBookRideImageUrls = async (booking) => {
  if (!booking) return booking;

  const data =
    typeof booking.toObject === "function" ? booking.toObject() : { ...booking };

  const requestedBy = await addProfileImageUrl(data.requestedBy);

  let rideId = data.rideId;
  if (rideId && typeof rideId === "object") {
    const rideData =
      typeof rideId.toObject === "function" ? rideId.toObject() : { ...rideId };

    const [createdBy, actualDriver] = await Promise.all([
      addProfileImageUrl(rideData.createdBy),
      addProfileImageUrl(rideData.actualDriver),
    ]);

    rideId = { ...rideData, createdBy, actualDriver };
  }

  return { ...data, requestedBy, rideId };
};

const addBookRideImageUrlsToList = async (list) =>
  Promise.all((list || []).map(addBookRideImageUrls));

/* ─────────────────────────────────────────────────────────────
   Create
   ───────────────────────────────────────────────────────────── */
const createBookRideService = async (data) => {
  return await BookRide.create(data);
};

/* ─────────────────────────────────────────────────────────────
   Sent requests (fully populated + signed)
   ───────────────────────────────────────────────────────────── */
const getSentRequestsService = async (userId) => {
  const bookings = await BookRide.find({ requestedBy: userId })
    .populate({
      path: "rideId",
      populate: [
        {
          path: "createdBy",
          select: "firstName lastName email profileImage",
        },
        {
          path: "actualDriver",
          select: "firstName lastName profileImage zipcode language",
        },
      ],
    })
    .populate("requestedBy", "firstName lastName email profileImage")
    .sort({ createdAt: -1 })
    .lean();

  return addBookRideImageUrlsToList(bookings);
};

/* ─────────────────────────────────────────────────────────────
   Edit
   ───────────────────────────────────────────────────────────── */
const editBookRideService = async (requestId, updates) => {
  const existingRequest = await BookRide.findById(requestId);
  if (!existingRequest) throw new Error("Request not found");

  const ride = await Ride.findById(existingRequest.rideId);
  if (!ride) throw new Error("Ride not found");

  const newPendingMembers = Array.isArray(updates.pendingMembers)
    ? updates.pendingMembers
    : existingRequest.pendingMembers || [];

  const approvedCount = existingRequest.members?.length || 0;
  const pendingCount = newPendingMembers.length;
  const totalMembersCount = approvedCount + pendingCount;

  const pendingReqSeats =
    existingRequest.status === "ACCEPTED" ? pendingCount : totalMembersCount;

  const finalUpdates = {
    ...updates,
    pendingMembers: newPendingMembers,
    membersCount: totalMembersCount,
    seatsRequested: totalMembersCount,
    pendingReqSeats,
  };

  delete finalUpdates.members;

  const updatedRequest = await BookRide.findByIdAndUpdate(
    requestId,
    finalUpdates,
    { new: true },
  )
    .populate("requestedBy", "firstName lastName email profileImage")
    .populate({
      path: "rideId",
      populate: [
        {
          path: "createdBy",
          select: "firstName lastName email profileImage",
        },
        {
          path: "actualDriver",
          select: "firstName lastName profileImage zipcode language",
        },
      ],
    })
    .lean();

  return addBookRideImageUrls(updatedRequest);
};

/* ─────────────────────────────────────────────────────────────
   Get list — ★ both branches now populate + sign
   ───────────────────────────────────────────────────────────── */
const getBookRideService = async (userId, type) => {
  if (type === "requested") {
    const bookings = await BookRide.find({ requestedBy: userId })
      .populate({
        path: "rideId",
        populate: [
          {
            path: "createdBy",
            select: "firstName lastName email profileImage",
          },
          {
            path: "actualDriver",
            select: "firstName lastName profileImage zipcode language",
          },
        ],
      })
      .populate("requestedBy", "firstName lastName email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    return addBookRideImageUrlsToList(bookings);
  }

  if (type === "received") {
    const bookings = await BookRide.find({ rideOwner: userId })
      .populate({
        path: "rideId",
        populate: [
          {
            path: "createdBy",
            select: "firstName lastName email profileImage",
          },
          {
            path: "actualDriver",
            select: "firstName lastName profileImage zipcode language",
          },
        ],
      })
      .populate("requestedBy", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .lean();

    return addBookRideImageUrlsToList(bookings);
  }

  return [];
};

/* ─────────────────────────────────────────────────────────────
   Status update (unchanged — no images in return)
   ───────────────────────────────────────────────────────────── */
const statusBookRide = async (requestId, type) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const rideRequested = await BookRide.findById(requestId).session(session);
    if (!rideRequested) throw new Error("Request not found");

    let status;
    let approvedSeats = rideRequested.approvedSeats || 0;
    let rejectedSeats = rideRequested.rejectedSeats || 0;
    let pendingReqSeats = rideRequested.pendingReqSeats || 0;
    let members = rideRequested.members || [];
    let pendingMembers = rideRequested.pendingMembers || [];
    let seatsRequested = rideRequested.seatsRequested || 0;
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
      status = approvedSeats > 0 ? "ACCEPTED" : "REJECTED";
      if (pendingReqSeats > 0) rejectedSeats += pendingReqSeats;
      pendingReqSeats = 0;
      pendingMembers = [];
      seatsRequested = 0;
    } else if (type === "Cancel") {
      status = "CANCELLED";
      pendingReqSeats = 0;
      seatsRequested = 0;
    }

    const request = await BookRide.findByIdAndUpdate(
      requestId,
      { status, approvedSeats, rejectedSeats, pendingReqSeats, members, pendingMembers },
      { new: true, session },
    );

    if (!request) throw new Error("Request not found");

    if (type === "Approve" && newlyApprovedSeats > 0) {
      const rideId = request.rideId;
      const ride = await Ride.findById(rideId).session(session);
      if (!ride) throw new Error("Ride not found");

      if (ride.availableSeats < newlyApprovedSeats) {
        throw new Error(
          `${newlyApprovedSeats} seats not available, ${ride.availableSeats} seats only left`,
        );
      }

      const updatedSeats = ride.availableSeats - newlyApprovedSeats;
      const updatedStatus = updatedSeats === 0 ? "FULL" : ride.status;

      await Ride.findByIdAndUpdate(
        rideId,
        { availableSeats: updatedSeats, status: updatedStatus },
        { new: true, session },
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

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
const statusBookRideService = async (requestId, statusType) => {
  const bookingRequest = await BookRide.findById(requestId);
  if (!bookingRequest) throw new Error("Request not found");

  if (statusType === "Approve") bookingRequest.status = "ACCEPTED";
  else if (statusType === "Reject") bookingRequest.status = "REJECTED";
  else if (statusType === "Cancel") bookingRequest.status = "CANCELLED";

  await bookingRequest.save();
  return bookingRequest;
};

const getBookRideById = async (id) => {
  return await BookRide.findById(id);
};

const deleteBookRideService = async (id) => {
  return await BookRide.findByIdAndDelete(id);
};

export {
  createBookRideService,
  editBookRideService,
  getBookRideService,
  getBookRideById,
  statusBookRideService,
  getSentRequestsService,
  deleteBookRideService,
  statusBookRide,
  addBookRideImageUrls, // ← export so the controller can use it after status updates
};