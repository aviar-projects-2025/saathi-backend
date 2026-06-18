import express from 'express'
import cors from 'cors'

import userRoutes from './src/routes/userRoutes.js'
import rideRoutes from './src/routes/rideRoutes.js'
import communityRoutes from './src/routes/communityRoutes.js'
import referralRoutes from './src/routes/referralRoutes.js'
import bookrideRouter from "./src/routes/bookrideRouter.js"

const app = express();

app.use(express.json());
app.use(cors());

app.use("api/v1/bookride/request",bookrideRouter)
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/rides", rideRoutes)
app.use("/api/v1/community", communityRoutes)
app.use("/api/v1/referrals", referralRoutes)


export default app