import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },

    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// At least postId or commentId should exist
likeSchema.pre("validate", function () {
  if (!this.postId && !this.commentId) {
    throw new Error("Either postId or commentId is required");
  }

  if (this.postId && this.commentId) {
    throw new Error("Use either postId or commentId, not both");
  }
});

// Prevent duplicate post likes
likeSchema.index(
  { userId: 1, postId: 1 },
  {
    unique: true,
    partialFilterExpression: { postId: { $type: "objectId" } },
  }
);

// Prevent duplicate comment/reply likes
likeSchema.index(
  { userId: 1, commentId: 1 },
  {
    unique: true,
    partialFilterExpression: { commentId: { $type: "objectId" } },
  }
);

const Like = mongoose.model("Like", likeSchema);

export default Like;