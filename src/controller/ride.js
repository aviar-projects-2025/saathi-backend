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
// Update
export const editRide = async (req, res) => {
    try {
        const { id } = req.params
        const data = req.body

        const updatedRide = await updateRideService(id, data);
        console.log(updatedRide, 'updateRide')
        res.status(200).json({
            status: true,
            data: updatedRide
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

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