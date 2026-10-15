import express from 'express'

import { createReferral, findReferral, validateReferralInvitation } from '../controller/referralInvite.js'

const router = express.Router();


router.post('/', createReferral);
router.get("/validate", validateReferralInvitation);
router.post('/check', findReferral);



export default router;
// route.post('/', createReferral);
