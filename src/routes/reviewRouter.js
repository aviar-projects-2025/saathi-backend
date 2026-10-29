import express from "express";
import { createReview, getUserReviews } from "../controller/review.js";
import { verifyToken } from "../middleware/auth.js";
// Import your auth middleware here
// import { protect } from "../middleware/auth.js"; 

const router = express.Router();

// Assuming you have a middleware that extracts req.user from the token
// router.use(protect); 

router.post("/", verifyToken, createReview);
router.get("/user/:userId", verifyToken, getUserReviews);

export default router;