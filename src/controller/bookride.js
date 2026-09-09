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

    console.log("requestId:", requestId);
    console.log("statusType:", statusType);

    if (!["Approve", "Reject", "Cancel"].includes(statusType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status type",
      });
    }

    const notifType =
      statusType === "Approve"
        ? "request_accepted"
        : statusType === "Cancel"
          ? "request_cancelled"
          : "request_rejected";

    // ---------------------------------------------------------
    // Get booking request BEFORE changing status
    // ---------------------------------------------------------
    const bookingRequest = await BookRide.findById(requestId);

    if (!bookingRequest) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    const previousStatus = bookingRequest.status;

    // Keep the counts before statusBookRideService changes anything
    const approvedSeats = Number(bookingRequest.approvedSeats || 0);

    const pendingSeats = Number(
      bookingRequest.pendingReqSeats || 0
    );

    const requestedSeats = Number(
      bookingRequest.seatsRequested || 0
    );

    console.log("previousStatus:", previousStatus);
    console.log("approvedSeats:", approvedSeats);
    console.log("pendingSeats:", pendingSeats);
    console.log("requestedSeats:", requestedSeats);

    // ---------------------------------------------------------
    // Change booking status
    // ---------------------------------------------------------
    const rides = await statusBookRideService(
      requestId,
      statusType
    );

    if (!rides) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    // =========================================================
    // REJECT
    // =========================================================
    if (statusType === "Reject") {

      // -------------------------------------------------------
      // PENDING -> REJECTED
      // -------------------------------------------------------
      if (previousStatus === "PENDING") {

        const seatsToReject =
          pendingSeats || requestedSeats;

        if (seatsToReject > 0) {
          await BookRide.findByIdAndUpdate(
            requestId,
            {
              $inc: {
                rejectedSeats: seatsToReject,
              },
              $set: {
                pendingReqSeats: 0,
              },
            },
            { new: true }
          );

          // These seats were never consumed,
          // so availableSeats does NOT increase.
          await Ride.findByIdAndUpdate(
            rides.rideId,
            {
              $inc: {
                rejectedSeats: seatsToReject,
              },
            },
            { new: true }
          );
        }
      }

      // -------------------------------------------------------
      // ACCEPTED -> REJECTED
      // -------------------------------------------------------
      else if (previousStatus === "ACCEPTED") {

        const seatsToReject =
          approvedSeats || bookingRequest.members?.length || 0;

        if (seatsToReject > 0) {

          // Update BookRide
          await BookRide.findByIdAndUpdate(
            requestId,
            {
              $inc: {
                approvedSeats: -seatsToReject,
                rejectedSeats: seatsToReject,
              },
              $set: {
                members: [],
              },
            },
            { new: true }
          );

          // Return approved seats back to Ride
          await Ride.findByIdAndUpdate(
            rides.rideId,
            {
              $inc: {
                availableSeats: seatsToReject,
                rejectedSeats: seatsToReject,
              },
            },
            { new: true }
          );
        }
      }
    }

    // =========================================================
    // APPROVE
    // =========================================================
    if (statusType === "Approve") {

      const ride = await Ride.findById(rides.rideId);

      if (ride && ride.availableSeats === 0) {

        const pendingRequests = await BookRide.find({
          rideId: ride._id,
          status: "PENDING",
        });

        // Auto reject all remaining pending requests
        await BookRide.updateMany(
          {
            rideId: ride._id,
            status: "PENDING",
          },
          {
            $set: {
              status: "REJECTED",
              pendingReqSeats: 0,
            },
          }
        );

        // Update rejectedSeats for each pending request
        for (const pendingRequest of pendingRequests) {

          const seatsToReject = Number(
            pendingRequest.pendingReqSeats ||
            pendingRequest.seatsRequested ||
            0
          );

          if (seatsToReject > 0) {
            await BookRide.findByIdAndUpdate(
              pendingRequest._id,
              {
                $inc: {
                  rejectedSeats: seatsToReject,
                },
              }
            );

            await Ride.findByIdAndUpdate(
              ride._id,
              {
                $inc: {
                  rejectedSeats: seatsToReject,
                },
              }
            );
          }

          // Notification
          const notif = buildNotification({
            type: "request_rejected",
          });

          await createNotificationService({
            userId: pendingRequest.requestedBy,
            actorId: pendingRequest.rideOwner,
            type: "request_rejected",
            ...notif,
            data: {
              rideId: pendingRequest.rideId,
              requestId: pendingRequest._id,
            },
          });

          emitNotification(
            pendingRequest.requestedBy.toString(),
            {
              type: "request_rejected",
              message: notif.message,
              data: {
                rideId: pendingRequest.rideId,
                requestId: pendingRequest._id,
              },
            }
          );
        }
      }
    }

    // =========================================================
    // NOTIFICATION FOR CURRENT REQUEST
    // =========================================================

    const notif = buildNotification({
      type: notifType,
    });

    const notificationCreated =
      await createNotificationService({
        userId: rides.rideOwner,
        actorId: rides.requestedBy,
        type: notifType,
        ...notif,
        data: {
          rideId: rides.rideId,
          requestId: rides._id,
        },
      });

    emitNotification(
      rides.requestedBy.toString(),
      {
        type: notifType,
        message: notif.message,
        category: notif.title,
        data: {
          _id: notificationCreated._id,
          rideId: rides.rideId,
          requestId: rides._id,
        },
      }
    );

    // =========================================================
    // RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,
      message:
        statusType === "Approve"
          ? "Ride request accepted"
          : statusType === "Reject"
            ? "Ride request rejected"
            : "Ride request cancelled",
      data: rides,
    });

  } catch (error) {
    console.error("statusBookride error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const editBookride = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

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