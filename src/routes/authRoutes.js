import express from 'express';
import {
    register,
    login,
    forgotPassword,
    verifyOTP,
    resetPassword,
    resendOTP,
    // sendOTP,
    sendOtp,
    verifyOtp,
    verifyForgotPasswordOtp
} from '../controller/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/forgot-password/verify-otp',verifyForgotPasswordOtp)
// router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/resend-otp', resendOTP);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);


export default router;