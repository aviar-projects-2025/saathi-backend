import express from 'express'
import { createRating } from '../controller/riderRating.js'

const router = express.Router();

router.post("/:id", createRating);

export default router