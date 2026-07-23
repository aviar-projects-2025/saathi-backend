import express from 'express'
import { createRide, getRides, editRide, deleteRide , checkActiveRide } from '../controller/ride.js'

const router = express.Router();

router.get("/get", getRides);
router.post("/", createRide);
router.patch("/edit/:id", editRide);
router.delete("/:id",deleteRide);
// routes/ride.js
// router.get('/users/:id/completed', getUserCompletedRides);
// router.delete("/",deleteRide);
router.get("/active/:userId", checkActiveRide);
// router.delete("/:id");

export default router