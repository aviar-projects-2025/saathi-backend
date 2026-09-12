import {
  editBookRideService,
  statusBookRideService,
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
      pendingReqSeats: data.seatsRequested,
      rideOwner: ride.createdBy,
      requestedBy: data.requestedBy,
    });

    const populatedBooking = await Bookride.findById(bookingData._id)
      .populate("requestedBy", "firstName lastName profileImage email");

    const actorName = data.firstName;

    const notif = buildNotification({
      type: "new_request",
      actorName,
    });

    const notifictioncreated = await createNotificationService({
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
      category: notif.title,
      data: {
        bookingData,
        _id: notifictioncreated._id,
        rideId,
        profileImage: populatedBooking?.requestedBy?.profileImage,
        requestBy: populatedBooking,
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

    if (!["Approve", "Reject", "Cancel"].includes(statusType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status type",
      });
    }

    // ==================================================
    // GET CURRENT BOOKING REQUEST
    // ==================================================
    const bookingRequest = await Bookride.findById(requestId);

    if (!bookingRequest) {
      return res.status(404).json({
        success: false,
        message: "Booking request not found",
      });
    }

    // ==================================================
    // GET RIDE
    // ==================================================
    const ride = await Ride.findById(bookingRequest.rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    // ==================================================
    // CURRENT REQUEST VALUES
    // ==================================================
    const previousStatus = bookingRequest.status;
    const currentApprovedSeats = Number(bookingRequest.approvedSeats || 0);
    const currentPendingSeats = Number(bookingRequest.pendingReqSeats || 0);
    const currentRejectedSeats = Number(bookingRequest.rejectedSeats || 0);

    // ==================================================
    // PREVENT DUPLICATE REJECT / CANCEL
    // ==================================================
    if (previousStatus === "REJECTED" && statusType === "Reject") {
      return res.status(400).json({
        success: false,
        message: "Request is already rejected",
      });
    }

    if (previousStatus === "CANCELLED" && statusType === "Cancel") {
      return res.status(400).json({
        success: false,
        message: "Request is already cancelled",
      });
    }


    const hasPendingSeats = currentPendingSeats > 0;

    if (statusType === "Approve") {
      if (!hasPendingSeats) {
        return res.status(400).json({
          success: false,
          message: "No pending seats available to approve",
        });
      }

      const seatsToApprove = currentPendingSeats;
      const availableSeats = Number(ride.availableSeats || 0);

      if (availableSeats < seatsToApprove) {
        return res.status(400).json({
          success: false,
          message: "Not enough available seats",
        });
      }

      bookingRequest.approvedSeats = currentApprovedSeats + seatsToApprove;
      bookingRequest.pendingReqSeats = 0;
      bookingRequest.seatsRequested = Math.max(
        bookingRequest.approvedSeats,
        1
      );

      const pendingMembers = bookingRequest.pendingMembers || [];
      bookingRequest.members = [
        ...(bookingRequest.members || []),
        ...pendingMembers,
      ];
      bookingRequest.pendingMembers = [];
      bookingRequest.status = "ACCEPTED";

      await bookingRequest.save();

      ride.availableSeats = availableSeats - seatsToApprove;
      if (ride.status !== "CANCELLED" && ride.status !== "CLOSED") {
        ride.status = ride.availableSeats > 0 ? "OPEN" : "FULL";
      }
      await ride.save();
    }

    // ==================================================
    // REJECT
    // ==================================================
    else if (statusType === "Reject") {

      if (hasPendingSeats) {
        const seatsToReject = currentPendingSeats;

        bookingRequest.rejectedSeats = currentRejectedSeats + seatsToReject;
        bookingRequest.pendingReqSeats = 0;
        bookingRequest.pendingMembers = [];

        bookingRequest.status =
          currentApprovedSeats > 0 ? "ACCEPTED" : "REJECTED";

        bookingRequest.seatsRequested = Math.max(
          currentApprovedSeats + seatsToReject,
          1
        );

        await bookingRequest.save();

        ride.rejectedSeats = Number(ride.rejectedSeats || 0) + seatsToReject;
        await ride.save();
      }

      else if (previousStatus === "ACCEPTED" && currentApprovedSeats > 0) {
        const seatsToReject = currentApprovedSeats;

        bookingRequest.approvedSeats = 0;
        bookingRequest.rejectedSeats = currentRejectedSeats + seatsToReject;
        bookingRequest.pendingReqSeats = 0;
        bookingRequest.members = [];
        bookingRequest.pendingMembers = [];
        bookingRequest.seatsRequested = Math.max(seatsToReject, 1);
        bookingRequest.status = "REJECTED";

        await bookingRequest.save();

        ride.availableSeats = Number(ride.availableSeats || 0) + seatsToReject;
        ride.rejectedSeats = Number(ride.rejectedSeats || 0) + seatsToReject;

        if (ride.status !== "CANCELLED" && ride.status !== "CLOSED") {
          ride.status = ride.availableSeats > 0 ? "OPEN" : "FULL";
        }
        await ride.save();
      } else {
        return res.status(400).json({
          success: false,
          message: `Cannot reject request with status ${previousStatus}`,
        });
      }
    }

    else if (statusType === "Cancel") {
      // Same principle as Reject: pending seats first.
      if (hasPendingSeats) {
        const seatsToCancel = currentPendingSeats;

        bookingRequest.pendingReqSeats = 0;
        bookingRequest.pendingMembers = [];
        bookingRequest.status =
          currentApprovedSeats > 0 ? "ACCEPTED" : "CANCELLED";
        bookingRequest.seatsRequested = Math.max(
          currentApprovedSeats + seatsToCancel,
          1
        );

        await bookingRequest.save();
      } else if (previousStatus === "ACCEPTED" && currentApprovedSeats > 0) {
        const seatsToReturn = currentApprovedSeats;

        bookingRequest.approvedSeats = 0;
        bookingRequest.pendingReqSeats = 0;
        bookingRequest.members = [];
        bookingRequest.pendingMembers = [];
        bookingRequest.seatsRequested = Math.max(seatsToReturn, 1);
        bookingRequest.status = "CANCELLED";

        await bookingRequest.save();

        ride.availableSeats = Number(ride.availableSeats || 0) + seatsToReturn;
        if (ride.status !== "CANCELLED" && ride.status !== "CLOSED") {
          ride.status = ride.availableSeats > 0 ? "OPEN" : "FULL";
        }
        await ride.save();
      } else {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel request with status ${previousStatus}`,
        });
      }
    }

    // ==================================================
    // CALCULATE TOTALS FOR SAME USER + SAME RIDE
    // ==================================================
    const summary = await Bookride.aggregate([
      {
        $match: {
          requestedBy: bookingRequest.requestedBy,
          rideId: bookingRequest.rideId,
        },
      },
      {
        $group: {
          _id: null,
          approvedSeats: { $sum: { $ifNull: ["$approvedSeats", 0] } },
          rejectedSeats: { $sum: { $ifNull: ["$rejectedSeats", 0] } },
          pendingSeats: { $sum: { $ifNull: ["$pendingReqSeats", 0] } },
        },
      },
    ]);

    const totalSummary = summary[0] || {
      approvedSeats: 0,
      rejectedSeats: 0,
      pendingSeats: 0,
    };

    const updatedBookingRequest = await Bookride.findById(requestId);

    return res.status(200).json({
      success: true,
      message:
        statusType === "Approve"
          ? "Request approved successfully"
          : statusType === "Reject"
            ? "Request rejected successfully"
            : "Request cancelled successfully",
      data: {
        request: updatedBookingRequest,
        approvedSeats: Number(totalSummary.approvedSeats || 0),
        rejectedSeats: Number(totalSummary.rejectedSeats || 0),
        pendingSeats: Number(totalSummary.pendingSeats || 0),
      },
    });
  } catch (error) {
    console.error("statusBookride error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};





const editBookride = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedRide = await editBookRideService(id, updates);

    console.log(updatedRide,'updatedRide')

    const notif = buildNotification({
      type: "ride_request_update",
      actorName : updatedRide?.requestedBy?.firstName,
    });

    const notifictioncreated = await createNotificationService({
      userId: updatedRide?.rideId?.createdBy?._id,
      actorId: updatedRide?.requestedBy?._id,
      type: "ride_request_update",
      ...notif,
      data: {
        rideId : updatedRide?.rideId?._id,
        requestId: updatedRide?.requestedBy?._id,
        from: updatedRide?.rideId?.from,
        destination: updatedRide?.rideId?.destination,
      },
    });

    emitNotification(updatedRide?.rideId?.createdBy?._id.toString(), {
      type: "ride_request_update",
      message: notif.message,
      category: notif.title,
      data: {
        updatedRide,
        _id: notifictioncreated._id,
        rideId: updatedRide?.rideId?._id,
        profileImage: updatedRide?.requestedBy?.profileImage,
        requestBy: updatedRide?.requestedBy,
        requestId: updatedRide?.requestedBy?._id,
      },
    });


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