import express from 'express';
import {
    register,
    login,
    forgotPassword,
    verifyOTP,
    resetPassword,
    resendOTP
} from '../controller/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/resend-otp', resendOTP);

export default router;