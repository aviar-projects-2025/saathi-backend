const express = require('express');
const { createRide, getRides, editRide } = require('../controller/ride');

const router = express.Router();

router.get("/", getRides);
router.post("/", createRide);
router.patch("/edit/:id", editRide);
// router.delete("/:id");

module.exports = router;