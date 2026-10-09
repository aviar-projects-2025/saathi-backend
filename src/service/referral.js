import User from '../model/user.js'
import Referral from "../model/referral.js"

export const getReferralService = async (id) => {
    const referrals = await Referral.find(
        { referredBy: id },
        "mobile status createdAt"
    ).sort({ createdAt: -1 });



    if (!referrals.length) {
        return [];
    }

    const mobiles = referrals.map(
        (referral) => referral.mobile
    );

    const users = await User.find(
        { mobile: { $in: mobiles } },
        "firstName lastName email refApprove mobile profileImage"
    );
      console.log("usernnmkll;;;;",users)
    return referrals.map((referral) => {

        const user = users.find(
            (user) => user.mobile === referral.mobile
        );

        return {
            _id: referral._id,

            mobile: referral.mobile,

            status: referral.status,
            
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
             profileImage :user?. profileImage || "",
            createdAt: user?.createdAt || referral.createdAt,
            refApprove: user?.refApprove || "",
        };
    });
};

export const updateService = async (id, data) => {
    return await User.findByIdAndUpdate(id, data, { new: true })
}

export const removeService = async (id) => {
    return await User.findByIdAndDelete(id)
}
