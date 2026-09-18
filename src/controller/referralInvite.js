import Referral from "../model/referral.js"
import User from "../model/user.js"

export const createReferral = async (req, res) => {
    try {
        const data = { ...req.body }
           
           const existingReferral = await Referral.findOne({
            mobile: data.mobile,
        });

        if (existingReferral) {
            return res.status(400).json({
                status: false,
               message: "This user has already been referred",
            });
        }

        const referral = await Referral.create(data)

        res.status(201).json({
            status: true,
            message: referral
        })
    } catch (error) {
        res.status(500).json({
            status: false,
            message: "failed to invite"
        })
    }
}


export const findReferral = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        const referral = await Referral.findOne({ mobile });
        const user = await User.findOne({ mobile });

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: "Referral not found",
            });
        }

        // User already has an approved account
        if (
            referral.status === "Verified" &&
            user?.refApprove === "Approved"
        ) {
            return res.status(400).json({
                success: false,
                message: "You already have an account with this mobile number",
            });
        }

        // Waiting → Verified
        if (referral.status === "Waiting") {
            referral.status = "Verified";
            await referral.save();

            return res.status(200).json({
                success: true,
                message: "Referral verified successfully",
                referral,
            });
        }

        // Already verified - allow OTP again
        if (referral.status === "Verified") {
            return res.status(200).json({
                success: true,
                message: "Referral already verified. OTP can be sent again.",
                referral,
            });
        }

        return res.status(400).json({
            success: false,
            message: `Invalid referral status: ${referral.status}`,
        });

    } catch (error) {
        console.error("Find referral error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to find referral",
        });
    }
};