const express = require("express");

const app = express();

const userRoutes = require('./src/routes/userRoutes')
const rideRoutes = require('./src/routes/rideRoutes')



app.use(express.json());

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/rides", rideRoutes)

module.exports = app;