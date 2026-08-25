
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import User from "../../src/model/user.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});
const { default: supabase } =
    await import("../../config/supabase.js");

console.log("Migration URL:", process.env.SUPABASE_URL);
console.log("Migration KEY:", !!process.env.SUPABASE_KEY);

const migrateUsers = async () => {
    try {
        console.log("Connecting to MongoDB...");

        await mongoose.connect(process.env.DB_URI);

        console.log("MongoDB connected");

        // Get all MongoDB users
        const users = await User.find({}).lean();

        console.log(`Found ${users.length} users in MongoDB`);

        if (!users.length) {
            console.log("No users found.");
            return;
        }

        // --------------------------------------------------
        // STEP 1: Create MongoDB ID → Supabase UUID mapping
        // --------------------------------------------------

        const userMap = new Map();

        for (const user of users) {
            const { data, error } = await supabase
                .from("users")
                .select("id")
                .eq("mongo_id", user._id.toString())
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (data) {
                userMap.set(user._id.toString(), data.id);
            }
        }

        console.log(
            `Already migrated: ${userMap.size} users`
        );

        // --------------------------------------------------
        // STEP 2: Insert users
        // --------------------------------------------------

        for (const user of users) {

            const mongoId = user._id.toString();

            // Skip already migrated users
            if (userMap.has(mongoId)) {
                continue;
            }

            const newUser = {
                mongo_id: mongoId,

                first_name: user.firstName,
                last_name: user.lastName,

                profile_image: user.profileImage || null,

                email: user.email,

                gender: user.gender || null,

                mobile: user.mobile || null,

                bio: user.bio || null,

                zipcode: user.zipcode || null,

                dob: user.dob
                    ? new Date(user.dob).toISOString().split("T")[0]
                    : null,

                password: user.password,

                role: user.role || "USER",

                referral_code: user.referralCode,

                // We'll fix referred_by later
                referred_by: null,

                ref_approve: user.refApprove || "Waiting",

                completed_ride_count:
                    user.completedRideCount || 0,

                image_public_id:
                    user.imagePublicId || null,

                created_at:
                    user.createdAt || new Date(),

                updated_at:
                    user.updatedAt || new Date(),
            };

            const { data, error } = await supabase
                .from("users")
                .insert(newUser)
                .select("id")
                .single();

            if (error) {

                // If user already exists by email,
                // don't stop the whole migration.
                if (error.code === "23505") {
                    console.log(
                        `Skipping duplicate: ${user.email}`
                    );
                    continue;
                }

                throw error;
            }

            userMap.set(mongoId, data.id);

            console.log(
                `Migrated: ${user.email}`
            );
        }

        // --------------------------------------------------
        // STEP 3: Fix referred_by relationships
        // --------------------------------------------------

        console.log(
            "Updating referral relationships..."
        );

        for (const user of users) {

            if (!user.referredBy) {
                continue;
            }

            const mongoId = user._id.toString();

            const referredByMongoId =
                user.referredBy.toString();

            const supabaseUserId =
                userMap.get(mongoId);

            const referredBySupabaseId =
                userMap.get(referredByMongoId);

            if (!supabaseUserId) {
                console.log(
                    `Could not find Supabase user for ${mongoId}`
                );
                continue;
            }

            if (!referredBySupabaseId) {
                console.log(
                    `Could not find referrer for ${mongoId}`
                );
                continue;
            }

            const { error } = await supabase
                .from("users")
                .update({
                    referred_by: referredBySupabaseId,
                })
                .eq("id", supabaseUserId);

            if (error) {
                throw error;
            }
        }

        console.log(
            "Referral relationships updated."
        );

        console.log(
            "================================="
        );

        console.log(
            "USER MIGRATION COMPLETED SUCCESSFULLY"
        );

        console.log(
            `MongoDB users: ${users.length}`
        );

        console.log(
            `Supabase mapped users: ${userMap.size}`
        );

        console.log(
            "================================="

        );

    } catch (error) {

        console.error(
            "Migration failed:"
        );

        console.error(error);

    } finally {

        await mongoose.disconnect();

        console.log(
            "MongoDB disconnected"
        );
    }
};

migrateUsers();