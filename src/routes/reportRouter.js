import express from "express";
import { createReport } from "../controller/report.js";
import { verifyToken } from "../middleware/auth.js";
// import { protect } from "../middleware/auth.js"; 

const router = express.Router();

// router.use(protect);

router.post("/", verifyToken, createReport);

export default router;