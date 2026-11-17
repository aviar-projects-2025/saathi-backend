import mongoose from "mongoose";

const savePostSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

savePostSchema.index({ postId: 1, userId: 1 }, { unique: true });

const SavedPost =
  mongoose.models.SavedPost || mongoose.model("SavedPost", savePostSchema);

export default SavedPost;