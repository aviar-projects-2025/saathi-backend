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
  // Check whether user exists
  const { data: existingUser, error: findError } = await supabase
    .from("users")
    .select("id, image_public_id")
    .eq("id", userId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (!existingUser) {
    throw new Error("User not found");
  }

  // Convert frontend camelCase → Supabase snake_case
  const updateData = {
    first_name: data.firstName,
    last_name: data.lastName,
    profile_image: data.profileImage,
    gender: data.gender,
    mobile: data.mobile,
    bio: data.bio,
    zipcode: data.zipcode,
    dob: data.dob,
    image_public_id: data.imagePublicId,
    updated_at: new Date().toISOString(),
  };

  // Remove undefined fields
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Update user
  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", userId)
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
    .single();

  if (updateError) {
    throw updateError;
  }

  return {
    id: updatedUser.id,
    referralCode: updatedUser.referral_code,
    firstName: updatedUser.first_name,
    lastName: updatedUser.last_name,
    profileImage: updatedUser.profile_image,
    email: updatedUser.email,
    gender: updatedUser.gender,
    mobile: updatedUser.mobile,
    bio: updatedUser.bio,
    zipcode: updatedUser.zipcode,
    dob: updatedUser.dob,
    role: updatedUser.role,
    refApprove: updatedUser.ref_approve,
    completedRideCount: updatedUser.completed_ride_count,
    imagePublicId: updatedUser.image_public_id,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  };
};
