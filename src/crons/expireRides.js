// jobs/expireRides.js
import cron from "node-cron";
import Ride from "../model/ride.js";
import BookRide from "../model/bookride.js";

/**
 * TC-19: expire stale rides the moment their startTime passes.
 *
 * Rule (BRD 6.4):
 *   • Offer ride, startTime reached, no ACCEPTED request → Expired
 *   • Request ride, startTime reached, no accepted driver  → Expired
 *   • Already Started / Completed / Cancelled / Expired    → skipped
 *
 * GRACE_MINUTES = 0 means "expire at startTime".
 * Bump to 1 or 2 only if you want a tiny tolerance for clock skew.
 */
const GRACE_MINUTES = 0;

async function expireStaleRides() {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000);
  let offerExpired = 0;
  let requestExpired = 0;

  try {
    /* ─────────────────────────────────────────────────────
       OFFERS: Waiting, startTime passed, no ACCEPTED request
       ───────────────────────────────────────────────────── */
    const staleOffers = await Ride.find({
      kind: "offer",
      travelStatus: "Waiting",
      startTime: { $lte: cutoff },          // ★ now uses $lte (startTime reached)
    })
      .select("_id")
      .lean();

    if (staleOffers.length > 0) {
      const staleIds = staleOffers.map((r) => r._id);

      const ridesWithAccepted = await BookRide.distinct("rideId", {
        rideId: { $in: staleIds },
        status: { $in: ["ACCEPTED", "APPROVED"] },
      });
      const acceptedSet = new Set(ridesWithAccepted.map(String));

      const expireIds = staleIds.filter((id) => !acceptedSet.has(String(id)));

      if (expireIds.length > 0) {
        const now = new Date();
        const result = await Ride.updateMany(
          { _id: { $in: expireIds }, travelStatus: "Waiting" },
          { $set: { travelStatus: "Expired", expiredAt: now } }
        );
        offerExpired = result.modifiedCount || 0;
      }
    }

    /* ─────────────────────────────────────────────────────
       REQUESTS: Waiting, startTime passed, no driver assigned
       ───────────────────────────────────────────────────── */
    const staleRequests = await Ride.find({
      kind: "request",
      travelStatus: "Waiting",
      startTime: { $lte: cutoff },          // ★ same — expire at startTime
      actualDriver: null,
      helpProposalId: null,
    })
      .select("_id")
      .lean();

    if (staleRequests.length > 0) {
      const expireIds = staleRequests.map((r) => r._id);
      const now = new Date();
      const result = await Ride.updateMany(
        { _id: { $in: expireIds }, travelStatus: "Waiting" },
        { $set: { travelStatus: "Expired", expiredAt: now } }
      );
      requestExpired = result.modifiedCount || 0;
    }

    if (offerExpired > 0 || requestExpired > 0) {
      console.log(
        `[expireRides] Expired ${offerExpired} offer(s), ${requestExpired} request(s) at ${new Date().toISOString()}`
      );
    }
  } catch (err) {
    console.error("[expireRides] job failed:", err.message);
  }
}

/**
 * Run every 1 minute so a ride whose startTime just passed is flipped
 * to Expired within ~60 seconds — effectively "at startTime" from the
 * user's perspective.
 */
export function startExpireRidesJob() {
  expireStaleRides(); // catch anything stale from server downtime

  cron.schedule("* * * * *", expireStaleRides, { timezone: "UTC" });
  console.log("[expireRides] scheduled (every 1 min, grace = 0)");
}

export { expireStaleRides };