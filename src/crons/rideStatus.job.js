import cron from "node-cron";
import Ride from "../model/ride.js";
import BookRide from "../model/bookride.js";
import { emitNotification } from "../../socket.js";
import { createNotificationService } from "../service/notification.js";

cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // --------------------------------------------------
    // 1. Find rides whose start time has passed
    // --------------------------------------------------
    const rides = await Ride.find({
      travelStatus: "Waiting",
      startTime: { $lte: now },
    }).select(
      "_id createdBy totalSeats from destination startTime modeOfTravel travelStatus"
    );

    if (!rides.length) {
    //   console.log("[RIDE CRON] No rides to process");
      return;
    }

    // console.log(
    //   "[RIDE CRON] Rides found:",
    //   rides.length
    // );

    // --------------------------------------------------
    // 2. Process each ride
    // --------------------------------------------------
    for (const ride of rides) {
    //   console.log(
    //     "[RIDE CRON] Processing ride:",
    //     ride._id.toString()
    //   );

      // ------------------------------------------------
      // 3. Find ACCEPTED bookings
      // ------------------------------------------------
      const acceptedBookings = await BookRide.find({
        rideId: ride._id,
        status: "ACCEPTED",
      }).select("requestedBy");

    //   console.log(
    //     "[RIDE CRON] Accepted bookings:",
    //     acceptedBookings.length
    //   );

      // ------------------------------------------------
      // 4. Notify accepted passengers
      // ------------------------------------------------
      for (const booking of acceptedBookings) {
        if (!booking.requestedBy) continue;

        const userId = booking.requestedBy.toString();

        emitNotification(userId, {
          type: "ride_started",
          message: "Your ride has started 🚀",
          category: "Ride Started",

          ride: {
            _id: ride._id,
            from: ride.from,
            destination: ride.destination,
            startTime: ride.startTime,
            modeOfTravel: ride.modeOfTravel,
          },

          data: {
            rideId: ride._id,
          },
        });

        // console.log(
        //   "[RIDE CRON] Ride started notification sent to:",
        //   userId
        // );
      }

      // ------------------------------------------------
      // 5. Notify ride owner
      // ------------------------------------------------
      const ownerId = ride.createdBy.toString();

      emitNotification(ownerId, {
        type: "ride_started",
        message: "Looks like you have started your ride, confirm!",
        category: "Ride Started",

        ride: {
          _id: ride._id,
          from: ride.from,
          destination: ride.destination,
          startTime: ride.startTime,
          modeOfTravel: ride.modeOfTravel,
        },

        data: {
          rideId: ride._id,
          _id: ride._id,
        },
      });

    //   console.log(
    //     "[RIDE CRON] Owner notification sent:",
    //     ownerId
    //   );

      // ------------------------------------------------
      // 6. Find PENDING bookings
      // ------------------------------------------------
      const pendingBookings = await BookRide.find({
        rideId: ride._id,
        status: "PENDING",
      }).select("requestedBy");

    //   console.log(
    //     "[RIDE CRON] Pending bookings:",
    //     pendingBookings.length
    //   );

      // ------------------------------------------------
      // 7. Auto reject pending bookings
      // ------------------------------------------------
      if (pendingBookings.length > 0) {
        await BookRide.updateMany(
          {
            rideId: ride._id,
            status: "PENDING",
          },
          {
            $set: {
              status: "AUTO_REJECTED",
            },
          }
        );

        // console.log(
        //   "[RIDE CRON] Pending bookings auto-rejected:",
        //   pendingBookings.length
        // );

        // ----------------------------------------------
        // 8. Notify users whose requests were rejected
        // ----------------------------------------------
        for (const booking of pendingBookings) {
          if (!booking.requestedBy) continue;

          const userId = booking.requestedBy.toString();

          const notification = await createNotificationService({
            userId: booking.requestedBy,
            actorId: ride.createdBy,
            type: "request_rejected",
            category: "Request Rejected",
            message:
              "Your ride request was automatically rejected because the ride has already started.",
            data: {
              rideId: ride._id,
            },
          });

          emitNotification(userId, {
            type: "request_rejected",
            message:
              "Your ride request was automatically rejected because the ride has already started.",
            category: "Request Rejected",

            data: {
              rideId: ride._id,
              requestId: booking._id,
              _id: notification?._id,
            },
          });

        //   console.log(
        //     "[RIDE CRON] Auto-rejection notification sent to:",
        //     userId
        //   );
        }
      }

      // ------------------------------------------------
      // 9. VERY IMPORTANT:
      //    Mark ride as Started
      // ------------------------------------------------
    //   await Ride.updateOne(
    //     {
    //       _id: ride._id,
    //       travelStatus: "Waiting",
    //     },
    //     {
    //       $set: {
    //         travelStatus: "Started",
    //       },
    //     }
    //   );

    }
  } catch (error) {
    console.error(
      "[RIDE CRON] ERROR:",
      error
    );
  }
});