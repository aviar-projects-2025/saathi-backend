const express = require("express");
const cors = require('cors')

const app = express();

const userRoutes = require('./src/routes/userRoutes')
const rideRoutes = require('./src/routes/rideRoutes')



app.use(express.json());
app.use(cors());

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/rides", rideRoutes)

module.exports = app;