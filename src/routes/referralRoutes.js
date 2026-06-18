import express from 'express'
import { getReferrals, updateReferrals, removeReferrals } from '../controller/referral.js'

const router = express.Router()


router.get('/:id',getReferrals)
router.patch('/:id',updateReferrals)
router.delete('/:id',removeReferrals)




export default router;

