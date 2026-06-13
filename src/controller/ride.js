const { 
    createRideService,
    getAllRideService,
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
            success : true,
            totalRides : rides.length,
            data : rides,
        })
    } catch (error) {
        res.status(500).json({
            success : false,
            message : error.message
        })
    }
}


module.exports = {
    createRide,
    getRides,
}