import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    room: {
      type: String,
      enum: ["immigration", "schools_kids", "housing", "automobiles", "services", "events", "general"],
      default: "general",
      index: true,
    },
    subCategory: { type: String }, // e.g., "Home services", "Renting out"
    postType: {
      type: String,
      enum: ["question", "looking_for", "offering", "recommend"],
      default: "question",
    },
    title: { type: String },
    description: { type: String },
    tags: [{ type: String }], 
    timeframe: { type: String },
    zipcode: { type: String },
    
    // NEW: For "Offering" cards (Screenshot 3)
    providerDetails: {
      rating: { type: Number },
      reviewCount: { type: Number },
      price: { type: String }, // e.g., "$60/hr"
      isInsured: { type: Boolean, default: false },
    },

    postImage: { type: String },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    likes: { type: Number, default: 0 },
    communityImgPublicId: { type: String },
    comments: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, comment: String, createdAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

communitySchema.index({ createdAt: -1 });
export default mongoose.model("Community", communitySchema);