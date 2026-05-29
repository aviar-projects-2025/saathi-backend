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

module.exports = {
    userCreateService,
    getAllUsers,
}