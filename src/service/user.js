import supabase from '../../config/supabase.js';
import User from '../model/user.js'

export const userCreateService = async (userData) => {
  const user = await User.create(userData);
  return user;
};

export const getAllUsers = async () => {
  // const user = await User.find({}, { password: 0, __v: 0 });
  // return user

  const { data: user, error } = await supabase
    .from("users")
    .select(`
          id,
          referral_code,
          first_name,
          last_name,
          email,
          role,
          ref_approve,
          profile_image
        `)
    .eq("email", email)

  return user
}

export const getUserById = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select(`
            id,
                referral_code,
                first_name,
                last_name,
                profile_image,
                email,
                gender,
                mobile,
                bio,
                zipcode,
                dob,
                role,
                ref_approve,
                completed_ride_count,
                image_public_id,
                created_at,
                updated_at
        `)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    referralCode: data.referral_code,
    firstName: data.first_name,
    lastName: data.last_name,
    profileImage: data.profile_image,
    email: data.email,
    gender: data.gender,
    mobile: data.mobile,
    bio: data.bio,
    zipcode: data.zipcode,
    dob: data.dob,
    role: data.role,
    refApprove: data.ref_approve,
    completedRideCount: data.completed_ride_count,
    imagePublicId: data.image_public_id,
  };
};

export const loggedinUser = async (email) => {


  return user;
}

export const getTopRidersService = async (limit) => {
  return await User.find({ completedRideCount: { $gt: 0 } })
    .sort({ completedRideCount: -1 })
    .limit(limit)
    .select("firstName lastName city completedRideCount  profileImage isVerified");
};

export const updateProfileService = async (userId, data) => {

  const isExist = await User.findById(userId);
  if (!isExist) {
    throw new Error("User not found");
  }

  // const mobile = await User.find({
  //   mobile: data.mobile
  // })

  // if (mobile.length !== 0) {
  //   throw new Error('Mobile no already exist!')
  // }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    data,
    { new: true }
  )


  return updatedUser;
}
