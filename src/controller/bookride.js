import {
  editBookRideService,
  deleteBookRideService,
  getBookRideService,
} from "../service/bookride.js";

import BookRide from "../model/bookride.js";

const requestRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const data = req.body;

    console.log("rideId:", rideId);
    console.log("request data:", data);

    const ride = await BookRide.findById(rideId);

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

    ride.requests.push({
      requestedBy: data.requestedBy,
      seatsRequested: isFlight ? null : Number(data.seatsRequested),
      membersCount: Number(data.membersCount),
      members: data.members,
      phone: data.phone,
      message: data.message,
      requestType: isFlight ? "COMPANION" : "SEAT",
      status: "PENDING",
    });

    await ride.save();

    res.status(201).json({
      success: true,
      message: isFlight
        ? "Companion request sent successfully"
        : "Seat request sent successfully",
      data: ride,
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
    const rides = await getBookRideService();

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
    const rides = await deleteBookRideService();

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

export {
  requestRide,
  getBookride,
  editBookride,
  deleteBookride,
};