import { emitNotification } from '../../socket.js';
import BookRide from '../model/bookride.js';
import {
    createRideService,
    deleteRideService,
    getAllRideService,
    updateRideService,
} from '../service/ride.js'

// controller
export const createRide = async (req, res) => {
    try {
        const ride = await createRideService(req.body);

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
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

export const editRide = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updatedRide = await updateRideService(id, data);

    if (updatedRide) {
      // All accepted riders
      const bookedRide = await BookRide.find({
        status: "ACCEPTED",
        rideId: updatedRide._id,
      });

      // Notify all riders
      for (const booking of bookedRide) {
        emitNotification(booking.requestedBy.toString(), {
          type: "ride_status",
          message: `Your ride is ${updatedRide.travelStatus}`,
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

        // NEW: Open rating modal for riders
        if (updatedRide.travelStatus === "Completed") {
          emitNotification(booking.requestedBy.toString(), {
            type: "ride_completed",
            rideId: updatedRide._id,
          });
        }
      }

      // NEW: Open rating modal for ride owner
      if (updatedRide.travelStatus === "Completed") {
        emitNotification(updatedRide.createdBy.toString(), {
          type: "ride_completed",
          rideId: updatedRide._id,
        });
      }
    }

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

// Delete
export const deleteRide = async (req, res) => {
    try {
        const { id } = req.params

        const deletedRide = await deleteRideService(id);
        res.status(200).json({
            status: true,
            message: 'Ride Deleted'
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

//Get All Rides 
export const getUserRides = async (req, res) => {
    const { id } = req.params;
    try {
        const ride = await getRideById(id);
        res.status(200).json({
            success: true,
            data: ride,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}