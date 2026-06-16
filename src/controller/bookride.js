import { createBookRideService, editBookRideService, deleteBookRideService, getBookRideService, getBookRideById } from "../service/bookride";

const createBookride = async (req,res) =>{
    try{
        const data = req.body;
        const ride = await createBookRideService(data);
        res.status(201).json({
            success: true,
            data: ride,
        });
    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

//Get All Rides 
const getBookride = async (req, res) => {
    try {
        const rides = await getBookRideService();
        res.status(200).json({
            success: true,
            totalRides: rides.length,
            data: rides,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }

}

const editBookride = async (req, res) =>{
    try{
        const rides = await editBookRideService();
        res.status(500).json({
            success: true,
            totalRides: rides.length,
            data: rides,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}
const deleteBookride = async (req, res) =>{
    try{
        const rides = await deleteBookRideService();
        res.status(500).json({
            success: true,
            totalRides: rides.length,
            data: rides,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}