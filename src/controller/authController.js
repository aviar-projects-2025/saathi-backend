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
import Referral from '../model/referral.js';

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

const normalizeMobileNumber = (mobileNumber) => {
    if (!mobileNumber) {
        return null;
    }

    let phone = mobileNumber.toString().trim();

    // Remove spaces, brackets, hyphens
    phone = phone.replace(/[\s()-]/g, "");

    // Already E.164
    if (phone.startsWith("+")) {
        return phone;
    }

    // 10-digit Indian number
    if (phone.length === 10 && phone.startsWith("9")) {
        return `+91${phone}`;
    }

    // 10-digit US number
    if (phone.length === 10) {
        return `+1${phone}`;
    }

    // 91XXXXXXXXXX
    if (phone.length === 12 && phone.startsWith("91")) {
        return `+${phone}`;
    }

    // 1XXXXXXXXXX
    if (phone.length === 11 && phone.startsWith("1")) {
        return `+${phone}`;
    }

    return null;
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
            password,
            gender,
            mobile,
            bio,
            city,
            language,
            dob,
            referredBy
        } = req.body;

        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this mobile number'
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
            password,
            gender,
            mobile,
            bio,
            dob,
            city,
            referralCode,
            referredBy: referredById || null
        });

        await user.save();

        // await sendWelcomeEmail(email, firstName);

        const token = createJWT(user._id, user.email);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
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

        if (!mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        const phoneNumber = normalizeMobileNumber(mobileNumber);

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number",
            });
        }

        const referral = await Referral.findOne({
            mobile: phoneNumber,
        });

        if (!referral) {
            return res.status(404).json({
                success: false,
                status: "NOT_FOUND",
                message:
                    "No referral found for this mobile number. Please get a referral to sign up.",
            });
        }

        if (referral.status === "Verified") {
            return res.status(200).json({
                success: true,
                status: "VERIFIED",
                message:
                    "Your mobile number is already verified. Please login.",
            });
        }

        if (referral.status === "Waiting") {
            const isDevelopment =
                process.env.NODE_ENV === "development";

            const isProduction =
                process.env.NODE_ENV === "production";

            if (isDevelopment) {
                // console.log("=================================");
                // console.log("Development Login OTP");
                // console.log("Mobile:", phoneNumber);
                // console.log("OTP: 123456");
                // console.log("=================================");

                return res.status(200).json({
                    success: true,
                    status: "OTP_SENT",
                    message: "OTP sent successfully",
                    development: true,
                });
            }

            if (isProduction) {
                const verification = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SID)
                    .verifications.create({
                        to: phoneNumber,
                        channel: "sms",
                    });

                return res.status(200).json({
                    success: true,
                    status: "OTP_SENT",
                    message: "OTP sent successfully",
                    twilioStatus: verification.status,
                });
            }

            return res.status(500).json({
                success: false,
                message: "Invalid NODE_ENV configuration",
            });
        }

        return res.status(400).json({
            success: false,
            status: referral.status,
            message:
                "Invalid referral status. Please contact support.",
        });
    } catch (error) {
        console.error("Send Login OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
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
                city: user.city,
                language: user.language,
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

export const sendLoginOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body;

        if (!mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        // =====================================================
        // NORMALIZE MOBILE NUMBER
        // =====================================================

        let phoneNumber = mobileNumber.toString().trim();

        if (process.env.NODE_ENV === "development") {
            if (phoneNumber.startsWith("+91")) {
                // Already correct
            } else if (
                phoneNumber.startsWith("91") &&
                phoneNumber.length === 12
            ) {
                phoneNumber = `+${phoneNumber}`;
            } else {
                phoneNumber = `+91${phoneNumber}`;
            }

            if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid Indian mobile number",
                });
            }
        } else{
            if (phoneNumber.startsWith("+1")) {
                // Already correct
            } else if (
                phoneNumber.startsWith("1") &&
                phoneNumber.length === 11
            ) {
                phoneNumber = `+${phoneNumber}`;
            } else {
                phoneNumber = `+1${phoneNumber}`;
            }

            if (!/^\+1[2-9]\d{9}$/.test(phoneNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid US mobile number",
                });
            }
        }


        // =====================================================
        // CHECK REFERRAL
        // =====================================================

        const referral = await Referral.findOne({
            mobile: phoneNumber,
        });

        // =====================================================
        // NO REFERRAL
        // =====================================================

        if (!referral) {
            return res.status(404).json({
                success: false,
                status: "NOT_FOUND",
                message:
                    "No referral found for this mobile number. Please get a referral to sign up.",
            });
        }

        // =====================================================
        // WAITING REFERRAL
        // =====================================================

        if (referral.status === "Waiting") {

            // -------------------------------------------------
            // DEVELOPMENT OTP
            // -------------------------------------------------

            // if (process.env.NODE_ENV === "development") {

            // const developmentOtp = "123456";

            // console.log("====================================");
            // console.log("DEVELOPMENT LOGIN OTP");
            // console.log("Mobile:", phoneNumber);
            // console.log("OTP:", developmentOtp);
            // console.log("====================================");

            // Change referral status AFTER OTP is sent
            // referral.status = "Verified";
            // await referral.save();

            return res.status(500).json({
                success: false,
                status: "Waiting",
                message: "Signup to login",
                // development: true,
            });
            // }

        }

        // =====================================================
        // VERIFIED REFERRAL
        // =====================================================

        if (referral.status === "Verified") {

            const user = await User.findOne({
                mobile: phoneNumber,
            });

            // -------------------------------------------------
            // VERIFIED BUT USER DOES NOT EXIST
            // -------------------------------------------------

            if (!user) {
                return res.status(403).json({
                    success: false,
                    status: "VERIFIED_NOT_REGISTERED",
                    message:
                        "Your referral is verified. Please complete your registration.",
                });
            }

            // -------------------------------------------------
            // USER ACCOUNT STATUS
            // -------------------------------------------------

            if (user.refApprove === "Waiting") {
                return res.status(403).json({
                    success: false,
                    status: "WAITING",
                    message:
                        "Your account is not approved yet. Please wait for approval.",
                });
            }

            if (user.refApprove === "Blocked") {
                return res.status(403).json({
                    success: false,
                    status: "BLOCKED",
                    message:
                        "Your account is blocked. Please contact support.",
                });
            }

            // =================================================
            // SEND LOGIN OTP
            // =================================================

            if (process.env.NODE_ENV === "development") {

                const developmentOtp = "123456";

                // console.log("====================================");
                // console.log("DEVELOPMENT LOGIN OTP");
                // console.log("Mobile:", phoneNumber);
                // console.log("OTP:", developmentOtp);
                // console.log("====================================");

                return res.status(200).json({
                    success: true,
                    status: "OTP_SENT",
                    message: "OTP sent successfully",
                    development: true,
                });
            }

            await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SID)
                .verifications
                .create({
                    to: phoneNumber,
                    channel: "sms",
                });

            return res.status(200).json({
                success: true,
                status: "OTP_SENT",
                message: "OTP sent successfully",
            });
        }

        // =====================================================
        // UNKNOWN REFERRAL STATUS
        // =====================================================

        return res.status(403).json({
            success: false,
            status: referral.status,
            message:
                "Your referral is not eligible for login. Please contact support.",
        });

    } catch (error) {
        console.error("Send Login OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process login request",
        });
    }
};

export const verifyLoginOtp = async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body;

        if (!mobileNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile number and OTP are required",
            });
        }

        const otpValue = otp.toString().trim();

        // =====================================================
        // VALIDATE OTP
        // =====================================================

        if (!/^\d{6}$/.test(otpValue)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 6-digit OTP",
            });
        }

        // =====================================================
        // NORMALIZE MOBILE NUMBER
        // =====================================================

        let phoneNumber = mobileNumber.toString().trim();

        if (phoneNumber.startsWith("+91")) {
            // Already correct
        } else if (
            phoneNumber.startsWith("91") &&
            phoneNumber.length === 12
        ) {
            phoneNumber = `+${phoneNumber}`;
        } else {
            phoneNumber = `+91${phoneNumber}`;
        }

        // =====================================================
        // VALIDATE MOBILE
        // =====================================================

        if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid Indian mobile number",
            });
        }

        // =====================================================
        // FIND USER
        // =====================================================

        const user = await User.findOne({
            mobile: phoneNumber,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "No account found with this mobile number. Please sign up first.",
            });
        }

        // =====================================================
        // ACCOUNT STATUS
        // =====================================================

        if (user.refApprove === "Waiting") {
            return res.status(403).json({
                success: false,
                message:
                    "Your account is not approved yet. Please wait for approval.",
            });
        }

        if (user.refApprove === "Blocked") {
            return res.status(403).json({
                success: false,
                message:
                    "Your account is blocked. Please contact support.",
            });
        }

        // =====================================================
        // DEVELOPMENT OTP
        // =====================================================

        if (process.env.NODE_ENV === "development") {

            if (otpValue !== "123456") {
                return res.status(400).json({
                    success: false,
                    message: "Incorrect code, please try again",
                });
            }

        }

        // =====================================================
        // PRODUCTION - TWILIO VERIFY
        // =====================================================

        if (process.env.NODE_ENV === "production") {

            const verificationCheck =
                await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SID)
                    .verificationChecks
                    .create({
                        to: phoneNumber,
                        code: otpValue,
                    });

            if (verificationCheck.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message: "Incorrect code, please try again",
                });
            }
        }

        // =====================================================
        // CREATE JWT
        // =====================================================

        const token = createJWT(
            user._id,
            user.mobile
        );

        // =====================================================
        // RESPONSE
        // =====================================================

        return res.status(200).json({
            success: true,
            message: "Login successful",

            token,

            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,

                // Keep this only if email still exists
                // Remove later when email is completely removed
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
                completedRideCount: user.completedRideCount,
            },
        });

    } catch (error) {

        console.error(
            "Verify Login OTP Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to verify OTP",
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        // Frontend sends: mobileNumber: "+919876543210"
        const { mobileNumber } = req.body;
        if (!mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        // Remove spaces if any
        const phoneNumber = mobileNumber.replace(/\s/g, "");

        if (!/^\+\d{11,15}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid mobile number",
            });
        }

        const mobile = phoneNumber;

        // console.log(mobile)

        // Find user
        const user = await User.findOne({ mobile });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this mobile number",
            });
        }

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
                success: false,
                message: "Mobile number and OTP are required",
            });
        }

        // =====================================================
        // NORMALIZE PHONE NUMBER
        // =====================================================

        let phoneNumber = mobileNumber
            .toString()
            .trim()
            .replace(/[\s()-]/g, "");

        if (!phoneNumber.startsWith("+")) {
            // 10 digit number
            if (phoneNumber.length === 10) {
                phoneNumber = `+91${phoneNumber}`;
            }

            // 1XXXXXXXXXX
            else if (
                phoneNumber.length === 11 &&
                phoneNumber.startsWith("1")
            ) {
                phoneNumber = `+${phoneNumber}`;
            }

            // 91XXXXXXXXXX
            else if (
                phoneNumber.length === 12 &&
                phoneNumber.startsWith("91")
            ) {
                phoneNumber = `+${phoneNumber}`;
            }
        }

        // =====================================================
        // BASIC PHONE VALIDATION
        // =====================================================

        if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number",
            });
        }

        // =====================================================
        // OTP VALIDATION
        // =====================================================

        if (!/^\d{6}$/.test(otp.toString())) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits",
            });
        }

        // =====================================================
        // VERIFY OTP
        // =====================================================

        let otpVerified = false;

        // =====================================================
        // DEVELOPMENT
        // =====================================================

        if (process.env.NODE_ENV === "development") {
            console.log("Development OTP verification");
            console.log("Mobile:", phoneNumber);
            console.log("OTP:", otp);

            // Dummy OTP for development
            if (otp.toString() !== "123456") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP",
                });
            }

            otpVerified = true;
        }

        // =====================================================
        // PRODUCTION
        // =====================================================

        else if (process.env.NODE_ENV === "production") {
            // Production should only allow US numbers
            if (!phoneNumber.startsWith("+1")) {
                return res.status(400).json({
                    success: false,
                    message: "Only US mobile numbers are allowed",
                });
            }

            const verificationCheck =
                await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SID)
                    .verificationChecks.create({
                        to: phoneNumber,
                        code: otp.toString(),
                    });

            if (verificationCheck.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired OTP",
                });
            }

            otpVerified = true;
        }

        // =====================================================
        // INVALID ENVIRONMENT
        // =====================================================

        else {
            return res.status(500).json({
                success: false,
                message: "Invalid NODE_ENV configuration",
            });
        }

        // =====================================================
        // OTP VERIFIED
        // UPDATE REFERRAL STATUS
        // =====================================================

        if (otpVerified) {
            const referral = await Referral.findOne({
                mobileNumber: phoneNumber,
            });

            if (referral) {
                referral.status = "Verified";
                await referral.save();

                console.log(
                    `Referral verified for mobile: ${phoneNumber}`
                );
            } else {
                console.log(
                    `No referral found for mobile: ${phoneNumber}`
                );
            }

            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
            });
        }

    } catch (error) {
        console.error("Verify OTP Error:", error);

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

        // -----------------------------------
        // Verify JWT
        // -----------------------------------
        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            console.error(
                "JWT verification error:",
                error.message
            );

            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }
        // -----------------------------------
        // Check token purpose
        // -----------------------------------
        if (decoded.purpose !== "password_reset") {
            return res.status(401).json({
                success: false,
                message: "Invalid reset token",
            });
        }

        // -----------------------------------
        // Normalize mobile number
        // -----------------------------------
        const normalizedMobile = mobileNumber


        // -----------------------------------
        // Compare mobile numbers
        // -----------------------------------
        if (
            decoded.mobileNumber !== normalizedMobile
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid token for this mobile number",
            });
        }

        // -----------------------------------
        // Find user
        // -----------------------------------
        const user = await User.findOne({
            mobile: normalizedMobile,
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // -----------------------------------
        // Hash new password
        // -----------------------------------
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
        console.error(
            "Reset password error:",
            error
        );

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
        const { mobileNumber, otp } = req.body;
        if (!mobileNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile number and OTP are required",
            });
        }

        // -----------------------------------
        // Prepare phone number for Twilio
        // -----------------------------------
        const phoneNumber = mobileNumber.startsWith("+")
            ? mobileNumber
            : `+91${mobileNumber}`;
        // -----------------------------------
        // Verify OTP using Twilio
        // -----------------------------------
        const verificationCheck = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verificationChecks.create({
                to: phoneNumber,
                code: otp,
            });


        if (verificationCheck.status !== "approved") {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        // -----------------------------------
        // Get 10-digit number for MongoDB
        // -----------------------------------
        const mobile = phoneNumber;


        // -----------------------------------
        // Find user
        // -----------------------------------
        const user = await User.findOne({
            mobile: mobile,
        });


        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // -----------------------------------
        // Create password reset token
        // -----------------------------------
        const resetToken = jwt.sign(
            {
                mobileNumber: mobile,
                purpose: "password_reset",
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "10m",
            }
        );

        // console.log(
        //     "Reset token generated:",
        //     resetToken
        // );

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            token: resetToken,
        });

    } catch (error) {
        console.error(
            "Forgot Password OTP verification error:",
            error
        );

        return res.status(400).json({
            success: false,
            message: "Invalid or expired OTP",
        });
    }
};

export const sendChangeMobileOtp = async (req, res) => {
    try {
        const { mobileNumber } = req.body;

        // =====================================================
        // AUTHENTICATED USER
        // =====================================================

        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        if (!mobileNumber) {
            return res.status(400).json({
                success: false,
                message: "New mobile number is required",
            });
        }

        // =====================================================
        // NORMALIZE NEW PHONE NUMBER
        // =====================================================

        const phoneNumber = normalizeMobileNumber(mobileNumber);

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number",
            });
        }

        // =====================================================
        // PRODUCTION - ONLY US NUMBERS
        // =====================================================

        if (
            process.env.NODE_ENV === "production" &&
            !phoneNumber.startsWith("+1")
        ) {
            return res.status(400).json({
                success: false,
                message: "Only US mobile numbers are allowed",
            });
        }

        // =====================================================
        // GET CURRENT USER
        // =====================================================

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // =====================================================
        // CHECK IF NEW NUMBER IS SAME AS CURRENT NUMBER
        // =====================================================

        if (user.mobile === phoneNumber) {
            return res.status(400).json({
                success: false,
                message:
                    "New mobile number must be different from your current number",
            });
        }

        // =====================================================
        // CHECK USER COLLECTION
        // =====================================================

        const existingUser = await User.findOne({
            mobile: phoneNumber,
            _id: { $ne: userId },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                status: "ALREADY_USED",
                message:
                    "This mobile number is already registered with another account.",
            });
        }

        // =====================================================
        // CHECK REFERRAL COLLECTION
        // =====================================================

        const existingReferral = await Referral.findOne({
            mobile: phoneNumber,
        });

        if (existingReferral) {
            return res.status(409).json({
                success: false,
                status: "ALREADY_USED",
                message:
                    "This mobile number is already associated with a referral.",
            });
        }

        // =====================================================
        // DEVELOPMENT
        // =====================================================

        if (process.env.NODE_ENV === "development") {
            console.log("=================================");
            console.log("Development Change Mobile OTP");
            console.log("User:", userId);
            console.log("New Mobile:", phoneNumber);
            console.log("OTP: 123456");
            console.log("=================================");

            return res.status(200).json({
                success: true,
                status: "OTP_SENT",
                message: "OTP sent successfully",
                development: true,
            });
        }

        // =====================================================
        // PRODUCTION
        // =====================================================

        if (process.env.NODE_ENV === "production") {
            const verification = await twilioClient.verify.v2
                .services(process.env.TWILIO_VERIFY_SID)
                .verifications.create({
                    to: phoneNumber,
                    channel: "sms",
                });

            return res.status(200).json({
                success: true,
                status: "OTP_SENT",
                message: "OTP sent successfully",
                twilioStatus: verification.status,
            });
        }

        // =====================================================
        // INVALID ENVIRONMENT
        // =====================================================

        return res.status(500).json({
            success: false,
            message: "Invalid NODE_ENV configuration",
        });
    } catch (error) {
        console.error("Send Change Mobile OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP",
        });
    }
};

export const verifyChangeMobileOtp = async (req, res) => {
    try {
        const { mobileNumber, otp } = req.body;

        // =====================================================
        // AUTHENTICATED USER
        // =====================================================

        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        if (!mobileNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: "Mobile number and OTP are required",
            });
        }

        // =====================================================
        // NORMALIZE PHONE NUMBER
        // =====================================================

        const phoneNumber = normalizeMobileNumber(mobileNumber);

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile number",
            });
        }

        // =====================================================
        // OTP VALIDATION
        // =====================================================

        if (!/^\d{6}$/.test(otp.toString())) {
            return res.status(400).json({
                success: false,
                message: "OTP must be 6 digits",
            });
        }

        // =====================================================
        // GET CURRENT USER
        // =====================================================

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // =====================================================
        // SAME NUMBER CHECK
        // =====================================================

        if (user.mobile === phoneNumber) {
            return res.status(400).json({
                success: false,
                message:
                    "New mobile number must be different from your current number",
            });
        }

        // =====================================================
        // PRODUCTION - ONLY US NUMBERS
        // =====================================================

        if (
            process.env.NODE_ENV === "production" &&
            !phoneNumber.startsWith("+1")
        ) {
            return res.status(400).json({
                success: false,
                message: "Only US mobile numbers are allowed",
            });
        }

        // =====================================================
        // VERIFY OTP
        // =====================================================

        if (process.env.NODE_ENV === "development") {
            console.log("Development Change Mobile OTP Verification");
            console.log("User:", userId);
            console.log("Mobile:", phoneNumber);
            console.log("OTP:", otp);

            if (otp.toString() !== "123456") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP",
                });
            }
        } else if (process.env.NODE_ENV === "production") {
            const verificationCheck =
                await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SID)
                    .verificationChecks.create({
                        to: phoneNumber,
                        code: otp.toString(),
                    });

            if (verificationCheck.status !== "approved") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired OTP",
                });
            }
        } else {
            return res.status(500).json({
                success: false,
                message: "Invalid NODE_ENV configuration",
            });
        }

        // =====================================================
        // CHECK AGAIN BEFORE UPDATING
        // =====================================================

        const existingUser = await User.findOne({
            mobile: phoneNumber,
            _id: { $ne: userId },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                status: "ALREADY_USED",
                message:
                    "This mobile number is already registered with another account.",
            });
        }

        const existingReferral = await Referral.findOne({
            mobile: phoneNumber,
        });

        if (existingReferral) {
            return res.status(409).json({
                success: false,
                status: "ALREADY_USED",
                message:
                    "This mobile number is already associated with a referral.",
            });
        }

        // =====================================================
        // FIND CURRENT USER'S REFERRAL
        // =====================================================

        const referral = await Referral.findOne({
            mobile: user.mobile,
        });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message:
                    "Referral record not found for your current mobile number.",
            });
        }

        // =====================================================
        // UPDATE USER MOBILE
        // =====================================================

        user.mobile = phoneNumber;
        await user.save();

        // =====================================================
        // UPDATE REFERRAL MOBILE
        // =====================================================

        referral.mobile = phoneNumber;
        await referral.save();

        // =====================================================
        // SUCCESS
        // =====================================================

        return res.status(200).json({
            success: true,
            status: "MOBILE_CHANGED",
            message: "Mobile number changed successfully",
            mobile: phoneNumber,
        });
    } catch (error) {
        console.error("Verify Change Mobile OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to change mobile number",
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