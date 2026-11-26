// service/ride.js
import mongoose from "mongoose";
import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";
import User from "../model/user.js";
import { getProfileImageSignedUrl } from "../controller/s3Controller.js";
import { derivePublicLocationLabel } from "../utils/location.js";

export const createRideService = async (data) => {
  return await Ride.create(data);
};

/* ──────────────────────────────────────────────────────────
   TC-1: backfill public labels on every read (legacy safety)
   TC-19: enrich with derived properties used by card renderers
   ────────────────────────────────────────────────────────── */
const enrichRide = (ride) => {
  if (!ride) return ride;
  return {
    ...ride,
    fromPublic: ride.fromPublic || derivePublicLocationLabel(ride.from),
    destinationPublic:
      ride.destinationPublic || derivePublicLocationLabel(ride.destination),
  };
};

const fetchMyRideCategory = async ({ query, pageNumber, limitNumber, skip, sort }) => {
  // ★ TC-4: never return non-US rides even if isUS is missing (legacy)
  const safeQuery = {
    $and: [
      query,
      { $or: [{ isUS: true }, { isUS: { $exists: false } }] },
    ],
  };

  const totalRides = await Ride.countDocuments(safeQuery);

  const rides = await Ride.find(safeQuery)
    .populate("createdBy", "firstName lastName profileImage zipcode language")
    .populate("actualDriver", "firstName lastName profileImage zipcode language")
    .sort(sort)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const enriched = rides.map(enrichRide);
  const ridesWithImageUrls = await addRideProfileImageUrlsToList(enriched);

  return {
    rides: ridesWithImageUrls,
    totalRides,
    page: pageNumber,
    limit: limitNumber,
    hasMore: skip + rides.length < totalRides,
  };
};

const getMyRidesCategory = async ({ category, userObjectId, pageNumber, limitNumber, skip }) => {
  const allowedCategories = ["current", "upcoming", "posts", "history"];
  if (!allowedCategories.includes(category)) throw new Error("Invalid My Rides category");

  const now = new Date();

  const acceptedRideIds = await BookRide.find({
    requestedBy: userObjectId,
    status: "ACCEPTED",
  }).distinct("rideId");

  const endedRequestRideIds = await BookRide.find({
    requestedBy: userObjectId,
    status: { $in: ["CANCELLED", "REJECTED", "AUTO_REJECTED"] },
  }).distinct("rideId");

  const nonHelpRequestFilter = {};

  // MY POSTS — active only, no Expired
  if (category === "posts") {
    return fetchMyRideCategory({
      query: {
        $and: [
          { createdBy: userObjectId },
          nonHelpRequestFilter,
          { travelStatus: { $nin: ["Expired"] } }, // ★ TC-19
        ],
      },
      pageNumber,
      limitNumber,
      skip,
      sort: { startTime: -1 },
    });
  }

  const participantFilter = {
    $or: [
      { createdBy: userObjectId },
      { actualDriver: userObjectId },
      { _id: { $in: acceptedRideIds } },
    ],
  };

  if (category === "current") {
    return fetchMyRideCategory({
      query: {
        $and: [
          nonHelpRequestFilter,
          participantFilter,
          { startTime: { $lte: now } },
          { travelStatus: { $in: ["Waiting", "Started", "Ongoing"] } },
        ],
      },
      pageNumber,
      limitNumber,
      skip,
      sort: { startTime: 1 },
    });
  }

  if (category === "upcoming") {
    return fetchMyRideCategory({
      query: {
        $and: [
          nonHelpRequestFilter,
          participantFilter,
          { startTime: { $gt: now } },
          { travelStatus: { $nin: ["Completed", "Cancelled", "Expired"] } }, // ★ TC-19
        ],
      },
      pageNumber,
      limitNumber,
      skip,
      sort: { startTime: 1 },
    });
  }

  if (category === "history") {
    return fetchMyRideCategory({
      query: {
        $and: [
          nonHelpRequestFilter,
          {
            $or: [
              { createdBy: userObjectId, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } },   // ★ TC-19
              { actualDriver: userObjectId, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } },// ★ TC-19
              { _id: { $in: acceptedRideIds }, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } }, // ★ TC-19
              { _id: { $in: endedRequestRideIds } },
            ],
          },
        ],
      },
      pageNumber,
      limitNumber,
      skip,
      sort: { startTime: -1 },
    });
  }
};

export const getAllRideService = async ({
  type = "find",
  category,
  userId,
  searchFrom,
  searchDestination,
  search,
  transportMode,
  gender,
  fuelSharing,
  language,
  page = 1,
  limit = 10,
}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const skip = (pageNumber - 1) * limitNumber;

  if (type === "my") {
    return await getMyRidesCategory({
      category,
      userObjectId,
      pageNumber,
      limitNumber,
      skip,
    });
  }

  // ---------------- FIND RIDES ----------------
  const conditions = [];

  conditions.push({ createdBy: { $ne: userObjectId } });
  conditions.push({ startTime: { $gt: new Date() } });
  conditions.push({ status: { $in: ["OPEN", "FULL"] } });
  conditions.push({ status: { $nin: ["EXPIRED", "COMPLETED", "CANCELLED", "CLOSED"] } });
  conditions.push({ travelStatus: { $ne: "Cancelled" } });
  conditions.push({ travelStatus: { $ne: "Expired" } });
  conditions.push({ isUS: true }); // ★ TC-4: only US rides in the feed

  if (searchFrom?.trim()) {
    const value = searchFrom.trim();
    conditions.push({
      $or: [
        { from: { $regex: value, $options: "i" } },
        { fromPublic: { $regex: value, $options: "i" } },
        { fromAirport: { $regex: value, $options: "i" } },
        { fromCountry: { $regex: value, $options: "i" } },
      ],
    });
  }

  if (searchDestination?.trim()) {
    const value = searchDestination.trim();
    conditions.push({
      $or: [
        { destination: { $regex: value, $options: "i" } },
        { destinationPublic: { $regex: value, $options: "i" } },
        { toAirport: { $regex: value, $options: "i" } },
        { toCountry: { $regex: value, $options: "i" } },
      ],
    });
  }

  if (search?.trim()) {
    const searchText = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { firstName: { $regex: searchText, $options: "i" } },
        { lastName: { $regex: searchText, $options: "i" } },
      ],
    }).select("_id");
    const matchingUserIds = matchingUsers.map((user) => user._id);

    const generalSearchConditions = [
      { from: { $regex: searchText, $options: "i" } },
      { destination: { $regex: searchText, $options: "i" } },
      { fromPublic: { $regex: searchText, $options: "i" } },
      { destinationPublic: { $regex: searchText, $options: "i" } },
      { fromAirport: { $regex: searchText, $options: "i" } },
      { destinationAirport: { $regex: searchText, $options: "i" } },
      { toAirport: { $regex: searchText, $options: "i" } },
      { airlineName: { $regex: searchText, $options: "i" } },
      { flightNumber: { $regex: searchText, $options: "i" } },
    ];
    if (matchingUserIds.length > 0) {
      generalSearchConditions.push({ createdBy: { $in: matchingUserIds } });
    }
    conditions.push({ $or: generalSearchConditions });
  }

  if (transportMode?.trim()) conditions.push({ modeOfTravel: transportMode.trim() });
  if (gender?.trim()) conditions.push({ genderPreference: gender.trim() });

  if (fuelSharing !== undefined && fuelSharing !== "") {
    const fuelValue = fuelSharing === "true";
    conditions.push({
      $or: [{ modeOfTravel: "Flight" }, { fuelSharing: fuelValue }],
    });
  }

  if (language?.trim()) conditions.push({ language: { $regex: language.trim(), $options: "i" } });

  const query = { $and: conditions };
  const totalRides = await Ride.countDocuments(query);

  const rides = await Ride.find(query)
    .populate("createdBy", "firstName lastName profileImage zipcode language")
    .populate("actualDriver", "firstName lastName profileImage zipcode language")
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  const enriched = rides.map(enrichRide);
  const ridesWithImageUrls = await addRideProfileImageUrlsToList(enriched);

  return {
    rides: ridesWithImageUrls,
    totalRides,
    page: pageNumber,
    limit: limitNumber,
    hasMore: skip + rides.length < totalRides,
  };
};

export const getMyRideCountsService = async ({ userId }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const acceptedRideIds = await BookRide.find({
    requestedBy: userObjectId,
    status: "ACCEPTED",
  }).distinct("rideId");

  const endedRequestRideIds = await BookRide.find({
    requestedBy: userObjectId,
    status: { $in: ["CANCELLED", "REJECTED", "AUTO_REJECTED"] },
  }).distinct("rideId");

  const nonHelpRequestFilter = {};
  const usFilter = { $or: [{ isUS: true }, { isUS: { $exists: false } }] };

  const participantFilter = {
    $or: [
      { createdBy: userObjectId },
      { actualDriver: userObjectId },
      { _id: { $in: acceptedRideIds } },
    ],
  };

  const currentQuery = {
    $and: [
      nonHelpRequestFilter,
      usFilter,
      participantFilter,
      { startTime: { $lte: now } },
      { travelStatus: { $in: ["Waiting", "Started", "Ongoing"] } },
    ],
  };

  const upcomingQuery = {
    $and: [
      nonHelpRequestFilter,
      usFilter,
      participantFilter,
      { startTime: { $gt: now } },
      { travelStatus: { $nin: ["Completed", "Cancelled", "Expired"] } },
    ],
  };

  const postsQuery = {
    $and: [
      { createdBy: userObjectId },
      nonHelpRequestFilter,
      usFilter,
      { travelStatus: { $nin: ["Expired"] } },
    ],
  };

  const historyQuery = {
    $and: [
      nonHelpRequestFilter,
      usFilter,
      {
        $or: [
          { createdBy: userObjectId, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } },
          { actualDriver: userObjectId, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } },
          { _id: { $in: acceptedRideIds }, travelStatus: { $in: ["Completed", "Cancelled", "Expired"] } },
          { _id: { $in: endedRequestRideIds } },
        ],
      },
    ],
  };

  const [current, upcoming, posts, history] = await Promise.all([
    Ride.countDocuments(currentQuery),
    Ride.countDocuments(upcomingQuery),
    Ride.countDocuments(postsQuery),
    Ride.countDocuments(historyQuery),
  ]);

  return { current, upcoming, posts, history };
};

/* ═════════════════════════════════════════════════════════════
   SINGLE / DELETE / UPDATE
   ═════════════════════════════════════════════════════════════ */
export const getRideById = async (id) => {
  const ride = await Ride.findById(id)
    .populate("createdBy", "firstName lastName profileImage zipcode language")
    .populate("actualDriver", "firstName lastName profileImage zipcode language");

  if (!ride) return null;
  const lean = typeof ride.toObject === "function" ? ride.toObject() : ride;
  return addRideProfileImageUrls(enrichRide(lean));
};

export const deleteRideService = async (id) => {
  return await Ride.findByIdAndDelete(id);
};

export const updateRideService = async (id, data) => {
  // ★ TC-19: block edits on expired rides
  const current = await Ride.findById(id).select("travelStatus status").lean();
  if (current?.travelStatus === "Expired" || current?.status === "EXPIRED") {
    throw new Error("This ride has expired and can no longer be edited.");
  }

  await BookRide.updateMany(
    { rideId: id, status: "PENDING" },
    { status: "AUTO_REJECTED" }
  );

  // ★ TC-19: keep `status` in sync with `travelStatus`
  const derivedStatus =
    data.travelStatus === "Completed"
      ? "COMPLETED"
      : data.travelStatus === "Cancelled"
        ? "CANCELLED"
        : data.travelStatus === "Expired"
          ? "EXPIRED"
          : undefined;

  const patch = { ...data };
  if (derivedStatus) patch.status = derivedStatus;

  const existingRide = await Ride.findById(id);
  const updatedRide = await Ride.findByIdAndUpdate(id, patch, { new: true });

  if (
    existingRide.travelStatus !== "Completed" &&
    updatedRide?.travelStatus === "Completed"
  ) {
    await User.findByIdAndUpdate(updatedRide.createdBy, {
      $inc: { completedRideCount: 1 },
    });
  }

  return updatedRide;
};

/* ═════════════════════════════════════════════════════════════
   HELPERS
   ═════════════════════════════════════════════════════════════ */
const addProfileImageUrl = async (user) => {
  if (!user || typeof user !== "object") return user;
  const userData =
    typeof user.toObject === "function" ? user.toObject() : { ...user };
  if (!userData.profileImage) {
    return { ...userData, profileImageUrl: null };
  }
  try {
    return {
      ...userData,
      profileImageUrl: await getProfileImageSignedUrl(userData.profileImage),
    };
  } catch (error) {
    console.error("Failed to sign profile image URL:", error.message);
    return { ...userData, profileImageUrl: null };
  }
};

const addRideProfileImageUrls = async (ride) => {
  if (!ride) return ride;
  const rideData =
    typeof ride.toObject === "function" ? ride.toObject() : { ...ride };
  const [createdBy, actualDriver] = await Promise.all([
    addProfileImageUrl(rideData.createdBy),
    addProfileImageUrl(rideData.actualDriver),
  ]);
  return { ...rideData, createdBy, actualDriver };
};

const addRideProfileImageUrlsToList = async (rides) =>
  Promise.all(rides.map(addRideProfileImageUrls));