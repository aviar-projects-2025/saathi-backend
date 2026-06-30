import Ride from '../model/ride.js'

// create ride
export const createRideService = async (data) => {
    return await Ride.create(data);
}

// get all 
export const getAllRideService = async () => {
    return await Ride.find().populate("createdBy", "firstName lastName");
}

// Get single Ride
export const getRideById = async (id) => {
    return await Ride.findById(id);
}

export const deleteRideService = async (id) => {
    return await Ride.findByIdAndDelete(id);
}

// edit service
export const updateRideService = async (id, data) => {
    return await Ride.findByIdAndUpdate(id, data, { new: true });
}
