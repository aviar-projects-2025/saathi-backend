const { userCreateService, getAllUsers } = require('../service/user');
const bcrypt = require('bcrypt')

// create user
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, dob, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userCreateService({
      firstName,
      lastName,
      email,
      dob,
      password: hashedPassword
    });

    console.log(user, 'hashed')

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
const getUsers = async (req, res) => {
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

module.exports = {
  createUser,
  getUsers,
};