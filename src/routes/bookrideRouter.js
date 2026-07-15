import express from "express";
import {
  requestRide,
  getBookride,
  editBookride,
  deleteBookride,
  statusBookride,
  getBookrideSend
} from "../controller/bookride.js";

const router = express.Router();

router.get("/:userId", getBookride);
router.get("/send/:userId", getBookrideSend);
router.post("/:rideId", requestRide);
router.put("/edit/:id", editBookride);
router.patch("/:requestId/status", statusBookride);
router.delete("/:userId", deleteBookride);

export default router;