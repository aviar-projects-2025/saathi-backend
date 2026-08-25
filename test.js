import supabase from "./config/supabase.js";


export const testSupabase = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .limit(5);

        if (error) {
            console.error("Supabase error:", error);

            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (error) {
        console.error("Server error:", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};