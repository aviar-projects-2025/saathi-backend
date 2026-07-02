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

const requestRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const data = req.body;
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }
    const isFlight = ride.modeOfTravel === "Flight";
    if (!isFlight && Number(data.seatsRequested) > Number(ride.availableSeats)) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.availableSeats} seat(s) available`,
      });
    }

    const reqData = {
      ...data,
      rideId,
      rideOwner: ride.createdBy,
    }

    const bookingData = await Bookride.create(reqData);

    // emitNotification(bookingData.rideOwner.toString(), "new_request", bookingData);
    
    emitNotification(
      bookingData.rideOwner.toString(), {
      type: "new_request",
      message: "New ride request received",
      data: bookingData
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
    const { type } = req.query;

    console.log("status book ride")
    const rides = await statusBookRide(requestId, type);
    console.log(rides, 'rides soc')
    // emitToUser(rides.requestedBy.toString(), "request_update", rides);
    emitNotification(
      rides.requestedBy.toString(), {
      type: "request_update",
      message: "Check ride request status",
      data: rides
    });

    res.status(200).json({
      success: true,
      message: "Ride Approved",
      rides
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'failed to approve'
    })
  }
}

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
    const {userId } = req.params;

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