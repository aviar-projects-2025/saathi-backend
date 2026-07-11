import express from 'express'
import cors from 'cors'

import userRoutes from './src/routes/userRoutes.js'
import rideRoutes from './src/routes/rideRoutes.js'
import communityRoutes from './src/routes/communityRoutes.js'
import referralRoutes from './src/routes/referralRoutes.js'
import bookrideRouter from "./src/routes/bookrideRouter.js"
import likeRoutes from "./src/routes/likeRoutes.js"
import commentRoutes from "./src/routes/commentRoutes.js"
import notificationRoutes from "./src/routes/notificationRouter.js"



const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/v1/bookride",bookrideRouter)
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/rides", rideRoutes)
app.use("/api/v1/community", communityRoutes)
app.use("/api/v1/referrals", referralRoutes)
app.use("/api/v1/likes", likeRoutes)
app.use("/api/v1/community/likes", likeRoutes)
app.use("/api/v1/community/comments", commentRoutes)
app.use("/api/v1/notification", notificationRoutes)


export default app