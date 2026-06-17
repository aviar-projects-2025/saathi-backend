import express from 'express'
import { createUser, getUsers, loginUser, getSingleUser, } from '../controller/user.js'

const router = express.Router();
// signup Route
router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getSingleUser);


//login route
router.post("/login", loginUser);

export default router;