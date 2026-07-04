import {
  editBookRideService,
  deleteBookRideService,
  getBookRideService,
  getSentRequestsService,
  statusBookRide,
} from "../service/bookride.js";
import { emitNotification, getIO } from "../../socket.js";

import Ride from "../model/ride.js";
import Bookride from "../model/bookride.js"
import { buildNotification, createNotificationService } from "../service/notification.js";

const requestRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const data = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    if (ride.createdBy.toString() === data.requestedBy.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot request your own ride",
      });
    }

    const existingRequest = await Bookride.findOne({
      rideId,
      requestedBy: data.requestedBy,
      status: "PENDING",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already requested this ride",
      });
    }

    const isFlight = ride.modeOfTravel === "Flight";

    if (!isFlight && Number(data.seatsRequested) > Number(ride.availableSeats)) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.availableSeats} seat(s) available`,
      });
    }

    const bookingData = await Bookride.create({
      ...data,
      rideId,
      rideOwner: ride.createdBy,
      requestedBy: data.requestedBy,
    });

    const actorName = data.firstName;

    const notif = buildNotification({
      type: "new_request",
      actorName,
    });

    await createNotificationService({
      userId: ride.createdBy,
      actorId: data.requestedBy,
      type: "new_request",
      ...notif,
      data: {
        rideId,
        requestId: bookingData._id,
      },
    });

    emitNotification(ride.createdBy.toString(), {
      type: "new_request",
      message: notif.message,
      data: {
        rideId,
        requestId: bookingData._id,
      },
    });

    res.status(201).json({
      success: true,
      message: isFlight
        ? "Companion request sent successfully"
        : "Seat request sent successfully",
      data: bookingData,
    });

  } catch (error) {
    console.log("requestRide error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getBookride = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query; // NEW

    const rides = await getBookRideService(userId, type);

    res.status(200).json({
      success: true,
      totalRides: rides.length,
      data: rides,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getBookrideSend = async (req, res) => {
  try {
    const { userId } = req.params;

    const requests = await getSentRequestsService(userId);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const statusBookride = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { type: statusType } = req.query;

    console.log(statusType,'statusType')

    if (!["Approve", "Reject"].includes(statusType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status type",
      });
    }

    // ✅ decide notification type FIRST
    const notifType =
      statusType === "Approve"
        ? "request_accepted"
        : "request_rejected";

    // ✅ update booking
    const rides = await statusBookRide(requestId, statusType);

    if (!rides) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    // ✅ build notification
    const notif = buildNotification({ type: notifType });

    // ✅ save notification
    await createNotificationService({
      userId: rides.requestedBy,     // 👈 requester
      actorId: rides.rideOwner,      // 👈 ride owner
      type: notifType,
      ...notif,
      data: {
        rideId: rides.rideId,
        requestId: rides._id,
      },
    });

    // ✅ realtime notification
    emitNotification(rides.requestedBy.toString(), {
      type: notifType,
      message: notif.message,
      data: {
        rideId: rides.rideId,
        requestId: rides._id,
      },
    });

    res.status(200).json({
      success: true,
      message:
        statusType === "Approve"
          ? "Ride request accepted"
          : "Ride request rejected",
      data: rides,
    });

  } catch (error) {
    console.error("statusBookride error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update ride request",
    });
  }
};

const editBookride = async (req, res) => {
  try {
    const rides = await editBookRideService();

    res.status(200).json({
      success: true,
      totalRides: rides.length,
      data: rides,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteBookride = async (req, res) => {
  try {
    const { userId } = req.params;

    const ride = await deleteBookRideService(userId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride request not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ride request deleted successfully",
      data: ride,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export {
  requestRide,
  getBookride,
  editBookride,
  deleteBookride,
  getBookrideSend,
  statusBookride,
};