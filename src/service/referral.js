import supabase from '../../config/supabase.js';
import User from '../model/user.js'


// export const getReferralService = async (id) => {
//     return await User.find(
//         { referredBy: id },
//         "firstName lastName email createdAt refApprove",
//     ).sort({ createdAt: -1 });
// }

export const getReferralService = async (id) => {
    const { data, error } = await supabase
        .from("users")
        .select(`
            first_name,
            last_name,
            email,
            created_at,
            ref_approve
        `)
        .eq("referred_by", id)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    // Keep the same response structure your frontend currently expects
    return data.map((user) => ({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        createdAt: user.created_at,
        refApprove: user.ref_approve,
    }));
};

export const updateService = async (id, data) => {
    return await User.findByIdAndUpdate(id, data, { new: true })
}

export const removeService = async (id) => {
    return await User.findByIdAndDelete(id)
}
