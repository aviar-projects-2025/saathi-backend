import User from '../model/user.js'
// User Service 

export const userCreateService = async (userData) => {
  const user = await User.create(userData);
  return user;
};

export const getAllUsers = async () =>{
    const user = await User.find({}, {password : 0, __v : 0});
    return user
}

export const getUserById = async (id) => {
  const user = await User.findById(id);
  return user
}

export const loggedinUser = async (email)=>{
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
