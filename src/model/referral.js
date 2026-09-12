import mongoose from 'mongoose'

const referralSchema = mongoose.Schema({
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        required: true,
    },
    mobile: {
        type: String,
        unique: true,
    },
    status: {
        type: String,
        enum: ["Verified", "Waiting", 'Rejected'],
        default: "Waiting",
    },
    isMessageApproved : {
        type : Boolean,
        default : false
    },
    messageNumber : {
        type: String,
    },

}, 
{
    timestamps: true
})

const Referral = mongoose.model("Referral", referralSchema);

export default Referral;