import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },

    type: {
        type: String,
        required: true,
    },

    title: String,
    message: String,

    data: {
        type: Object,
        default: {},
    },

    isRead: {
        type: Boolean,
        default: false,
    },

}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification