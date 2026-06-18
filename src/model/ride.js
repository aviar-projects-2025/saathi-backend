import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    modeOfTravel: {
      type: String,
      enum: ["Car", "Bus", "Bike", "Flight", "Ship", "Train"],
      required: true,
    },

    from: {
      type: String,
      required: true,
    },

    destination: {
      type: String,
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    // Normal ride fields
    availableSeats: {
      type: Number,
      required: function () {
        return this.modeOfTravel !== "Flight";
      },
      default: 1,
    },

    fuelSharing: {
      type: Boolean,
      default: false,
    },

    // Flight fields
    fromCountry: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    fromAirport: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    toCountry: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    toAirport: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    flightNumber: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    airlineName: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

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
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

    language: {
      type: String,
      required: function () {
        return this.modeOfTravel === "Flight";
      },
    },

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
  },
  {
    timestamps: true,
  }
);

const Ride = mongoose.model("Ride", rideSchema);

export default Ride;