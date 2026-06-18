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

const requestSchema = new mongoose.Schema(
  {
     createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    seatsRequested: {
      type: Number,
      default: 1,
    },

    membersCount: {
      type: Number,
      required: true,
      min: 1,
    },

    members: {
      type: [memberSchema],
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    message: {
      type: String,
    },

    requestType: {
      type: String,
      enum: ["SEAT", "COMPANION"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

const bookRideSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    from: {
      type: String,
      required: true,
      trim: true,
    },

    destination: {
      type: String,
      required: true,
      trim: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    modeOfTravel: {
      type: String,
      enum: ["Car", "Bus", "Bike", "Flight", "Ship", "Train"],
      required: true,
    },

    availableSeats: {
      type: Number,
      required: function () {
        return this.modeOfTravel !== "Flight";
      },
      default: 1,
      min: 0,
    },

    fuelSharing: {
      type: Boolean,
      default: false,
    },

    fromCountry: String,
    fromAirport: String,
    toCountry: String,
    toAirport: String,
    flightNumber: String,
    airlineName: String,

    transitAirport: {
      type: String,
      default: "",
    },

    travellerType: {
      type: String,
      enum: [
        "First-time traveller",
        "Senior citizen support",
        "Student travel companion",
        "Women-only companion",
        "Family companion",
        "",
      ],
      default: "",
    },

    language: String,

    ageGroupPreference: {
      type: String,
      enum: ["18-25", "26-40", "41-60", "60+", "Any"],
      default: "Any",
    },

    medicalAssistance: {
      type: Boolean,
      default: false,
    },

    languageSupport: {
      type: Boolean,
      default: false,
    },

    transitHelp: {
      type: Boolean,
      default: false,
    },

    baggageHelp: {
      type: Boolean,
      default: false,
    },

    description: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "FULL", "CLOSED"],
      default: "OPEN",
    },

    genderPreference: {
      type: String,
      enum: ["Male", "Female", "Any"],
      default: "Any",
    },

    requests: {
      type: [requestSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("BookRide", bookRideSchema);