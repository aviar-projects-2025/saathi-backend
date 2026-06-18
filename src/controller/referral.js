import { getReferralService, updateService } from '../service/referral.js'


export const getReferrals = async (req, res) => {
    try {
        const { id } = req.params
        const data = await getReferralService(id);
        res.status(200).json({
            status: true,
            data: data
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

export const updateReferrals = async (req, res) => {
    try {
        const { id } = req.params
        const data = req.body

        console.log(data,'data')

        const approvedUser = await updateService(id, data);
        res.status(200).json({
            status: true,
            data: approvedUser
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: error.message
        })
    }
}

