// controller/ride.js
import { broadcastNotification, emitNotification } from "../../socket.js";
import BookRide from "../model/bookride.js";
import { buildNotification, createNotificationService } from "../service/notification.js";
import {
  createRideService,
  deleteRideService,
  getAllRideService,
  getMyRideCountsService,
  getRideById,
  updateRideService,
} from "../service/ride.js";
import Ride from "../model/ride.js";
import User from "../model/user.js";
import {
  isInUS,
  derivePublicLocationLabel,
} from "../utils/location.js";

/* ═════════════════════════════════════════════════════════════
   TC-1 helper — strip street address from responses when the
   viewer isn't the owner or an accepted passenger.
   ═════════════════════════════════════════════════════════════ */
const acceptedRideIdsFor = async (viewerId, rideIds) => {
  if (!viewerId || !rideIds?.length) return new Set();
  const ids = await BookRide.find({
    requestedBy: viewerId,
    status: { $in: ["ACCEPTED", "APPROVED"] },
    rideId: { $in: rideIds },
  }).distinct("rideId");
  return new Set(ids.map(String));
};

const sanitizeRideForViewer = (ride, viewerId, acceptedSet) => {
  if (!ride) return ride;

  const ownerId = String(ride.createdBy?._id || ride.createdBy || "");
  const viewerKey = String(viewerId || "");
  const isOwner = ownerId && viewerKey && ownerId === viewerKey;
  const isAccepted = acceptedSet?.has(String(ride._id));

  if (isOwner || isAccepted) return ride;

  const fromPublic =
    ride.fromPublic || derivePublicLocationLabel(ride.from);
  const destPublic =
    ride.destinationPublic || derivePublicLocationLabel(ride.destination);

  return {
    ...ride,
    from: fromPublic,
    destination: destPublic,
    fromLocation: ride.fromLocation
      ? { ...ride.fromLocation, address: fromPublic }
      : null,
    destinationLocation: ride.destinationLocation
      ? { ...ride.destinationLocation, address: destPublic }
      : null,
    exactPickup: "",
  };
};

/* ═════════════════════════════════════════════════════════════
   CREATE
   ═════════════════════════════════════════════════════════════ */
export const createRide = async (req, res) => {
  try {
    const { fromLocation, destinationLocation } = req.body;

    // ★ TC-4 — require coordinates
    if (
      fromLocation?.latitude == null ||
      fromLocation?.longitude == null ||
      destinationLocation?.latitude == null ||
      destinationLocation?.longitude == null
    ) {
      return res.status(400).json({
        success: false,
        message: "Pickup and destination coordinates are required.",
      });
    }

    // ★ TC-4 — geo-fence both endpoints via geocoder
    const [fromOk, toOk] = await Promise.all([
      isInUS(fromLocation.latitude, fromLocation.longitude),
      isInUS(destinationLocation.latitude, destinationLocation.longitude),
    ]);
    if (!fromOk || !toOk) {
      return res.status(400).json({
        success: false,
        message: "Rides must start and end within the United States.",
      });
    }

    // ★ TC-1 — persist public labels + isUS flag
    const ride = await createRideService({
      ...req.body,
      fromPublic:
        req.body.fromPublic || derivePublicLocationLabel(req.body.from || ""),
      destinationPublic:
        req.body.destinationPublic ||
        derivePublicLocationLabel(req.body.destination || ""),
      isUS: true,
    });

    if (ride) {
      const newRideUpdate = buildNotification({ type: "new_ride_added" });
      broadcastNotification({
        type: "new_ride_added",
        message: newRideUpdate.message,
        data: ride,
      });
    }

    return res.status(201).json({ success: true, data: ride });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/* ═════════════════════════════════════════════════════════════
   READ
   ═════════════════════════════════════════════════════════════ */
export const getRides = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication information is missing",
      });
    }

    const result = await getAllRideService({
      type: req.query.type || "find",
      category: req.query.category,
      userId,
      searchFrom: req.query.searchFrom,
      searchDestination: req.query.searchDestination,
      search: req.query.search,
      transportMode: req.query.transportMode,
      gender: req.query.gender,
      fuelSharing: req.query.fuelSharing,
      language: req.query.language,
      page: req.query.page || 1,
      limit: req.query.limit || 10,
    });

    // ★ TC-1 — sanitize for non-owner / non-accepted viewers
    const rideIds = result.rides.map((r) => r._id);
    const acceptedSet = await acceptedRideIdsFor(userId, rideIds);
    const data = result.rides.map((r) =>
      sanitizeRideForViewer(r, userId, acceptedSet)
    );

    return res.status(200).json({
      success: true,
      totalRides: result.totalRides,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
      data,
    });
  } catch (error) {
    console.error("GET RIDES ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyRideCounts = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication information is missing",
      });
    }
    const counts = await getMyRideCountsService({ userId });
    return res.status(200).json({ success: true, data: counts });
  } catch (error) {
    console.error("GET MY RIDE COUNTS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSingleRide = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const ride = await getRideById(id);
    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }
    // ★ TC-1 — same sanitize guard on single-ride read
    const acceptedSet = await acceptedRideIdsFor(userId, [ride._id]);
    const safe = sanitizeRideForViewer(ride, userId, acceptedSet);
    return res.status(200).json({ success: true, data: safe });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ═════════════════════════════════════════════════════════════
   UPDATE
   ═════════════════════════════════════════════════════════════ */
export const editRide = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    // ★ TC-4 — if either endpoint is supplied, verify it's US
    if (data.fromLocation || data.destinationLocation) {
      const [fromOk, toOk] = await Promise.all([
        data.fromLocation
          ? isInUS(data.fromLocation.latitude, data.fromLocation.longitude)
          : Promise.resolve(true),
        data.destinationLocation
          ? isInUS(
              data.destinationLocation.latitude,
              data.destinationLocation.longitude
            )
          : Promise.resolve(true),
      ]);
      if (!fromOk || !toOk) {
        return res.status(400).json({
          success: false,
          message: "Rides must start and end within the United States.",
        });
      }
    }

    // ★ TC-1 — refresh public labels when address changes
    if (data.from) {
      data.fromPublic =
        data.fromPublic || derivePublicLocationLabel(data.from);
    }
    if (data.destination) {
      data.destinationPublic =
        data.destinationPublic || derivePublicLocationLabel(data.destination);
    }
    data.isUS = true;

    const updatedRide = await updateRideService(id, data);
    if (!updatedRide) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const bookedRide = await BookRide.find({
      status: "ACCEPTED",
      rideId: updatedRide._id,
    });

    for (const booking of bookedRide) {
      emitNotification(booking.requestedBy, {
        type: "ride_status",
        message: `Your ride ${updatedRide.travelStatus} 🚀`,
        ride: {
          _id: updatedRide._id,
          from: updatedRide.fromPublic || updatedRide.from,
          destination:
            updatedRide.destinationPublic || updatedRide.destination,
          startTime: updatedRide.startTime,
          modeOfTravel: updatedRide.modeOfTravel,
        },
        data: {
          rideId: updatedRide._id,
          status: updatedRide.travelStatus,
        },
      });
    }

    return res.status(200).json({ success: true, data: updatedRide });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ═════════════════════════════════════════════════════════════
   DELETE / CANCEL / MISC
   ═════════════════════════════════════════════════════════════ */
export const deleteRide = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteRideService(id);
    return res.status(200).json({ status: true, message: "Ride Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserRides = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await getRideById(id);
    return res.status(200).json({ success: true, data: ride });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelRide = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedRide = await Ride.findByIdAndUpdate(
      id,
      { travelStatus: "Cancelled", status: "CANCELLED" }, // ★ TC-19 both fields
      { new: true }
    );

    if (!updatedRide) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const ReqLists = await BookRide.find({ status: "ACCEPTED", rideId: id });

    for (const Req of ReqLists) {
      const notifictioncreated = await createNotificationService({
        userId: Req.requestedBy,
        actorId: updatedRide.createdBy,
        type: "request_cancelled",
        message: "Your ride cancelled",
        data: {
          rideId: updatedRide._id,
          status: updatedRide.travelStatus,
          requestId: Req._id,
          from: updatedRide.fromPublic || updatedRide.from,
          destination:
            updatedRide.destinationPublic || updatedRide.destination,
        },
      });

      emitNotification(Req.requestedBy, {
        type: "ride_cancelled",
        message: "Your ride cancelled",
        category: "Ride Cancelled",
        ride: {
          _id: updatedRide._id,
          from: updatedRide.fromPublic || updatedRide.from,
          destination:
            updatedRide.destinationPublic || updatedRide.destination,
          startTime: updatedRide.startTime,
          modeOfTravel: updatedRide.modeOfTravel,
        },
        data: {
          _id: notifictioncreated._id,
          rideId: updatedRide._id,
          status: updatedRide.travelStatus,
        },
      });
    }

    return res.status(200).json({ success: true, message: "Ride Cancelled" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const checkActiveRide = async (req, res) => {
  try {
    const { userId } = req.params;
    const hasActiveRide = await checkActiveRideService(userId);
    return res.status(200).json({ success: true, hasActiveRide });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};