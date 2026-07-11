import express from 'express'
import { createUser, getUsers, loginUser, getSingleUser, updateProfile, changePassword} from '../controller/user.js'
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
// signup Route
router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getSingleUser);
router.patch("/change-password/:userId", changePassword);

//login route
router.post("/login", loginUser);
router.post('/update/:userId',upload.single("profileImage"), updateProfile)

export default router;