import User from '../model/user.js'
import bcrypt from 'bcrypt'
// User Service 

export const userCreateService = async (userData) => {

  const { 
    firstName,
    lastName,
    email,
    dob,
    refApprove,
    password,
    referralCode } = userData
    
  let referredBy = null;
  if (referralCode) {
    referredBy = await User.findOne({referralCode});

    if (!referredBy) {
      return res.status(400).json({
        success: false,
        message: "Invalid referral code",
      });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const myReferralCode =
    firstName.substring(0, 3).toUpperCase() +
    Math.floor(1000 + Math.random() * 9000);


  const userDetail = {
    firstName,
    lastName,
    email,
    dob,
    refApprove,
    password: hashedPassword,
    referralCode: myReferralCode,
    referredBy: referredBy?._id,
  }


  const user = await User.create(userDetail);
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
  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  return user;
} 
