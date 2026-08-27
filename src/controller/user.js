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
import supabase from '../../config/supabase.js';

// Token Generation
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
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

    if (email) {
      const emailUser = await User.findOne({ email });

      if (emailUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exist!",
        });
      }
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


    //sendmail
    sendWelcomePendingEmail(
      email,
      firstName + " " + lastName,
    )



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

    console.log(users, 'users')

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

    console.log(id, '===id===')
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


export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user in Supabase
    const { data: user, error } = await supabase
      .from("users")
      .select(`
        id,
        referral_code,
        first_name,
        last_name,
        email,
        password,
        role,
        ref_approve,
        profile_image
      `)
      .eq("email", email)
      .maybeSingle();

    console.log(user, 'user')

    if (error) {
      console.error("Supabase login error:", error);

      return res.status(500).json({
        success: false,
        message: "Something went wrong while logging in",
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare password with stored bcrypt hash
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Account approval
    if (user.ref_approve === "Waiting") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not approved yet. Please wait for approval.",
      });
    }

    if (user.ref_approve === "Blocked") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is Blocked. Contact Admin admin@saathi.com",
      });
    }

    // Keep the same response structure as your old API
    const data = {
      id: user.id,
      referralCode: user.referral_code,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      refApprove: user.ref_approve,
      profileImage: user.profile_image,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: data,
    });

  } catch (error) {
    console.error("Login error:", error);

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

    // 1. Get existing user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, image_public_id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("Get user error:", userError);

      return res.status(500).json({
        success: false,
        message: userError.message,
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const databody = {
      ...req.body,
    };

    console.log(databody, "databody");

    // 2. Check mobile number
    const { mobile } = req.body;

    if (mobile) {
      const { data: existingUser, error: mobileError } = await supabase
        .from("users")
        .select("id")
        .eq("mobile", mobile)
        .neq("id", userId)
        .maybeSingle();

      if (mobileError) {
        console.error("Mobile check error:", mobileError);

        return res.status(500).json({
          success: false,
          message: mobileError.message,
        });
      }

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already exists",
        });
      }
    }

    // 3. Store old Cloudinary public ID
    const oldImagePublicId = user.image_public_id;

    // 4. Update database
    const data = await updateProfileService(
      userId,
      databody
    );

    // 5. Delete old Cloudinary image if new image was uploaded
    if (
      req.body.profileImage &&
      req.body.imagePublicId &&
      oldImagePublicId &&
      oldImagePublicId !== req.body.imagePublicId
    ) {
      try {
        await cloudinary.uploader.destroy(
          oldImagePublicId,
          {
            resource_type: "image",
          }
        );

        console.log(
          "Old profile image deleted:",
          oldImagePublicId
        );
      } catch (deleteError) {
        console.error(
          "Failed to delete old Cloudinary image:",
          deleteError
        );
      }
    }

    // 6. Response
    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data,
    });

  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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


// controller
export const getMe = async (req, res) => {
  try {

    console.log("REQ USER:", req.user);
    console.log("REQ USER ID:", req.user?.id);


    const { data: user, error } = await supabase
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
      .eq("id", req.user.id)
      .single();

    console.log("SUPABASE USER:", user);
    console.log("SUPABASE ERROR:", error);

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(401).json({
          success: false,
          message: "User no longer exists",
        });
      }

      throw error;
    }

    return res.status(200).json(
      {
        success : true,
        user,
      });

  } catch (error) {
    console.error("Get Me Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};