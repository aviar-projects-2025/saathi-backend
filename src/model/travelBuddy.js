import mongoose from "mongoose";

const flightSegmentSchema = new mongoose.Schema({
  airline: { type: String, required: true },
  flightNumber: { type: String, required: true },
  fromCode: { type: String, required: true }, // e.g., MAA
  toCode: { type: String, required: true },   // e.g., DXB
  departureTime: { type: Date, required: true },
  arrivalTime: { type: Date, required: true },
});

const travelBuddySchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["parent", "companion"],
      required: true,
    },
    flights: [flightSegmentSchema], // 1 to 4 segments
    
    // Traveller Details (only for "parent" role)
    relationship: { type: String },
    ageBand: { type: String },
    
    // Common Details
    languages: [{ type: String }],
    help: [{ type: String }], // e.g., ["Transit guidance", "Wheelchair"]
    pickup: { type: String, enum: ["family", "saathi"], default: "family" },
    
    // Status
    status: {
      type: String,
      enum: ["OPEN", "MATCHED", "COMPLETED", "CANCELLED"],
      default: "OPEN",
    },
    matchedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Index for fast matching by flight number
travelBuddySchema.index({ "flights.flightNumber": 1, status: 1 });

export default mongoose.model("TravelBuddy", travelBuddySchema);