import bookRide from "../model/bookride.js"

const createBookRideService = async (data) =>{
    return await bookRide.create(data)
}
//  const checkActiveRideService = async (userId) => {
//   const ride = await Ride.findOne({
//     createdBy: userId,
//     status: { $in: ["OPEN", "IN_PROGRESS"] },
//   });

//   return !!ride;
// };
const editBookRideService = async (id,data) =>{
    return await bookRide.findByIdAndUpdate(
        id,
        data,
        {new: true}
    );
}
// get all 
const getBookRideService = async () => {
    return await bookRide.find();
}

// Get single Ride
const getBookRideById = async (id) => {
    return await bookRide.findById(id);
}
const deleteBookRideService = async (id) =>{
    return await bookRide.findByIDAndDelete(id);
}

export {
    createBookRideService,
    editBookRideService,
    getBookRideService,
    getBookRideById,
    deleteBookRideService,
    // checkActiveRideService
};