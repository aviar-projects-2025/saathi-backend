import {
  userCreateService,
  getAllUsers,
  loggedinUser,
  getUserById,
} from '../service/user.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import User from '../model/user.js'


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
      refApprove: referralCode ? "Waiting" : "Approved",
    });

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

    const isMatch = await bcrypt.compare(password, user?.password)

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const data = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      refApprove: user.refApprove,
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}