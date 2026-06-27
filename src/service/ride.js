import Ride from "../model/ride.js";

export const createRideService = async (data) => {
  // Rule 1: Same route already active
  const activeRouteRide = await Ride.findOne({
    createdBy: data.createdBy,
    from: data.from,
    destination: data.destination,
    startTime: data.startTime,
    status: { $in: ["OPEN", "IN_PROGRESS"] },
  });

  if (activeRouteRide) {
    throw new Error(
      "You already have an active ride for this route. Please close or delete it before creating another ride."
    );
  }

  // Rule 2: Same date & time already active
  const duplicateDateTime = await Ride.findOne({
    createdBy: data.createdBy,
    startTime: new Date(data.startTime),
    status: { $in: ["OPEN", "IN_PROGRESS"] },
  });

  if (duplicateDateTime) {
    throw new Error(
      "You already have an active ride at this date and time."
    );
  }

  // Create ride
  return await Ride.create(data);
};

// Get all
export const getAllRideService = async () => {
  return await Ride.find().populate("createdBy", "firstName lastName");
};

// Get single Ride
export const getRideById = async (id) => {
  return await Ride.findById(id);
};

// Edit Ride
export const updateRideService = async (id, data) => {
  return await Ride.findByIdAndUpdate(id, data, { new: true });
};