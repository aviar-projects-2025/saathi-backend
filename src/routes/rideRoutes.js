import express from 'express'
import { createRide, getRides, editRide, deleteRide } from '../controller/ride.js'

const router = express.Router();

router.get("/get", getRides);
router.post("/", createRide);
router.patch("/edit/:id", editRide);
router.delete("/:id",deleteRide);

export default router