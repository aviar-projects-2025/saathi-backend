import express from 'express'
import { getReferrals, updateReferrals } from '../controller/referral.js'

const router = express.Router()


router.get('/:id',getReferrals)
router.patch('/:id',updateReferrals)



export default router;

