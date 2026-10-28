import express from "express";
import {
  createTrip,
  getMyTrips,
  getAllTrips,
  getTripById,
  getMatches,
  createTravelBuddyRequest,
  getReceivedTravelBuddyRequests,
  getSentTravelBuddyRequests,
  respondToTravelBuddyRequest,
  getTravelBuddyRequestContact,
  getAcceptedTripDetails,
} from "../controller/travelBuddy.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);

// Keep specific request paths before /:id paths.
router.post("/requests", createTravelBuddyRequest);
router.get("/requests/received", getReceivedTravelBuddyRequests);
router.get("/requests/sent", getSentTravelBuddyRequests);
router.patch("/requests/:id/respond", respondToTravelBuddyRequest);
router.get("/requests/:id/contact", getTravelBuddyRequestContact);
router.get("/accepted/:tripId", verifyToken, getAcceptedTripDetails);

router.post("/", createTrip);
router.get("/my-trips", getMyTrips);
router.get("/", getAllTrips);
router.get("/:id", getTripById);
router.get("/:id/matches", getMatches);

export default router;
