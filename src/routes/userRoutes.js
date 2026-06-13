const express = require("express");
const { createUser, getUsers, loginUser, getSingleUser,  } = require("../controller/user");
const router = express.Router();

// signup Route
router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getSingleUser);


//login route
router.post("/", loginUser);

module.exports = router;