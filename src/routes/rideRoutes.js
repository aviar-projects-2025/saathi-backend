import express from 'express'
import { createRide, getRides, editRide, checkActiveRide,deleteRide } from '../controller/ride.js'

const router = express.Router();

router.get("/get", getRides);
router.post("/", createRide);
router.patch("/edit/:id", editRide);
router.delete("/",deleteRide);
router.get("/active/:userId", checkActiveRide);
// router.delete("/:id");

export default router