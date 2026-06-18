import User from '../model/user.js'


export const getReferralService = async (id) => {
    return await User.find(
        { referredBy: id },
        "firstName lastName email createdAt refApprove",
    ).sort({ createdAt: -1 });;
}

export const updateService = async (id, data) => {
    return await User.findByIdAndUpdate(id, data, { new: true })
}