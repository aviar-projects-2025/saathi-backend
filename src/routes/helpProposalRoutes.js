import express from "express";
import {
  createHelpProposal,
  getReceivedHelpProposals,
  respondToHelpProposal,
  updateHelpRideStatus,
} from "../controller/helpProposalController.js";
// IMPORTANT: Change this import to the exact auth middleware used by your existing routes.
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.post("/", verifyToken, createHelpProposal);
router.get("/received", verifyToken, getReceivedHelpProposals);
router.patch("/:id/respond", verifyToken, respondToHelpProposal);
router.patch("/ride/:rideId/status", verifyToken, updateHelpRideStatus);

export default router;
