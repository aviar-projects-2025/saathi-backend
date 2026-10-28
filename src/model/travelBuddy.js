import mongoose from "mongoose";

const flightSchema = new mongoose.Schema({
  airline: { type: String, required: true, trim: true },
  flightNumber: { type: String, required: true, trim: true, uppercase: true },
  fromCode: { type: String, required: true, trim: true, uppercase: true },
  toCode: { type: String, required: true, trim: true, uppercase: true },
  departureTime: { type: Date, required: true },
  arrivalTime: { type: Date, required: true },
}, { _id: true });

const travelBuddySchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["parent", "companion"], required: true, index: true },
  flights: {
    type: [flightSchema],
    required: true,
    validate: {
      validator: (flights) => Array.isArray(flights) && flights.length >= 1 && flights.length <= 4,
      message: "A trip must contain between 1 and 4 flight segments.",
    },
  },
  relationship: { type: String, trim: true, default: "" },
  ageBand: { type: String, trim: true, default: "" },
  languages: { type: [String], default: [] },
  help: { type: [String], default: [] },
  pickup: { type: String, enum: ["family", "saathi"], default: "family" },
  status: { type: String, enum: ["OPEN", "MATCHED", "COMPLETED", "CANCELLED"], default: "OPEN", index: true },
  matchedWith: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // True for a trip created only as part of a request. Public queries must exclude it.
  isRequestSubmission: { type: Boolean, default: false, index: true },
}, { timestamps: true });

travelBuddySchema.index({ status: 1, role: 1, createdAt: -1 });
travelBuddySchema.index({ createdBy: 1, status: 1, createdAt: -1 });

export default mongoose.models.TravelBuddy || mongoose.model("TravelBuddy", travelBuddySchema);
