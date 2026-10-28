
import express from "express";
import { verifyToken } from "../../config/tokenVerify.js";

import {
  createUploadUrl,
  createViewUrl,
  createRegistrationUploadUrl,
} from "../controller/s3Controller.js";

const router = express.Router();

// Existing routes for authenticated users.
router.post("/upload-url", verifyToken, createUploadUrl);
router.post("/view-url", verifyToken, createViewUrl);

// New route for OTP-verified but not-yet-approved registrants.
router.post(
  "/registration-upload-url",
  createRegistrationUploadUrl
);

export default router;
