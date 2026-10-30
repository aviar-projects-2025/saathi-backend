import mongoose from "mongoose";

const blockSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// One block per (blocker, blocked) pair
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

// Fast lookup: "who blocked me"
blockSchema.index({ blockedId: 1, blockerId: 1 });

const Block = mongoose.model("Block", blockSchema);

export default Block;