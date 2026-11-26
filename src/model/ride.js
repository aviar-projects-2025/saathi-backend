// model/ride.js
import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    /* ─────────── Ownership / kind ─────────── */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    kind: {
      type: String,
      enum: ["offer", "request"],
      default: "offer",
      index: true,
    },
    actualDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    helpProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HelpProposal",
      default: null,
    },

    /* ─────────── Trip basics ─────────── */
    modeOfTravel: {
      type: String,
      enum: ["Car", "Bus", "Bike", "Flight", "Ship", "Train"],
      required: true,
    },

    from: { type: String, required: true },
    destination: { type: String, required: true },

    // ★ TC-1: public labels (city / airport / landmark) — NEVER the street
    fromPublic: { type: String, default: "" },
    destinationPublic: { type: String, default: "" },

    fromLocation: {
      address: { type: String, default: "" },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    destinationLocation: {
      address: { type: String, default: "" },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },

    distanceKm: { type: Number, min: 0 },
    duration: { type: Number, min: 0 },

    startTime: { type: Date, required: true },
    endTime: { type: Date },
    lastRideStartedNotificationAt: { type: Date, default: null },

    timeZone: { type: String, default: "Central (CT)" },
    category: { type: String, default: "" },
    description: { type: String, default: "" },

    /* ─────────── TC-4: US geo-fence flag ─────────── */
    isUS: { type: Boolean, default: false, index: true },

    /* ─────────── Offer-only: seats, cost, options ─────────── */
    availableSeats: {
      type: Number,
      required: function () {
        return this.kind === "offer" && this.modeOfTravel !== "Flight";
      },
      default: function () {
        if (this.kind === "request") return undefined;
        return this.modeOfTravel === "Flight" ? 1 : undefined;
      },
      min: 0,
      max: 7,
    },
    totalSeats: {
      type: Number,
      required: function () {
        return this.kind === "offer" && this.modeOfTravel !== "Flight";
      },
      default: function () {
        if (this.kind === "request") return undefined;
        return this.modeOfTravel === "Flight" ? 1 : undefined;
      },
    },

    fuelSharing: { type: Number },
    costPerSeat: { type: Number, default: null, min: 0 },

    luggageSpace: {
      type: String,
      enum: ["None", "1–2 bags", "3+ bags", ""],
      default: "None",
    },
    childFriendly: { type: Boolean, default: false },
    recurringRide: { type: Boolean, default: false },
    womenOnly: { type: Boolean, default: false },
    helpCanOffer: { type: [String], default: [] },

    /* ─────────── Request-only ─────────── */
    flexibility: {
      type: String,
      enum: ["± 15 min", "± 30 min", "± 1 hour", "± 2 hours", ""],
      default: "",
    },
    passengers: { type: Number, default: 1, min: 1, max: 7 },
    bags: { type: Number, default: 0, min: 0, max: 10 },
    womenDriversOnly: { type: Boolean, default: false },
    travelingWithChild: { type: Boolean, default: false },

    /* ─────────── Private ─────────── */
    exactPickup: { type: String, default: "" },
    notes: { type: String, default: "" },
    confirmCostSharing: { type: Boolean, default: false },

    /* ─────────── Flight fields (kept) ─────────── */
    fromAirport: {
      type: String,
      required: function () { return this.modeOfTravel === "Flight"; },
    },
    toAirport: {
      type: String,
      required: function () { return this.modeOfTravel === "Flight"; },
    },
    flightNumber: {
      type: String,
      required: function () { return this.modeOfTravel === "Flight"; },
    },
    airlineName: {
      type: String,
      required: function () { return this.modeOfTravel === "Flight"; },
    },
    travellerType: {
      type: String,
      enum: [
        "First-time traveller",
        "Senior citizen support",
        "Student travel companion",
        "Women-only companion",
        "Family companion",
        "Regular",
        "parent",
        "companion",
        "",
      ],
      required: function () { return this.modeOfTravel === "Flight"; },
    },
    language: {
      type: [String],
      required: function () { return this.modeOfTravel === "Flight"; },
      validate: {
        validator: function (value) {
          if (this.modeOfTravel === "Flight") return value && value.length > 0;
          return true;
        },
        message: "Select at least one language",
      },
      default: [],
    },

    /* ─────────── Preference / accessibility (kept) ─────────── */
    ageGroupPreference: {
      type: String,
      enum: ["18-25", "26-40", "41-60", "60+", "Any", "60 and over", "70 and over", "80 and over"],
      default: "Any",
    },
    medicalAssistance: { type: Boolean, default: false },
    languageSupport: { type: Boolean, default: false },
    transitHelp: { type: Boolean, default: false },
    baggageHelp: { type: Boolean, default: false },

    genderPreference: {
      type: String,
      enum: ["Male", "Female", "Any"],
      default: "Any",
    },

    /* ─────────── Status (TC-19 included) ─────────── */
    status: {
      type: String,
      enum: ["OPEN", "FULL", "CLOSED", "EXPIRED", "COMPLETED", "CANCELLED"],
      default: "OPEN",
    },
    travelStatus: {
      type: String,
      enum: ["Waiting", "Started", "Ongoing", "Completed", "Cancelled", "Expired"],
      default: "Waiting",
    },
    expiredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* Useful indexes for Find Ride / My Rides queries */
rideSchema.index({ kind: 1, status: 1, startTime: 1 });
rideSchema.index({ createdBy: 1, kind: 1, createdAt: -1 });
rideSchema.index({ isUS: 1, status: 1, startTime: 1 });          // ★ TC-4
rideSchema.index({ isUS: 1, createdBy: 1, travelStatus: 1 });    // ★ TC-4
rideSchema.index({ travelStatus: 1, startTime: 1 });             // ★ TC-19

const Ride = mongoose.model("Ride", rideSchema);
export default Ride;