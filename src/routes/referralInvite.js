import express from 'express'

import { createReferral, findReferral } from '../controller/referralInvite.js'

const router = express.Router();


router.post('/', createReferral);
router.post('/check', findReferral);



export default router;
// route.post('/', createReferral);
