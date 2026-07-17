import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";

export const createRideService = async (data) => {
  const startDate = new Date(data.startTime);

  // Beginning of the selected day
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);

  // End of the selected day
  const endOfDay = new Date(startDate);
  endOfDay.setHours(23, 59, 59, 999);

  // const activeRide = await Ride.findOne({
  //   createdBy: data.createdBy,
  //   status: { $in: ["OPEN", "IN_PROGRESS"] },
  //   startTime: {
  //     $gte: startOfDay,
  //     $lte: endOfDay,
  //   },
  // });

  // if (activeRide) {
  //   throw new Error(
  //     "You already have an active ride scheduled on this date. Please close or complete it before creating another ride."
  //   );
  // }

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