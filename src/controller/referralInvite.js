import Referral from "../model/referral.js"


export const createReferral = async (req, res) => {
    try {
        const data = { ...req.body }
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

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: "Referral not found",
            });
        }

        // Already verified
        if (referral.status === "Verified") {
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