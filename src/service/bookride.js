import BookRide from "../model/bookride.js";

const createBookRideService = async (data) => {
    return await BookRide.create(data)
}
//  const checkActiveRideService = async (userId) => {
//   const ride = await Ride.findOne({
//     createdBy: userId,
//     status: { $in: ["OPEN", "IN_PROGRESS"] },
//   });

const editBookRideService = async (id, data) => {
    return await BookRide.findByIdAndUpdate(
        id,
        data,
        { new: true }
    );
}
// get all 
const getBookRideService = async (userId, type) => {

  if (type === "requested") {
    return await BookRide.find({
      requestedBy: userId,
    });
  }

  if (type === "received") {
    return await BookRide.find({
      rideOwner: userId,
    }).populate('requestedBy', 'firstName lastName profileImage');
  }

  return [];
};


// Get single Ride
const getBookRideById = async (id) => {
    return await BookRide.findById(id);
}
const deleteBookRideService = async (id) => {
    return await BookRide.findByIDAndDelete(id);
}

export {
    createBookRideService,
    editBookRideService,
    getBookRideService,
    getBookRideById,
    deleteBookRideService,
    // checkActiveRideService
};