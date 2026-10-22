import TravelBuddy from "../model/travelBuddy.js";
import User from "../model/user.js";

export const createTrip = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const payload = req.body;

    const newTrip = await TravelBuddy.create({
      ...payload,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: newTrip });
  } catch (error) {
    console.error("Create Trip Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTrips = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const trips = await TravelBuddy.find({ createdBy: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: trips });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await TravelBuddy.findById(id);

    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });

    const flightNumbers = trip.flights.map((f) => f.flightNumber);
    const arrivalAirport = trip.flights[trip.flights.length - 1].toCode;
    const arrivalTime = trip.flights[trip.flights.length - 1].arrivalTime;

    // 1. TIER 1: Exact Same Flight Match
    const tier1Matches = await TravelBuddy.find({
      _id: { $ne: trip._id }, // Exclude self
      role: trip.role === "parent" ? "companion" : "parent", // Opposite role
      status: "OPEN",
      "flights.flightNumber": { $in: flightNumbers }, // Shares at least one flight
    }).populate("createdBy", "firstName lastName profileImage rating languages");

    // 2. TIER 2: Same Arrival Airport, within 4 hours
    const fourHoursBefore = new Date(arrivalTime.getTime() - 4 * 60 * 60 * 1000);
    const fourHoursAfter = new Date(arrivalTime.getTime() + 4 * 60 * 60 * 1000);

    const tier2Matches = await TravelBuddy.find({
      _id: { $ne: trip._id },
      role: trip.role === "parent" ? "companion" : "parent",
      status: "OPEN",
      "flights.flightNumber": { $nin: flightNumbers }, // Not exact flight
      "flights.toCode": arrivalAirport, // Same arrival airport
      "flights.arrivalTime": { $gte: fourHoursBefore, $lte: fourHoursAfter },
    }).populate("createdBy", "firstName lastName profileImage rating languages");

    // Format response for frontend
    const formatMatch = (match, tier) => ({
      id: match._id,
      initials: `${match.createdBy.firstName?.[0]}${match.createdBy.lastName?.[0]}`.toUpperCase(),
      name: `${match.createdBy.firstName} ${match.createdBy.lastName}`,
      tier: tier === 1 ? "Tier 1: same flights" : `Tier 2: arrives ${arrivalAirport}`,
      details: `Flying ${match.flights[0].flightNumber} · ${match.createdBy.languages?.join(", ")} · ${match.createdBy.rating || 5.0} stars`,
      note: tier === 1 
        ? "Exact flight match. Can accompany during the journey." 
        : "Different flight. Can meet at the arrivals terminal.",
    });

    res.status(200).json({
      success: true,
      data: {
        tier1: tier1Matches.map((m) => formatMatch(m, 1)),
        tier2: tier2Matches.map((m) => formatMatch(m, 2)),
      },
    });
  } catch (error) {
    console.error("Get Matches Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ─────────────────────────────────────────────
   GET /api/travel-buddy
   Browse all trips (with search & role filters)
   ───────────────────────────────────────────── */
export const getAllTrips = async (req, res) => {
  try {
    const { search, role } = req.query;
    const userId = req.user?.id || req.user?.userId || req.user?._id;

    // 1. Build the base query
    const query = { 
      status: "OPEN",
      createdBy: { $ne: userId } // Don't show my own trips in the global feed
    };

    // 2. Filter by role if selected (parent vs companion)
    if (role && ["parent", "companion"].includes(role)) {
      query.role = role;
    }

    // 3. Handle search (flight number, airline, or airport code)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { "flights.flightNumber": searchRegex },
        { "flights.airline": searchRegex },
        { "flights.fromCode": searchRegex },
        { "flights.toCode": searchRegex },
      ];
    }

    // 4. Fetch trips
    const trips = await TravelBuddy.find(query)
      .populate("createdBy", "firstName lastName profileImage languages")
      .sort({ createdAt: -1 }) // Newest first
      .limit(50);

    // 5. SMART SORTING: If I have an OPEN trip, show trips that share my flights at the top
    let myTrip = null;
    if (userId) {
      myTrip = await TravelBuddy.findOne({ createdBy: userId, status: "OPEN" });
    }

    if (myTrip && myTrip.flights?.length > 0) {
      const myFlightNumbers = myTrip.flights.map(f => f.flightNumber);
      
      trips.sort((a, b) => {
        const aMatch = a.flights.some(f => myFlightNumbers.includes(f.flightNumber));
        const bMatch = b.flights.some(f => myFlightNumbers.includes(f.flightNumber));
        
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    res.status(200).json({ success: true, data: trips });
  } catch (error) {
    console.error("Get All Trips Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};