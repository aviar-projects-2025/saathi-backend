import User from '../model/user.js'

export const userCreateService = async (userData) => {
  const user = await User.create(userData);
  return user;
};

export const getAllUsers = async () => {
  const user = await User.find({}, { password: 0, __v: 0 });
  return user
}

export const getUserById = async (id) => {
  const user = await User.findById(id);
  return user
}

export const loggedinUser = async (email) => {


  return user;
}

export const getTopRidersService = async (limit = 5) => {
  return await User.find({ completedRideCount: { $gt: 0 } })
    .sort({ completedRideCount: -1 })
    .limit(limit)
    .select("firstName lastName city completedRideCount isVerified");
};

export const updateProfileService = async (userId, data) => {

  const isExist = await User.findById(userId);
  if (!isExist) {
    throw new Error("User not found");
  }
  const mobile = await User.find({
    mobile: data.mobile
  })

  if (mobile.length !== 0) {
    throw new Error('Mobile no already exist!')
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    data,
    { new: true }
  )
  return updatedUser;
}
