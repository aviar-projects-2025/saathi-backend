const express = require('express');
const { createRide, getRides } = require('../controller/ride');

const router = express.Router();

router.get("/", getRides);
router.post("/", createRide);
// router.patch("/:id");
// router.delete("/:id");

module.exports = router;