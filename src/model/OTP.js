import mongoose from 'mongoose';

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    purpose: {
        type: String,
        enum: ['reset-password', 'verify-email'],
        default: 'reset-password'
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 10 * 60 * 1000)
    },
    used: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model("OTP", OTPSchema);

export default OTP;