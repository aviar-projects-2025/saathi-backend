import express from 'express'

import { createInviteLink, createReferral, findReferral, validateReferralInvitation } from '../controller/referralInvite.js'
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();


router.post('/', createReferral);
router.get("/validate", validateReferralInvitation);
router.post('/check', findReferral);
router.post("/link", verifyToken, createInviteLink);



export default router;
// route.post('/', createReferral);
