import express from "express";
import { createTrip, getMyTrips, getMatches } from "../controller/travelBuddy.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken); // All travel buddy routes require auth

router.post("/", createTrip);
router.get("/my-trips", getMyTrips);
router.get("/:id/matches", getMatches);

export default router;