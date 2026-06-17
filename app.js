import express from 'express'
import cors from 'cors'

import userRoutes from './src/routes/userRoutes.js'
import rideRoutes from './src/routes/rideRoutes.js'
import communityRoutes from './src/routes/communityRoutes.js'

const app = express();

app.use(express.json());
app.use(cors());


app.use("/api/v1/users", userRoutes);
app.use("/api/v1/rides", rideRoutes)
app.use("/api/v1/community", communityRoutes)

export default app