import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const bookRideSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    rideOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    seatsRequested: {
      type: Number,
      default: 1,
      min: 1,
    },

    membersCount: {
      type: Number,
      required: true,
      min: 1,
    },

    members: {
      type: [memberSchema],
      default: [],
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      trim: true,
    },

    requestType: {
      type: String,
      enum: ["SEAT", "COMPANION"],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
        "AUTO_REJECTED",
      ],
      default: "PENDING",
      index: true,
    },
  },
  { timestamps: true }
);

// One user can request one ride only once
bookRideSchema.index(
  { rideId: 1, requestedBy: 1 },
  { unique: true }
);

const BookRide = mongoose.model("BookRide", bookRideSchema);

export default BookRide;