const User = require('../model/user');

// User Service 

const userCreateService = async (userData) => {
  const user = await User.create(userData);
  return user;
};

const getAllUsers = async () =>{
    const user = await User.find({}, {password : 0, __v : 0});
    return user
}

const loggedinUser = async (email)=>{
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

module.exports = {
    userCreateService,
    getAllUsers,
    loggedinUser,
}