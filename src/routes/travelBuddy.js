import express from "express";
import {
  createTrip, getMyTrips, getAllTrips, getTripById, getMatches,
  createTravelBuddyRequest,
  getReceivedTravelBuddyRequests, getSentTravelBuddyRequests,
  respondToTravelBuddyRequest,
  getTravelBuddyRequestContact,
  getAcceptedTripDetails,
  updateTrip,
  cancelTrip,
  cancelTravelBuddyRequest,
} from "../controller/travelBuddy.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);

// Requests
router.post("/requests", createTravelBuddyRequest);
router.get("/requests/received", getReceivedTravelBuddyRequests);
router.get("/requests/sent", getSentTravelBuddyRequests);
router.patch("/requests/:id/respond", respondToTravelBuddyRequest);
router.patch("/requests/:id/cancel", cancelTravelBuddyRequest);
router.get("/requests/:id/contact", getTravelBuddyRequestContact);
router.get("/accepted/:tripId", getAcceptedTripDetails);

// Trips
router.post("/", createTrip);
router.get("/my-trips", getMyTrips);
router.get("/", getAllTrips);

// These must come BEFORE "/:id" so Express doesn't match "cancel"/"matches" as a trip id
router.patch("/:id/cancel", cancelTrip);
router.get("/:id/matches", getMatches);
router.get("/:id", getTripById);
router.patch("/:id", updateTrip);

export default router;