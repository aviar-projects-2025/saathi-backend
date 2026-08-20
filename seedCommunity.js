import mongoose from "mongoose";
import dotenv from "dotenv";
import Community from "./src/model/community.js";
import User from "./src/model/user.js";

dotenv.config();

const seedCommunity = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);

    console.log("MongoDB connected");

    // Get your dummy users
    const users = await User.find({
      email: { $regex: /^testuser[0-9]+@dummy\.com$/ }
    }).select("_id");

    console.log(`Found ${users.length} dummy users`);

    if (users.length === 0) {
      console.log("No dummy users found.");
      return;
    }

    const imageUrls = [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e",
      "https://images.unsplash.com/photo-1501854140801-50d01698950b",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
    ];

    const descriptions = [
      "Beautiful day! 🌄",
      "Enjoying the peaceful surroundings.",
      "What a beautiful view! ❤️",
      "Good vibes and good memories.",
      "Exploring new places today.",
      "Nature always makes everything better.",
      "Another beautiful day to be grateful.",
      "Travel, explore and enjoy! ✨",
      "Life is better when you travel.",
      "Making some wonderful memories.",
    ];

    const posts = [];

    for (let i = 1; i < users.length; i++) {

      posts.push({
        postImage: imageUrls[i % imageUrls.length],

        description:
          descriptions[i % descriptions.length],

        authorId: users[i]._id,

        likes: Math.floor(Math.random() * 100),

        communityImgPublicId: "",
      });
    }

    const result = await Community.insertMany(posts);

    console.log(
      `✅ ${result.length} community posts inserted successfully`
    );

  } catch (error) {
    console.error(
      "❌ Error inserting community posts:",
      error
    );
  } finally {
    await mongoose.connection.close();

    console.log("MongoDB connection closed");
  }
};

seedCommunity();