const {
    createRideService,
    getAllRideService,
    updateRideService,
} = require("../service/ride");

// Create Ride
const createRide = async (req, res) => {
    try {
        const data = req.body;
        const ride = await createRideService(data);
        res.status(201).json({
            success: true,
            data: ride,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

//Get All Rides 
const getRides = async (req, res) => {
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
const editRide = async (req, res) => {
    try {
        const { id } = req.params
        const data = req.body


        console.log(id, 'id')


        const updatedRide = await updateRideService(id, data);
        console.log(updatedRide,'updateRide')
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

//Get All Rides 
const getUserRides = async (req, res) => {
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

module.exports = {
    createRide,
    getRides,
    getUserRides,
    editRide,
}