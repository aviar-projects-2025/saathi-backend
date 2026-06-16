const Ride = require('../model/ride')


// create ride
const createRideService = async (data) => {
    return await Ride.create(data);
}

// get all 
const getAllRideService = async () => {
    return await Ride.find();
}

// Get single Ride
const getRideById = async (id) => {
    return await Ride.findById(id);
}




module.exports = {
    createRideService,
    getAllRideService,
    getRideById,
}