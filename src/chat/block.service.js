import mongoose from "mongoose";
import Block from "./block.model.js";

export const blockUserService = async ({ blockerId, blockedId }) => {
  if (!mongoose.Types.ObjectId.isValid(blockedId)) {
    throw new Error("Invalid user ID");
  }
  if (String(blockerId) === String(blockedId)) {
    throw new Error("You cannot block yourself");
  }

  const existing = await Block.findOne({ blockerId, blockedId });
  if (existing) return existing;

  return Block.create({ blockerId, blockedId });
};

export const unblockUserService = async ({ blockerId, blockedId }) => {
  if (!mongoose.Types.ObjectId.isValid(blockedId)) {
    throw new Error("Invalid user ID");
  }

  const result = await Block.deleteOne({ blockerId, blockedId });
  return { deleted: result.deletedCount > 0 };
};

/**
 * Returns { blockedByMe, blockedMe } for the pair.
 */
export const getBlockStatusService = async ({ userId, otherUserId }) => {
  const [blockedByMe, blockedMe] = await Promise.all([
    Block.exists({ blockerId: userId, blockedId: otherUserId }),
    Block.exists({ blockerId: otherUserId, blockedId: userId }),
  ]);

  return {
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
    isBlocked: Boolean(blockedByMe) || Boolean(blockedMe),
  };
};

/**
 * IDs of users I blocked.
 */
export const listBlockedByMeService = async (userId) => {
  const blocks = await Block.find({ blockerId: userId })
    .populate("blockedId", "firstName lastName profileImage")
    .lean();

  return blocks.map((b) => b.blockedId).filter(Boolean);
};

/**
 * Set of user IDs I blocked OR who blocked me — used to exclude
 * people from search/chat lists.
 */
export const listMutuallyBlockedIdsService = async (userId) => {
  const [blocks, blocksAgainst] = await Promise.all([
    Block.find({ blockerId: userId }).distinct("blockedId"),
    Block.find({ blockedId: userId }).distinct("blockerId"),
  ]);

  return new Set([
    ...blocks.map(String),
    ...blocksAgainst.map(String),
  ]);
};