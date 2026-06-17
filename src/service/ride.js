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

// edit service
const updateRideService = async (id, data) => {
    return await Ride.findByIdAndUpdate(id, data, { new: true });
}




module.exports = {
    createRideService,
    getAllRideService,
    getRideById,
    updateRideService,
}