import express from "express";
import {
  requestRide,
  getBookride,
  editBookride,
  deleteBookride,
 
} from "../controller/bookride.js";

const router = express.Router();

router.get("/", getBookride);
router.post("/create/:rideId", requestRide);

router.put("/edit", editBookride);      // use PUT for update
router.delete("/delete", deleteBookride);

export default router;