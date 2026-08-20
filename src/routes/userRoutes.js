import express from 'express'
import { createUser, getUsers, loginUser, getSingleUser, updateProfile, changePassword, getTopRiders, getMe } from '../controller/user.js'
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { getUploadSignature } from '../../config/cloudinary.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// signup Route
router.post("/", createUser);
router.get("/", getUsers);

// ✅ specific routes BEFORE dynamic /:id
router.get("/top-riders", getTopRiders);
router.patch("/change-password/:userId", changePassword);

//login route
router.post("/login", loginUser);
// router.post('/update/:userId', upload.single("profileImage"), updateProfile)
router.post('/update/:userId', updateProfile)


router.get("/upload-signature", getUploadSignature);

// ✅ dynamic route LAST

router.get("/me", verifyToken, getMe);
router.get("/:id", getSingleUser);

export default router;