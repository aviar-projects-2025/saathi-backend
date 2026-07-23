import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";

export const createRideService = async (data) => {
  const startDate = new Date(data.startTime);
  
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await Ride.create(data);
};

// Get all
export const getAllRideService = async () => {
  return await Ride.find().populate("createdBy", "firstName lastName").sort({ createdAt: -1 });
};

// Get single Ride
export const getRideById = async (id) => {
  return await Ride.findById(id);
};

export const deleteRideService = async (id) => {
  return await Ride.findByIdAndDelete(id);
}

// edit service
export const updateRideService = async (id, data) => {
  await BookRide.updateMany(
    { rideId: id, status: "PENDING" },
    { status: "AUTO_REJECTED" }
  );
  return await Ride.findByIdAndUpdate(id, data, { new: true });
};