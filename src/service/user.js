import User from '../model/user.js';
import { getProfileImageSignedUrl } from '../controller/s3Controller.js';

/**
 * Helper: Attaches a signed URL to a single user object
 */
const attachSignedProfileUrl = async (user) => {
  if (!user) return user;
  const userData = typeof user.toObject === "function" ? user.toObject() : { ...user };
  
  if (!userData.profileImage) {
    return { ...userData, profileImageUrl: null };
  }
  
  try {
    return {
      ...userData,
      profileImageUrl: await getProfileImageSignedUrl(userData.profileImage),
    };
  } catch (error) {
    console.error("Failed to sign profile image URL:", error.message);
    return { ...userData, profileImageUrl: null };
  }
};

/**
 * Helper: Attaches a signed URL to an array of users
 */
const attachSignedProfileUrlsToList = async (users) => {
  return Promise.all(users.map(attachSignedProfileUrl));
};

export const userCreateService = async (userData) => {
  const cleanUserData = { ...userData };

  if (
    cleanUserData.inviteToken === null ||
    cleanUserData.inviteToken === undefined ||
    cleanUserData.inviteToken === ""
  ) {
    delete cleanUserData.inviteToken;
  }

  const user = await User.create(cleanUserData);
  return user;
};

// ★ FIXED: Attach signed URLs for all users
export const getAllUsers = async () => {
  const users = await User.find({}, { password: 0, __v: 0 }).lean();
  return await attachSignedProfileUrlsToList(users);
};

// ★ FIXED: Attach signed URL for the main user AND the referredBy user
export const getUserById = async (id) => {
  const user = await User.findById(id)
    .populate("referredBy", "firstName lastName profileImage city language")
    .lean();
    
  if (!user) return null;

  // Sign the main user's image
  let userWithUrl = await attachSignedProfileUrl(user);

  // Sign the referrer's image
  if (userWithUrl.referredBy && typeof userWithUrl.referredBy === "object") {
    userWithUrl.referredBy = await attachSignedProfileUrl(userWithUrl.referredBy);
  }

  return userWithUrl;
};

export const loggedinUser = async (email) => {
  return null; // (placeholder — no implementation in original)
};

// ★ FIXED: Attach signed URLs for top riders
export const getTopRidersService = async (limit) => {
  const riders = await User.find({ completedRideCount: { $gt: 0 } })
    .sort({ completedRideCount: -1 })
    .limit(limit)
    .select("firstName lastName city completedRideCount profileImage isVerified")
    .lean();
    
  return await attachSignedProfileUrlsToList(riders);
};

// ★ FIXED: Attach signed URL to the updated user profile
export const updateProfileService = async (userId, data) => {
  const isExist = await User.findById(userId);
  if (!isExist) {
    throw new Error("User not found");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    data,
    { new: true }
  ).lean();

  return await attachSignedProfileUrl(updatedUser);
};