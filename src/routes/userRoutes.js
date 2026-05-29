const express = require("express");
const { createUser, getUsers } = require("../controller/user");
const router = express.Router();


router.post("/create", createUser);
router.get("/get", getUsers);

module.exports = router;