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
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        // Delete old unused OTPs
        await OTP.deleteMany({ email, used: false });

        const otp = generateOTP();
        const token = generateToken();

        await OTP.create({
            email,
            otp,
            token,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
        });

        const emailResult = await sendOTPEmail(email, otp, 'reset your password');

        res.json({
            success: true,
            message: 'OTP sent to your email',
            devMode: process.env.NODE_ENV === 'development' ? { otp } : undefined,
            emailSent: emailResult.success
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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

const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        if (decoded.email !== email) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token for this email'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        await OTP.deleteOne({ _id: decoded.otpId });

        await sendPasswordResetConfirmation(email, user.firstName);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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

export {
    register,
    login,
    forgotPassword,
    verifyOTP,
    resetPassword,
    resendOTP
};