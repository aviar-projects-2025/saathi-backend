const express = require("express");
const { createUser, getUsers, loginUser } = require("../controller/user");
const router = express.Router();


router.post("/create", createUser);
router.get("/get", getUsers);

router.post("/login", loginUser);

module.exports = router;