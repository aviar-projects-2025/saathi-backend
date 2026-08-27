import { broadcastNotification, emitNotification } from "../../socket.js";
import BookRide from "../model/bookride.js";
import {
  buildNotification,
  createNotificationService,
} from "../service/notification.js";
import {
  createRideService,
  deleteRideService,
  getAllRideService,
  updateRideService,
} from "../service/ride.js";
import Ride from "../model/ride.js";
import User from "../model/user.js";
import supabase from "../../config/supabase.js";
// controller
export const createRide = async (req, res) => {
  try {
    const ride = await createRideService(req.body);

    if (ride) {
      const newRideUpdate = buildNotification({ type: "new_ride_added" });

      broadcastNotification({
        type: "new_ride_added",
        message: newRideUpdate.message,
        data: ride,
      });
    }

    res.status(201).json({
      success: true,
      data: ride,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkActiveRide = async (req, res) => {
  try {
    const { userId } = req.params;

    const hasActiveRide = await checkActiveRideService(userId);

    res.status(200).json({
      success: true,
      hasActiveRide,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getRides = async (req, res) => {
  try {
    const rides = await getAllRideService();
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
// Update

export const editRide = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Update ride
    const updatedRide = await updateRideService(id, data);

    // Ride not found
    if (!updatedRide) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    // Get accepted bookings for this ride
    const { data: bookRides, error: bookRideError } = await supabase
      .from("book_rides")
      .select("id, requested_by")
      .eq("ride_id", id)
      .eq("status", "ACCEPTED");

    if (bookRideError) {
      throw bookRideError;
    }

    // Send notification to all accepted passengers
    for (const booking of bookRides || []) {
      emitNotification(booking.requested_by, {
        type: "ride_status",

        message: `Your ride ${updatedRide.travelStatus} 🚀`,

        ride: {
          _id: updatedRide._id,
          from: updatedRide.from,
          destination: updatedRide.destination,
          startTime: updatedRide.startTime,
          modeOfTravel: updatedRide.modeOfTravel,
        },

        data: {
          rideId: updatedRide._id,
          status: updatedRide.travelStatus,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedRide,
    });
  } catch (error) {
    console.error("Edit ride error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete
export const deleteRide = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRide = await deleteRideService(id);

    if (!deletedRide) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ride Deleted",
      data: deletedRide,
    });
  } catch (error) {
    console.error("Delete ride error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserRides = async (req, res) => {
  const { id } = req.params;
  try {
    const ride = await getRideById(id);
    res.status(200).json({
      success: true,
      data: ride,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelRide = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the existing ride
    const { data: existingRide, error: rideFetchError } = await supabase
      .from("rides")
      .select(
        `
        id,
        created_by,
        from_location,
        destination,
        start_time,
        mode_of_travel,
        travel_status
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (rideFetchError) {
      throw rideFetchError;
    }

    if (!existingRide) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    // 2. Update ride status to Cancelled
    const { data: updatedRide, error: updateRideError } = await supabase
      .from("rides")
      .update({
        travel_status: "Cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
        id,
        created_by,
        from_location,
        destination,
        start_time,
        mode_of_travel,
        travel_status
      `,
      )
      .single();

    if (updateRideError) {
      throw updateRideError;
    }

    console.log(updatedRide, "Updated Ride");

    // 3. Get all ACCEPTED bookings for this ride
    const { data: requestList, error: requestError } = await supabase
      .from("book_rides")
      .select(
        `
        id,
        requested_by
      `,
      )
      .eq("ride_id", id)
      .eq("status", "ACCEPTED");

    if (requestError) {
      throw requestError;
    }

    // 4. Notify every accepted passenger
    for (const request of requestList || []) {
      // Create notification
      const notificationCreated = await createNotificationService({
        userId: request.requested_by,
        actorId: updatedRide.created_by,
        type: "request_cancelled",
        message: "Your ride cancelled",
        data: {
          rideId: updatedRide.id,
          status: updatedRide.travel_status,
          requestId: request.id,
          from: updatedRide.from_location,
          destination: updatedRide.destination,
        },
      });

      console.log(notificationCreated, "notificationCreated");

      // Send real-time notification
      emitNotification(request.requested_by, {
        type: "ride_cancelled",
        message: "Your ride cancelled",
        category: "Ride Cancelled",

        ride: {
          _id: updatedRide.id,
          from: updatedRide.from_location,
          destination: updatedRide.destination,
          startTime: updatedRide.start_time,
          modeOfTravel: updatedRide.mode_of_travel,
        },

        data: {
          _id: notificationCreated.id,
          rideId: updatedRide.id,
          status: updatedRide.travel_status,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ride Cancelled",
    });
  } catch (error) {
    console.error("Cancel ride error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// export const getTopRider = async (req, res) => {
//   try {
//     const rider = await getTopRider();
//     res.status(200).json({
//       success: true,
//       data: rider,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };
