const Ride = require('../model/ride')


// create ride
const createRideService = async (data) => {
    return await Ride.create(data);
}

// get all 
const getAllRideService = async () => {
    return await Ride.find();
}




module.exports = {
    createRideService,
    getAllRideService,
}