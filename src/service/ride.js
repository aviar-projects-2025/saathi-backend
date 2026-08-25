import supabase from "../../config/supabase.js";
import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";
import User from "../model/user.js";

export const createRideService = async (data) => {

  const ride = {
    created_by: data.createdBy,

    mode_of_travel: data.modeOfTravel,

    from_location: data.from,
    destination: data.destination,

    start_time: data.startTime,
    end_time: data.endTime || null,

    last_ride_started_notification_at:
      data.lastRideStartedNotificationAt || null,

    available_seats:
      data.availableSeats ?? null,

    total_seats:
      data.totalSeats ?? null,

    fuel_sharing:
      data.fuelSharing ?? null,

    duration:
      data.duration ?? null,

    from_country:
      data.fromCountry || null,

    from_airport:
      data.fromAirport || null,

    to_country:
      data.toCountry || null,

    to_airport:
      data.toAirport || null,

    flight_number:
      data.flightNumber || null,

    airline_name:
      data.airlineName || null,

    traveller_type:
      data.travellerType || null,

    language:
      data.language || null,

    age_group_preference:
      data.ageGroupPreference || "Any",

    medical_assistance:
      data.medicalAssistance ?? false,

    language_support:
      data.languageSupport ?? false,

    transit_help:
      data.transitHelp ?? false,

    baggage_help:
      data.baggageHelp ?? false,

    description:
      data.description || null,

    status:
      data.status || "OPEN",

    travel_status:
      data.travelStatus || "Waiting",

    gender_preference:
      data.genderPreference || "Any",
  };

  const { data: createdRide, error } = await supabase
    .from("rides")
    .insert(ride)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return createdRide;
};

// Get all
export const getAllRideService = async () => {

  const { data, error } = await supabase
    .from("rides")
    .select(`
            id,
            created_by,
            mode_of_travel,
            from_location,
            destination,
            start_time,
            end_time,
            last_ride_started_notification_at,
            available_seats,
            total_seats,
            fuel_sharing,
            duration,
            from_country,
            from_airport,
            to_country,
            to_airport,
            flight_number,
            airline_name,
            traveller_type,
            language,
            age_group_preference,
            medical_assistance,
            language_support,
            transit_help,
            baggage_help,
            description,
            status,
            travel_status,
            gender_preference,
            created_at,
            updated_at,

            creator:created_by (
                id,
                first_name,
                last_name,
                profile_image,
                zipcode
            )
        `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((ride) => ({
    _id: ride.id,

    createdBy: ride.creator
      ? {
        _id: ride.creator.id,
        firstName: ride.creator.first_name,
        lastName: ride.creator.last_name,
        profileImage: ride.creator.profile_image,
        zipcode: ride.creator.zipcode,
      }
      : null,

    modeOfTravel: ride.mode_of_travel,
    from: ride.from_location,
    destination: ride.destination,

    startTime: ride.start_time,
    endTime: ride.end_time,

    lastRideStartedNotificationAt:
      ride.last_ride_started_notification_at,

    availableSeats: ride.available_seats,
    totalSeats: ride.total_seats,
    fuelSharing: ride.fuel_sharing,
    duration: ride.duration,

    fromCountry: ride.from_country,
    fromAirport: ride.from_airport,
    toCountry: ride.to_country,
    toAirport: ride.to_airport,
    flightNumber: ride.flight_number,
    airlineName: ride.airline_name,
    travellerType: ride.traveller_type,
    language: ride.language,

    ageGroupPreference: ride.age_group_preference,

    medicalAssistance: ride.medical_assistance,
    languageSupport: ride.language_support,
    transitHelp: ride.transit_help,
    baggageHelp: ride.baggage_help,

    description: ride.description,

    status: ride.status,
    travelStatus: ride.travel_status,
    genderPreference: ride.gender_preference,

    createdAt: ride.created_at,
    updatedAt: ride.updated_at,
  }));
};

// Get single Ride
export const getRideById = async (id) => {
  return await Ride.findById(id);
};

export const deleteRideService = async (id) => {
  return await Ride.findByIdAndDelete(id);
}
// service/ride.js

export const updateRideService = async (id, data) => {
  await BookRide.updateMany(
    { rideId: id, status: "PENDING" },
    { status: "AUTO_REJECTED" }
  );

  const existingRide = await Ride.findById(id);

  const updatedRide = await Ride.findByIdAndUpdate(id, data, {
    new: true,
  });

  if (
    existingRide.travelStatus !== "Completed" &&
    updatedRide.travelStatus === "Completed"
  ) {
    await User.findByIdAndUpdate(updatedRide.createdBy, {
      $inc: { completedRideCount: 1 },
    });
  }

  return updatedRide;
};