import {
  userCreateService,
  getAllUsers,
  loggedinUser,
  getUserById,
  getTopRidersService,
  updateProfileService,
} from '../service/user.js'

import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import User from '../model/user.js'
import cloudinary from '../../config/cloudinary.js';
import streamifier from 'streamifier'
import { buildNotification, createNotificationService } from '../service/notification.js';
import { emitNotification } from '../../socket.js';
import { sendWelcomePendingEmail } from '../../config/sendMail.js';

// Token Generation
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d"
    }
  );
};

export const createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      dob,
      password,
      referralCode,
    } = req.body;

    let referredBy = null;

    if (referralCode) {
      const referredUser = await User.findOne({ referralCode });

      if (!referredUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }

      referredBy = referredUser._id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const myReferralCode =
      firstName.substring(0, 3).toUpperCase() +
      Math.floor(1000 + Math.random() * 9000);

    const user = await userCreateService({
      firstName,
      lastName,
      email,
      dob,
      password: hashedPassword,
      referralCode: myReferralCode,
      referredBy,
      refApprove: referralCode && "Waiting"
    });

    if (referredBy) {
      const actorName = firstName;

      const notif = buildNotification({
        type: "referral_pending",
        actorName,
      });

      const notification = await createNotificationService({
        userId: referredBy,
        actorId: user._id,
        type: "referral_pending",
        category: "New Referral",
        ...notif,
        data: {
          userId: user._id,
        },
      });

      emitNotification(referredBy.toString(), {
        type: "referral_pending",
        message: notif.message,
        category: "New Referral",
        data: {
          _id: notification._id,
          userId: user._id,
          user: user,
        },
      });
    }

    console.log('User Register mail progresss')

    //sendmail
    sendWelcomePendingEmail(
      email,
      firstName + " " + lastName,
    )

    console.log('User Register mail crossed')


    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// get All Users
export const getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// get user by id;
export const getSingleUser = async (req, res) => {

  try {

    const { id } = req.params;
    const user = await getUserById(id);

    res.status(200).json({
      success: true,
      data: user
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }

}

// Login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.refApprove === "Waiting") {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved yet. Please wait for approval.",
      });
    }

    if (user.refApprove === "Blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account is Blocked. Contact Admin admin@saathi.com",
      });
    }

    const data = {
      id: user._id,
      referralCode: user.referralCode,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      refApprove: user.refApprove,
      profileImage: user.profileImage,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: data,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "profile-pic",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};


export const changePassword = async (req, res) => {

  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const { userId } = req.params

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;


    let imageUrl = "";

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const databody = {
      ...req.body,
    };

    if (imageUrl) {
      databody.profileImage = imageUrl;
    }

    const data = await updateProfileService(userId, databody);

    res.status(200).json({
      success: true,
      message: "Profile updated",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controller/user.js


export const getTopRiders = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const riders = await getTopRidersService(limit);
    res.status(200).json({
      success: true,
      data: riders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};