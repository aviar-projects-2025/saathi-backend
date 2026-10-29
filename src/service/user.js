import User from '../model/user.js'

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

export const getAllUsers = async () => {
  const user = await User.find({}, { password: 0, __v: 0 });
  return user;
};

// ★ FIXED: Populate referredBy so the inviter name shows up
export const getUserById = async (id) => {
  const user = await User.findById(id)
    .populate("referredBy", "firstName lastName profileImage city language");
  return user;
};

export const loggedinUser = async (email) => {
  return null; // (placeholder — no implementation in original)
};

export const getTopRidersService = async (limit) => {
  return await User.find({ completedRideCount: { $gt: 0 } })
    .sort({ completedRideCount: -1 })
    .limit(limit)
    .select("firstName lastName city completedRideCount profileImage isVerified");
};

export const updateProfileService = async (userId, data) => {
  const isExist = await User.findById(userId);
  if (!isExist) {
    throw new Error("User not found");
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    data,
    { new: true }
  );

  return updatedUser;
};