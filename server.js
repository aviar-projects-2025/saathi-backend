const express = require('express');
const DBConnection = require('./config/db');
require('dotenv').config();
const app = require("./app");


// DBConnection
DBConnection();

// Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port : ${PORT}`)
})
