// src/crons/autoRateCompletedRides.job.js
import axios from "axios";
import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";
import Review from "../model/review.js";
import { createSystemReviewService } from "../service/review.js";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
const RUN_EVERY_MS = 60 * 60 * 1000; // 1 hour

const SYSTEM_USER_ID = null; // auto-ratings have no "reviewer" — see note below

async function autoRateCompletedRides() {
  console.log("[AUTO_RATE] start");

  try {
    const cutoff = new Date(Date.now() - THREE_DAYS_MS);

    // 1. Find completed rides older than 3 days
    const rides = await Ride.find({
      travelStatus: "Completed",
      updatedAt: { $lt: cutoff }, // ride was completed 3+ days ago
    })
      .populate("createdBy", "_id")
      .populate("actualDriver", "_id")
      .limit(BATCH_SIZE)
      .lean();

    let autoCreated = 0;
    let skipped = 0;

    for (const ride of rides) {
      const ownerId = ride.createdBy?._id || ride.createdBy;
      const driverId = ride.actualDriver?._id || ride.actualDriver;

      // Collect the set of participants who should each rate the other
      const participants = [];
      if (ownerId) participants.push(String(ownerId));
      if (driverId) participants.push(String(driverId));

      // Also include accepted passengers who haven't rated
      const acceptedBookings = await BookRide.find({
        rideId: ride._id,
        status: "ACCEPTED",
      })
        .populate("requestedBy", "_id")
        .lean();

      for (const b of acceptedBookings) {
        const passengerId = b.requestedBy?._id || b.requestedBy;
        if (passengerId) participants.push(String(passengerId));
      }

      const uniqueParticipants = [...new Set(participants)];

      // For each participant, auto-rate the "other side"
      for (const reviewerId of uniqueParticipants) {
        let revieweeIds = [];

        if (String(reviewerId) === String(ownerId)) {
          // Owner rates: driver (if any) + all accepted passengers
          if (driverId) revieweeIds.push(String(driverId));
          for (const b of acceptedBookings) {
            const pid = b.requestedBy?._id || b.requestedBy;
            if (pid && String(pid) !== String(reviewerId)) revieweeIds.push(String(pid));
          }
        } else {
          // Passenger / driver rates the owner (and driver if applicable)
          if (ownerId && String(ownerId) !== String(reviewerId)) revieweeIds.push(String(ownerId));
          if (driverId && String(driverId) !== String(reviewerId) && String(driverId) !== String(ownerId)) {
            revieweeIds.push(String(driverId));
          }
        }

        revieweeIds = [...new Set(revieweeIds)];

        for (const revieweeId of revieweeIds) {
          // Skip if user already rated
          const existing = await Review.findOne({
            rideId: ride._id,
            reviewerId,
            revieweeId,
          }).lean();

          if (existing) {
            skipped++;
            continue;
          }

          try {
            await createSystemReviewService({
              rideId: ride._id,
              reviewerId,
              revieweeId,
              rating: 5,
            });
            autoCreated++;
          } catch (e) {
            console.warn("[AUTO_RATE] create failed", e.message);
          }
        }
      }
    }

    console.log(`[AUTO_RATE] done: created=${autoCreated}, skipped=${skipped}, ridesProcessed=${rides.length}`);
  } catch (err) {
    console.error("[AUTO_RATE] failed:", err);
  }
}

export function startAutoRateJob() {
  // Run once at startup, then hourly
  autoRateCompletedRides();
  setInterval(autoRateCompletedRides, RUN_EVERY_MS);
  console.log("[AUTO_RATE] job scheduled (every 1h)");
}