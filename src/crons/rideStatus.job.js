import cron from "node-cron";
import Ride from "../model/ride.js";
import { emitNotification } from "../../socket.js";
import BookRide from "../model/bookride.js";
import Notification from "../model/notification.js";

cron.schedule("* * * * *", async () => {
    const now = new Date();
    // Step 1: find rides
    const rides = await Ride.find({
        travelStatus: "Waiting",
        startTime: { $lte: now },
    });

    if (!rides.length) return;

    for (const ride of rides) {
        // const exists = await Notification.findOne({
            // type: "ride_started",
            // "data.rideId": ride._id,
        // });

        // console.log(exists, 'exists')

        // if (!exists) {
        //     const noti = await Notification.create({
        //         userId: ride.createdBy,
        //         type: "ride_started",
        //         message: "Looks like you have started your ride, confirm!",
        //         data: {
        //             rideId: ride._id,
        //             from: ride.from,
        //             destination: ride.destination,
        //         },
        //         _id: noti?._id,
        //         isRead: false,
        //     });
        // }

        emitNotification(ride.createdBy, {
            type: "ride_started",
            message: "Looks like you have started your ride, confirm!",
            ride: {
                _id: ride._id,
                from: ride.from,
                destination: ride.destination,
                startTime: ride.startTime,
                modeOfTravel: ride.modeOfTravel,
            },
            data: { rideId: ride._id },
        });
    }

    // Step 2: update rides (VERY IMPORTANT)
    // await Ride.updateMany(
    //     { _id: { $in: rides.map(r => r._id) } },
    //     { $set: { travelStatus: "Started" } }
    // );

    // // Step 3: reject pending bookings
    // await BookRide.updateMany(
    //     { rideId: { $in: rides.map(r => r._id) }, status: "PENDING" },
    //     { status: "AUTO_REJECTED" }
    // );
});