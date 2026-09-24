import mongoose from "mongoose";
import dotenv from "dotenv";
import Ride from "./src/model/ride.js";

dotenv.config();

const MONGO_URI = process.env.DB_URI;

const seedRides = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected");

    const rides = [];

    // Existing user who will own all 1000 rides
    const createdBy = new mongoose.Types.ObjectId(
      "6ab36320904065ebb0a11ad3"
    );

    const destinations = [
      {
        name: "Chennai, Tamil Nadu, India",
        latitude: 13.0827,
        longitude: 80.2707,
        distanceKm: 170,
        duration: 210,
      },
      {
        name: "Bangalore, Karnataka, India",
        latitude: 12.9716,
        longitude: 77.5946,
        distanceKm: 210,
        duration: 300,
      },
      {
        name: "Vellore, Tamil Nadu, India",
        latitude: 12.9165,
        longitude: 79.1325,
        distanceKm: 85,
        duration: 120,
      },
      {
        name: "Pondicherry, Tamil Nadu, India",
        latitude: 11.9139,
        longitude: 79.8145,
        distanceKm: 110,
        duration: 150,
      },
      {
        name: "Salem, Tamil Nadu, India",
        latitude: 11.6643,
        longitude: 78.146,
        distanceKm: 180,
        duration: 240,
      },
      {
        name: "Coimbatore, Tamil Nadu, India",
        latitude: 11.0168,
        longitude: 76.9558,
        distanceKm: 390,
        duration: 480,
      },
      {
        name: "Madurai, Tamil Nadu, India",
        latitude: 9.9252,
        longitude: 78.1198,
        distanceKm: 400,
        duration: 420,
      },
      {
        name: "Hyderabad, Telangana, India",
        latitude: 17.385,
        longitude: 78.4867,
        distanceKm: 650,
        duration: 720,
      },
      {
        name: "Mumbai, Maharashtra, India",
        latitude: 19.076,
        longitude: 72.8777,
        distanceKm: 1030,
        duration: 135,
      },
      {
        name: "Pune, Maharashtra, India",
        latitude: 18.5246,
        longitude: 73.8786,
        distanceKm: 1059,
        duration: 1111,
      },
    ];

    const travelModes = [
      "Car",
    ];

    const languages = [
      ["English", "Tamil"],
      ["Tamil"],
      ["English"],
      ["English", "Tamil", "Telugu"],
    ];

    for (let i = 1; i <= 10000; i++) {
      const destination =
        destinations[(i - 1) % destinations.length];

      const modeOfTravel =
        travelModes[(i - 1) % travelModes.length];

      const language =
        languages[(i - 1) % languages.length];

      // Spread rides across the next 100 days
      const startTime = new Date();

      startTime.setDate(
        startTime.getDate() + ((i - 1) % 100)
      );

      // Different departure times
      startTime.setHours(
        5 + ((i - 1) % 14),
        i % 2 === 0 ? 0 : 30,
        0,
        0
      );

      const totalSeats =
        modeOfTravel === "Bike"
          ? 1
          : 2 + ((i - 1) % 5);

      const availableSeats = Math.max(
        1,
        totalSeats - ((i - 1) % Math.min(totalSeats, 3))
      );

      rides.push({
        createdBy,

        modeOfTravel,

        from: "Tiruvannamalai, Tamil Nadu, India",

        destination: destination.name,

        fromLocation: {
          latitude: 12.2252841,
          longitude: 79.0746957,
        },

        destinationLocation: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },

        startTime,

        lastRideStartedNotificationAt: null,

        availableSeats,

        totalSeats,

        fuelSharing:
          modeOfTravel === "Car"
            ? 200 + ((i - 1) % 6) * 100
            : 0,

        distanceKm: destination.distanceKm,

        duration: destination.duration,

        travellerType:
          i % 3 === 0
            ? "Regular"
            : "Regular",

        language,

        ageGroupPreference: "Any",

        medicalAssistance: i % 10 === 0,

        languageSupport: i % 8 === 0,

        transitHelp: i % 7 === 0,

        baggageHelp: i % 5 === 0,

        description:
          `Test ride ${i} from Tiruvannamalai to ${
            destination.name.split(",")[0]
          }`,

        status: "OPEN",

        travelStatus: "Waiting",

        genderPreference: "Any",

        createdAt: new Date(),

        updatedAt: new Date(),

        __v: 0,
      });
    }

    const result = await Ride.insertMany(rides);

    console.log(
      `${result.length} rides inserted successfully`
    );

  } catch (error) {
    console.error("Error inserting rides:", error);
  } finally {
    await mongoose.connection.close();

    console.log("MongoDB connection closed");
  }
};

seedRides();