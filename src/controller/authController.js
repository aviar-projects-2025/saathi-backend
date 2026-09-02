import User from '../model/user.js';
import OTP from '../model/OTP.js';
import {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordResetConfirmation
} from '../service/emailService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import twilioClient from '../../config/twilio.js';

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const createJWT = (userId, email) => {
    return jwt.sign(
        { userId, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};
const register = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            gender,
            mobile,
            bio,
            dob,
            referredBy
        } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const referralCode = generateReferralCode();

        let referredById = null;
        if (referredBy) {
            const referrer = await User.findOne({ referralCode: referredBy });
            if (referrer) {
                referredById = referrer._id;
            }
        }

        const user = new User({
            firstName,
            lastName,
            email,
            password,
            gender,
            mobile,
            bio,
            dob,
            referralCode,
            referredBy: referredById || null
        });

        await user.save();

        await sendWelcomeEmail(email, firstName);

        const token = createJWT(user._id, user.email);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                referralCode: user.referralCode,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const sendOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        console.log(mobileNumber)
        if (!mobileNumber) {
            return res.status(400).json({
                message: "Mobile number is required",
            });
        }

        const phoneNumber = mobileNumber.startsWith("+")
            ? mobileNumber
            : `+91${mobileNumber}`;

        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verifications.create({
                to: phoneNumber,
                channel: "sms",
            });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            status: verification.status,
        });

    } catch (error) {
        console.error("Twilio Send OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
            error: error.message,
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = createJWT(user._id, user.email);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profileImage: user.profileImage,
                gender: user.gender,
                mobile: user.mobile,
                bio: user.bio,
                dob: user.dob,
                role: user.role,
                referralCode: user.referralCode,
                referredBy: user.referredBy,
                refApprove: user.refApprove,
                completedRideCount: user.completedRideCount
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { mobile_number: mobile } = req.body;

        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 10-digit mobile number",
            });
        }

        // Find user
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this mobile number",
            });
        }

        // Convert to E.164 format
        const phoneNumber = `+91${mobile}`;

        // Send OTP through Twilio Verify
        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verifications.create({
                to: phoneNumber,
                channel: "sms",
            });

        return res.status(200).json({
            success: true,
            message: "OTP sent to your mobile number",
            status: verification.status,
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
        });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const otpRecord = await OTP.findOne({
            email,
            otp,
            used: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        otpRecord.used = true;
        await otpRecord.save();

        const resetToken = jwt.sign(
            { email, otpId: otpRecord._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            success: true,
            message: 'OTP verified successfully',
            token: resetToken
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body;

        if (!mobileNumber || !otp) {
            return res.status(400).json({
                message: "Mobile number and OTP are required",
            });
        }

        const phoneNumber = mobileNumber.startsWith("+")
            ? mobileNumber
            : `+91${mobileNumber}`;

        const verificationCheck = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verificationChecks.create({
                to: phoneNumber,
                code: otp,
            });

        if (verificationCheck.status !== "approved") {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
        });

    } catch (error) {
        console.error("Twilio Verify OTP Error:", error);

        return res.status(400).json({
            success: false,
            message: "Invalid or expired OTP",
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const {
            mobileNumber,
            token,
            newPassword,
        } = req.body;

        if (!mobileNumber || !token || !newPassword) {
            return res.status(400).json({
                success: false,
                message:
                    "Mobile number, token and new password are required",
            });
        }

        // Verify JWT
        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            console.error("JWT error:", error.message);

            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }

        // Check token purpose
        if (decoded.purpose !== "password_reset") {
            return res.status(401).json({
                success: false,
                message: "Invalid reset token",
            });
        }

        // Check mobile number
        if (decoded.mobileNumber !== mobileNumber) {
            return res.status(401).json({
                success: false,
                message: "Invalid token for this mobile number",
            });
        }

        // Find user
        const user = await User.findOne({
            mobile: mobileNumber,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);

        user.password = await bcrypt.hash(
            newPassword,
            salt
        );

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });

    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to reset password",
        });
    }
};

const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        await OTP.deleteMany({ email, used: false });

        const otp = generateOTP();
        const token = generateToken();

        await OTP.create({
            email,
            otp,
            token,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });

        await sendOTPEmail(email, otp, 'reset your password');

        res.json({
            success: true,
            message: 'New OTP sent to your email',
            devMode: process.env.NODE_ENV === 'development' ? { otp } : undefined
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { mobile_number : mobileNumber, otp } = req.body;

        console.log(mobileNumber, otp,'mobileNumber, otp')

        if (!mobileNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile number and OTP are required",
            });
        }

        const phoneNumber = mobileNumber.startsWith("+")
            ? mobileNumber
            : `+91${mobileNumber}`;

        const verificationCheck = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verificationChecks.create({
                to: phoneNumber,
                code: otp,
            });

        console.log(verificationCheck,'verificationCheck')

        if (verificationCheck.status !== "approved") {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        // Check user
        const user = await User.findOne({
            mobile: mobileNumber,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Create password reset token
        const resetToken = jwt.sign(
            {
                mobileNumber: mobileNumber,
                purpose: "password_reset",
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "10m",
            }
        );

        console.log("Reset token generated:", resetToken);

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            token: resetToken,
        });

    } catch (error) {
        console.error("Forgot Password OTP verification error:", error);

        return res.status(400).json({
            success: false,
            message: "Invalid or expired OTP",
        });
    }
};

export {
    register,
    login,
    forgotPassword,
    verifyOTP,
    resetPassword,
    resendOTP,
    sendOtp
};