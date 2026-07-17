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

    const userRequests = await Bookride.find({
      rideId,
      requestedBy: data.requestedBy,
      status: "PENDING",
    });

    const alreadyRequestedSeats = userRequests.reduce(
      (total, req) => total + Number(req.seatsRequested || 0),
      0
    );

    const isFlight = ride.modeOfTravel === "Flight";

    if (!isFlight && userRequests?.status !== "PENDING") {
      const remainingSeats = Number(ride.availableSeats) - alreadyRequestedSeats;

      if (remainingSeats <= 0) {
        return res.status(400).json({
          success: false,
          message: "You have already requested all available seats.",
        });
      }

      if (Number(data.seatsRequested) > remainingSeats) {
        return res.status(400).json({
          success: false,
          message: `You can request only ${remainingSeats} more seat(s).`,
        });
      }
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
        from: ride.from,
        destination: ride.destination,
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

    if (!["Approve", "Reject"].includes(statusType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status type",
      });
    }

    const notifType =
      statusType === "Approve"
        ? "request_accepted"
        : "request_rejected";

    // 🔹 Your existing logic (this already reduces seat 👍)
    const rides = await statusBookRide(requestId, statusType);

    if (!rides) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    if (statusType === "Approve") {
      const ride = await Ride.findById(rides.rideId);

      if (ride && ride.availableSeats === 0) {
        const pendingRequests = await Bookride.find({
          rideId: ride._id,
          status: "PENDING",
        });

        await Bookride.updateMany(
          {
            rideId: ride._id,
            status: "PENDING",
          },
          {
            $set: { status: "REJECTED" },
          }
        );

        for (const req of pendingRequests) {
          const notif = buildNotification({ type: "request_rejected" });

          await createNotificationService({
            userId: req.requestedBy,
            actorId: req.rideOwner,
            type: "request_rejected",
            ...notif,
            data: {
              rideId: req.rideId,
              requestId: req._id,
            },
          });

          emitNotification(req.requestedBy.toString(), {
            type: "request_rejected",
            message: notif.message,
            data: {
              rideId: req.rideId,
              requestId: req._id,
            },
          });
        }
      }
    }

    // 🔔 Notification for current request
    const notif = buildNotification({ type: notifType });

    await createNotificationService({
      userId: rides.requestedBy,
      actorId: rides.rideOwner,
      type: notifType,
      ...notif,
      data: {
        rideId: rides.rideId,
        requestId: rides._id,
      },
    });

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const editBookride = async (req, res) => {
  try {
    const { id } = req.params;       // the request _id from the URL
    const updates = req.body;         // seatsRequested, membersCount, members, etc.

    const updatedRide = await editBookRideService(id, updates);

    res.status(200).json({
      success: true,
      data: updatedRide,
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
    const { requestId } = req.params;

    const ride = await deleteBookRideService(requestId);
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