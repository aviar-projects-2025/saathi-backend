import bookRide from "../model/bookride"

const createBookRideService = async (data) =>{
    return await bookRide.create(data)
}

const editBookRideService = async () =>{
    return await bookRide.findByIdAndUpdate()
}
// get all 
const getBookRideService = async () => {
    return await bookRide.find();
}

// Get single Ride
const getBookRideById = async (id) => {
    return await bookRide.findById(id);
}
const deleteBookRideService = async () =>{
    return await bookRide.findByIDAndDelete();
}