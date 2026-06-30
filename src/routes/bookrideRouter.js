import express from "express";
import {
  requestRide,
  getBookride,
  editBookride,
  deleteBookride,
 
} from "../controller/bookride.js";

const router = express.Router();

router.get("/:userId", getBookride);
router.post("/:rideId", requestRide);
router.put("/edit", editBookride);
router.delete("/delete", deleteBookride);

export default router;