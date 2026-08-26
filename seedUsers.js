import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./src/model/user.js";

dotenv.config();

const MONGO_URI = process.env.DB_URI;

const seedUsers = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected");

    const users = [];

    // One password hash for all dummy users
    const passwordHash = await bcrypt.hash("Test@123", 10);

    // Use an existing user as the referrer
    const referrerId = new mongoose.Types.ObjectId(
      "6a6c46b7582e641b769d9472"
    );

    for (let i = 1; i <= 1000; i++) {
      const firstName = `TestUser${i}`;
      const lastName = "Dummy";
      

      users.push({
        firstName,
        lastName,

        email: `testuser${i}@dummy.com`,

        dob: `2000-${String((i % 12) + 1).padStart(2, "0")}-${String(
          (i % 28) + 1
        ).padStart(2, "0")}`,

        password: passwordHash,

        role: "USER",

        referralCode: `TEST${String(i).padStart(4, "0")}`,

        referredBy: referrerId,

        refApprove: "Approved",

        completedRideCount: Math.floor(Math.random() * 20),

        bio: "Dummy test user",

        gender: i % 2 === 0 ? "Male" : "Female",

        mobile: `90000${String(i).padStart(5, "0")}`,

        imagePublicId: "",

        profileImage: "",
      });
    }

    const result = await User.insertMany(users);

    console.log(`${result.length} dummy users inserted successfully`);

  } catch (error) {
    console.error("Error inserting dummy users:", error);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

seedUsers();