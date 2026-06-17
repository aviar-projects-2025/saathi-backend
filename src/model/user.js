import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    dob: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"],
        default: "USER",
    },
    referralCode: {
        type: String,
        unique: true,
        required : true,
    },

    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        required : true,
    },

})

const User = mongoose.model("User", userSchema);

export default User;