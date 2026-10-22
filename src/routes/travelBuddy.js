import express from "express";
import { createTrip, getMyTrips, getMatches, getAllTrips } from "../controller/travelBuddy.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken); // All travel buddy routes require auth

router.post("/", verifyToken, createTrip);
router.get("/my-trips", verifyToken, getMyTrips);
router.get("/",verifyToken, getAllTrips); // <--- Add this BEFORE /:id

// Dynamic routes
// router.get("/:id", getTripById); 
// router.post("/:id/accept", acceptMatch);
// router.post("/:id/complete", completeTrip);
router.get("/:id/matches", verifyToken, getMatches);

export default router;