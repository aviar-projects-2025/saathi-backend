
import Notification from "../../src/model/notification.js";
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

const migrateNotifications = async () => {
    try {
        console.log("Connecting to MongoDB...");

        await mongoose.connect(process.env.DB_URI);

        console.log("MongoDB connected");

        const notifications =
            await Notification.find({}).lean();

        console.log(
            `Found ${notifications.length} notifications`
        );

        if (!notifications.length) {
            console.log("No notifications found.");
            return;
        }

        // --------------------------------------------------
        // Get all MongoDB users and their Supabase UUIDs
        // --------------------------------------------------

        const { data: supabaseUsers, error } = await supabase
            .from("users")
            .select("id, mongo_id");

        if (error) {
            throw error;
        }

        const userMap = new Map();

        for (const user of supabaseUsers) {
            userMap.set(user.mongo_id, user.id);
        }

        console.log(
            `Loaded ${userMap.size} user mappings`
        );

        let migrated = 0;
        let skipped = 0;
        let failed = 0;

        // --------------------------------------------------
        // Migrate notifications
        // --------------------------------------------------

        for (const notification of notifications) {

            const mongoUserId =
                notification.userId?.toString();

            const mongoActorId =
                notification.actorId?.toString();

            const supabaseUserId =
                userMap.get(mongoUserId);

            const supabaseActorId =
                mongoActorId
                    ? userMap.get(mongoActorId)
                    : null;

            // User is required
            if (!supabaseUserId) {
                console.log(
                    `Skipping notification ${notification._id}: user not found`
                );

                skipped++;
                continue;
            }

            const newNotification = {
                user_id: supabaseUserId,

                actor_id:
                    supabaseActorId || null,

                type: notification.type,

                title:
                    notification.title || null,

                message:
                    notification.message || null,

                data:
                    notification.data || {},

                is_read:
                    notification.isRead || false,

                created_at:
                    notification.createdAt || new Date(),

                updated_at:
                    notification.updatedAt || new Date(),
            };

            const { error: insertError } =
                await supabase
                    .from("notifications")
                    .insert(newNotification);

            if (insertError) {

                console.error(
                    `Failed ${notification._id}:`,
                    insertError.message
                );

                failed++;
                continue;
            }

            migrated++;

            console.log(
                `Migrated ${migrated}/${notifications.length}`
            );
        }

        console.log("");
        console.log("==============================");
        console.log("NOTIFICATION MIGRATION COMPLETE");
        console.log("==============================");

        console.log(
            `MongoDB notifications : ${notifications.length}`
        );

        console.log(
            `Migrated               : ${migrated}`
        );

        console.log(
            `Skipped                : ${skipped}`
        );

        console.log(
            `Failed                 : ${failed}`
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

migrateNotifications();