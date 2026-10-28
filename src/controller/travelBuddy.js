import TravelBuddy from "../model/travelBuddy.js";
import User from "../model/user.js";
import mongoose from "mongoose";
import TravelBuddyRequest from "../model/travelBuddyRequest.js";
import {
  createNotificationService,
} from "../service/notification.js";
import { emitNotification } from "../../socket.js";

export const createTrip = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    const body = req.body || {};
    const payload = {
      role: body.role,
      flights: body.flights,
      relationship: body.role === "parent" ? body.relationship : undefined,
      ageBand: body.role === "parent" ? body.ageBand : undefined,
      languages: body.languages,
      help: body.help,
      pickup: body.pickup,
      status: "OPEN",
      matchedWith: null,
      isRequestSubmission: false,
    };
    const newTrip = await TravelBuddy.create({ ...payload, createdBy: userId });
    return res.status(201).json({ success: true, data: newTrip });
  } catch (error) {
    console.error("Create Trip Error:", error);
    return res.status(400).json({ success: false, message: error.message || "Unable to create trip." });
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

const normalizeFlightValue = (value) =>
  String(value || "").trim().toUpperCase().replace(/\s+/g, "");

const getFinalFlight = (trip) => {
  if (!Array.isArray(trip?.flights) || trip.flights.length === 0) {
    return null;
  }

  return trip.flights[trip.flights.length - 1];
};

const isSameDepartureDate = (first, second) => {
  if (!first?.departureTime || !second?.departureTime) {
    return false;
  }

  const firstDate = new Date(first.departureTime);
  const secondDate = new Date(second.departureTime);

  if (
    Number.isNaN(firstDate.getTime()) ||
    Number.isNaN(secondDate.getTime())
  ) {
    return false;
  }

  // Temporary UTC-date comparison.
  // See the local-date note below.
  return firstDate.toISOString().slice(0, 10) ===
    secondDate.toISOString().slice(0, 10);
};

const getSharedFlight = (firstTrip, secondTrip) => {
  for (const firstFlight of firstTrip.flights || []) {
    for (const secondFlight of secondTrip.flights || []) {
      const sameAirline =
        normalizeFlightValue(firstFlight.airline) ===
        normalizeFlightValue(secondFlight.airline);

      const sameNumber =
        normalizeFlightValue(firstFlight.flightNumber) ===
        normalizeFlightValue(secondFlight.flightNumber);

      if (
        sameAirline &&
        sameNumber &&
        isSameDepartureDate(firstFlight, secondFlight)
      ) {
        return firstFlight;
      }
    }
  }

  return null;
};

const getPrivateSubmittedTripIds = async () => {
  // Covers both the explicit trip flag and older submissions created before that flag existed.
  return TravelBuddyRequest.distinct("submittedTripId", {
    $or: [
      { status: "PENDING" },
      { status: "ACCEPTED" },
      { status: "REJECTED", publishOnReject: { $ne: true } },
      { status: "CANCELLED", publishOnReject: { $ne: true } },
    ],
  });
};

export const getMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId || req.user?._id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID",
      });
    }

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only the trip owner can view its matches.
    const trip = await TravelBuddy.findOne({
      _id: id,
      createdBy: userId,
    }).lean();

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    if (trip.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: "Matching is available only for open trips",
      });
    }

    if (!Array.isArray(trip.flights) || trip.flights.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This trip has no flight segments",
      });
    }

    const oppositeRole =
      trip.role === "parent" ? "companion" : "parent";

    // Fetch only open trips from other members with the opposite role.
    const privateSubmittedTripIds = await getPrivateSubmittedTripIds();
    if (trip.isRequestSubmission || privateSubmittedTripIds.some((tripId) => String(tripId) === String(trip._id))) {
      return res.status(403).json({
        success: false,
        message: "This submitted offer is private until it is published or approved.",
      });
    }
    const candidates = await TravelBuddy.find({
      _id: { $ne: trip._id, $nin: privateSubmittedTripIds },
      createdBy: { $ne: userId },
      role: oppositeRole,
      status: "OPEN",
      isRequestSubmission: { $ne: true },
    })
      .select("role flights languages help createdAt")
      .lean();

    const tier1 = [];
    const tier2 = [];
    const tier1TripIds = new Set();

    const formatMatch = (candidate, tier, sharedFlight = null) => {
      const finalFlight = getFinalFlight(candidate);

      return {
        id: String(candidate._id),
        tripId: String(candidate._id),
        role: candidate.role,
        tier,
        tierLabel:
          tier === 1
            ? "Tier 1: Same flight"
            : "Tier 2: Same arrival airport",
        route: finalFlight
          ? `${candidate.flights[0].fromCode} → ${finalFlight.toCode}`
          : "",
        flightNumber: sharedFlight?.flightNumber || null,
        arrivalAirport: finalFlight?.toCode || null,
        arrivalTime: finalFlight?.arrivalTime || null,
        languages: candidate.languages || [],
        help: candidate.help || [],
        note:
          tier === 1
            ? "This member shares a flight with your trip."
            : "This member may be able to meet at the arrival airport.",
        // Do not expose traveller names, age band, or contact details
        // in pre-approval match results.
        name: "Saathi member",
        initials: "S",
      };
    };

    const ownFinalFlight = getFinalFlight(trip);

    if (!ownFinalFlight?.arrivalTime || !ownFinalFlight?.toCode) {
      return res.status(400).json({
        success: false,
        message: "The final flight segment is missing arrival details",
      });
    }

    const ownArrivalTime = new Date(ownFinalFlight.arrivalTime);
    const fourHoursMs = 4 * 60 * 60 * 1000;

    for (const candidate of candidates) {
      if (!candidate.flights?.length) continue;

      // Tier 1: same airline, flight number, and departure date.
      const sharedFlight = getSharedFlight(trip, candidate);

      if (sharedFlight) {
        tier1TripIds.add(String(candidate._id));
        tier1.push(formatMatch(candidate, 1, sharedFlight));
        continue;
      }

      // Tier 2: same final arrival airport, within four hours.
      const candidateFinalFlight = getFinalFlight(candidate);

      if (
        !candidateFinalFlight?.toCode ||
        !candidateFinalFlight?.arrivalTime
      ) {
        continue;
      }

      const sameArrivalAirport =
        normalizeFlightValue(candidateFinalFlight.toCode) ===
        normalizeFlightValue(ownFinalFlight.toCode);

      const candidateArrivalTime = new Date(
        candidateFinalFlight.arrivalTime
      );

      if (
        !sameArrivalAirport ||
        Number.isNaN(candidateArrivalTime.getTime())
      ) {
        continue;
      }

      const arrivalDifference = Math.abs(
        candidateArrivalTime.getTime() - ownArrivalTime.getTime()
      );

      if (arrivalDifference <= fourHoursMs) {
        tier2.push(formatMatch(candidate, 2));
      }
    }

    res.status(200).json({
      success: true,
      data: {
        tripId: String(trip._id),
        tier1,
        tier2,
        totalMatches: tier1.length + tier2.length,
      },
    });
  } catch (error) {
    console.error("Get Matches Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to find matching trips",
    });
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

    // Submitted offer trips remain private until explicitly published after rejection.
    const privateSubmittedTripIds = await getPrivateSubmittedTripIds();
    const query = {
      status: "OPEN",
      createdBy: { $ne: userId },
      _id: { $nin: privateSubmittedTripIds },
      isRequestSubmission: { $ne: true },
    };

    // 2. Filter by role if selected (parent vs companion)
    if (role && ["parent", "companion"].includes(role)) {
      query.role = role;
    }

    // 3. Handle search (flight number, airline, or airport code)
    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
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


const getUserId = (req) =>
  req.user?._id || req.user?.id || req.user?.userId || req.userId;

const notifyUser = async ({ userId, actorId, type, title, message, data }) => {
  try {
    const notification = await createNotificationService({
      userId,
      actorId,
      type,
      title,
      message,
      data,
    });

    emitNotification(String(userId), {
      _id: String(notification._id),
      userId: String(userId),
      actorId: String(actorId),
      type,
      title,
      message,
      data: {
        ...data,
        _id: String(notification._id),
      },
      isRead: false,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    // The request itself should not fail just because notification delivery failed.
    console.error("Travel Buddy notification error:", error);
  }
};

/**
 * POST /api/v1/travel-buddy/requests
 * Creates the user's trip and submits a pending request against the target trip.
 */

export const createTravelBuddyRequest = async (req, res) => {
  const userId = getUserId(req);
  let submittedTrip = null;

  try {
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { targetTripId, trip: tripPayload, contactConsent } =
      req.body || {};

    if (contactConsent !== true) {
      return res.status(400).json({
        success: false,
        message: "You must agree to contact sharing before sending this request.",
      });
    }

    if (
      !mongoose.isValidObjectId(targetTripId) ||
      !tripPayload ||
      typeof tripPayload !== "object" ||
      Array.isArray(tripPayload)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid target trip and submitted trip are required.",
      });
    }

    const targetTrip = await TravelBuddy.findById(targetTripId);

    if (!targetTrip) {
      return res.status(404).json({
        success: false,
        message: "The original trip was not found.",
      });
    }

    if (String(targetTrip.createdBy) === String(userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot request approval for your own trip.",
      });
    }

    if (targetTrip.status !== "OPEN") {
      return res.status(409).json({
        success: false,
        message: "This trip is no longer open for requests.",
      });
    }

    const expectedRole =
      targetTrip.role === "parent" ? "companion" : "parent";

    if (tripPayload.role !== expectedRole) {
      return res.status(400).json({
        success: false,
        message: `The submitted trip must use the ${expectedRole} role.`,
      });
    }

    const existingRequest = await TravelBuddyRequest.findOne({
      targetTripId: targetTrip._id,
      requesterId: userId,
      status: "PENDING",
    });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending request for this trip.",
        data: existingRequest,
      });
    }

    // Only allow the expected trip fields from the client.
    const safeTripPayload = {
      role: tripPayload.role,
      flights: tripPayload.flights,
      relationship:
        tripPayload.role === "parent"
          ? tripPayload.relationship
          : undefined,
      ageBand:
        tripPayload.role === "parent"
          ? tripPayload.ageBand
          : undefined,
      languages: tripPayload.languages,
      help: tripPayload.help,
      pickup: tripPayload.pickup,
      status: "OPEN",
      matchedWith: null,
    };

    submittedTrip = await TravelBuddy.create({
      ...safeTripPayload,
      createdBy: userId,
    });

    let request;

    try {
      request = await TravelBuddyRequest.create({
        targetTripId: targetTrip._id,
        submittedTripId: submittedTrip._id,
        requesterId: userId,
        recipientId: targetTrip.createdBy,
        requesterContactConsent: true,
        requesterConsentAt: new Date(),
        recipientContactConsent: false,
        recipientConsentAt: null,
        status: "PENDING",
      });
    } catch (error) {
      await TravelBuddy.findByIdAndDelete(submittedTrip._id);
      throw error;
    }

    const requester = await User.findById(userId)
      .select("firstName lastName")
      .lean();

    const requesterName =
      [requester?.firstName, requester?.lastName]
        .filter(Boolean)
        .join(" ") || "A Saathi member";

    await notifyUser({
      userId: targetTrip.createdBy,
      actorId: userId,
      type: "travel_buddy_request",
      title: "New Travel Buddy request",
      message: `${requesterName} wants to connect with your trip. Review their request.`,
      data: {
        requestId: String(request._id),
        targetTripId: String(targetTrip._id),
        submittedTripId: String(submittedTrip._id),
        requesterId: String(userId),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Your request has been sent for approval.",
      data: {
        request,
        submittedTrip,
      },
    });
  } catch (error) {
    console.error("Create Travel Buddy Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit the Travel Buddy request.",
    });
  }
};


/**
 * GET /api/v1/travel-buddy/requests/received
 */
export const getReceivedTravelBuddyRequests = async (req, res) => {
  const userId = getUserId(req);

  try {
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const requests = await TravelBuddyRequest.find({
      recipientId: userId,
    })
      .populate("requesterId", "firstName lastName profileImage")
      .populate("targetTripId")
      .populate("submittedTripId")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Get Received Travel Buddy Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch received requests.",
    });
  }
};

/**
 * GET /api/v1/travel-buddy/requests/sent
 */
export const getSentTravelBuddyRequests = async (req, res) => {
  const userId = getUserId(req);

  try {
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const requests = await TravelBuddyRequest.find({
      requesterId: userId,
    })
      .populate("recipientId", "firstName lastName profileImage")
      .populate("targetTripId")
      .populate("submittedTripId")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Get Sent Travel Buddy Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch sent requests.",
    });
  }
};

/**
 * PATCH /api/v1/travel-buddy/requests/:id/respond
 * Only the original target-trip owner may approve or reject.
 */

export const respondToTravelBuddyRequest = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const action = String(req.body?.action || "").toLowerCase();
  const contactConsent = req.body?.contactConsent === true;

  try {
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be accept or reject.",
      });
    }

    if (action === "accept" && !contactConsent) {
      return res.status(400).json({
        success: false,
        message: "You must agree to contact sharing before approving this request.",
      });
    }

    const request = await TravelBuddyRequest.findOne({
      _id: id,
      recipientId: userId,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found for this account.",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "This request has already been processed.",
      });
    }

    const targetTrip = await TravelBuddy.findOne({
      _id: request.targetTripId,
      createdBy: userId,
      status: "OPEN",
    });

    const submittedTrip = await TravelBuddy.findOne({
      _id: request.submittedTripId,
      createdBy: request.requesterId,
      status: "OPEN",
    });

    if (!targetTrip || !submittedTrip) {
      return res.status(409).json({
        success: false,
        message: "One of the trips is no longer open.",
      });
    }

    if (action === "reject") {
      const rejected = await TravelBuddyRequest.findOneAndUpdate(
        {
          _id: id,
          recipientId: userId,
          status: "PENDING",
        },
        {
          $set: {
            status: "REJECTED",
            respondedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!rejected) {
        return res.status(409).json({
          success: false,
          message: "This request was already processed.",
        });
      }

      await notifyUser({
        userId: request.requesterId,
        actorId: userId,
        type: "travel_buddy_request_rejected",
        title: "Travel Buddy request declined",
        message: "Your Travel Buddy request was declined.",
        data: {
          requestId: String(request._id),
          targetTripId: String(request.targetTripId),
          submittedTripId: String(request.submittedTripId),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Request rejected.",
        data: rejected,
      });
    }

    // Claim the request once. This prevents two simultaneous responses
    // from approving the same pending request.
    const accepted = await TravelBuddyRequest.findOneAndUpdate(
      {
        _id: id,
        recipientId: userId,
        status: "PENDING",
        requesterContactConsent: true,
      },
      {
        $set: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          recipientContactConsent: true,
          recipientConsentAt: new Date(),
        },
      },
      { new: true }
    );

    if (!accepted) {
      return res.status(409).json({
        success: false,
        message: "The request was already processed or requester consent is missing.",
      });
    }

    // Match both trips.
    const updatedTarget = await TravelBuddy.findOneAndUpdate(
      {
        _id: targetTrip._id,
        createdBy: userId,
        status: "OPEN",
      },
      {
        $set: {
          status: "MATCHED",
          matchedWith: request.requesterId,
        },
      },
      { new: true }
    );

    const updatedSubmitted = await TravelBuddy.findOneAndUpdate(
      {
        _id: submittedTrip._id,
        createdBy: request.requesterId,
        status: "OPEN",
      },
      {
        $set: {
          status: "MATCHED",
          matchedWith: userId,
        },
      },
      { new: true }
    );

    if (!updatedTarget || !updatedSubmitted) {
      // Restore the request state if matching could not finish.
      // Also restore any trip this operation changed.
      await Promise.all([
        TravelBuddy.findOneAndUpdate(
          { _id: targetTrip._id, status: "MATCHED", matchedWith: request.requesterId },
          { $set: { status: "OPEN", matchedWith: null } }
        ),
        TravelBuddy.findOneAndUpdate(
          { _id: submittedTrip._id, status: "MATCHED", matchedWith: userId },
          { $set: { status: "OPEN", matchedWith: null } }
        ),
        TravelBuddyRequest.findOneAndUpdate(
          { _id: id, status: "ACCEPTED" },
          {
            $set: {
              status: "PENDING",
              respondedAt: null,
              recipientContactConsent: false,
              recipientConsentAt: null,
            },
          }
        ),
      ]);

      return res.status(409).json({
        success: false,
        message: "A trip changed while processing. Refresh and try again.",
      });
    }

    // Decline other pending requests targeting this now-matched trip.
    await TravelBuddyRequest.updateMany(
      {
        targetTripId: targetTrip._id,
        _id: { $ne: request._id },
        status: "PENDING",
      },
      {
        $set: {
          status: "REJECTED",
          respondedAt: new Date(),
        },
      }
    );

    await notifyUser({
      userId: request.requesterId,
      actorId: userId,
      type: "travel_buddy_request_accepted",
      title: "Travel Buddy request approved",
      message: "Your Travel Buddy request was approved.",
      data: {
        requestId: String(request._id),
        targetTripId: String(request.targetTripId),
        submittedTripId: String(request.submittedTripId),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Request approved. The trips are now matched.",
      data: {
        request: accepted,
        targetTrip: updatedTarget,
        submittedTrip: updatedSubmitted,
      },
    });
  } catch (error) {
    console.error("Respond to Travel Buddy Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process the Travel Buddy request.",
    });
  }
};


/**
 * GET /api/v1/travel-buddy/requests/:id/contact
 * Contact details are returned only for an accepted request, to either participant.
 */

export const getTravelBuddyRequestContact = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  try {
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request ID.",
      });
    }

    const request = await TravelBuddyRequest.findOne({
      _id: id,
      status: "ACCEPTED",
      requesterContactConsent: true,
      recipientContactConsent: true,
      $or: [
        { requesterId: userId },
        { recipientId: userId },
      ],
    }).lean();

    if (!request) {
      return res.status(403).json({
        success: false,
        message:
          "Contact details are available only after both members consent and the request is approved.",
      });
    }

    const otherUserId =
      String(request.requesterId) === String(userId)
        ? request.recipientId
        : request.requesterId;

    const contact = await User.findById(otherUserId)
      .select(
        "firstName lastName profileImage mobile messageNumber isMessageApproved"
      )
      .lean();

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Member not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        profileImage: contact.profileImage,
        mobile: contact.isMessageApproved ? contact.mobile : null,
        messageNumber: contact.isMessageApproved
          ? contact.messageNumber
          : null,
        isMessageApproved: Boolean(contact.isMessageApproved),
      },
    });
  } catch (error) {
    console.error("Get Travel Buddy Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve contact details.",
    });
  }
};



export const getTripById = async (req, res) => {
  try {
    const userId =
      req.user?.id || req.user?.userId || req.user?._id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID.",
      });
    }

    // Only the owner can load their own trip for match management.
    const trip = await TravelBuddy.findOne({
      _id: id,
      createdBy: userId,
    }).lean();

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    console.error("getTripById failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load trip.",
    });
  }
};

export const getAcceptedTripDetails = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { tripId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID.",
      });
    }

    const request = await TravelBuddyRequest.findOne({
      status: "ACCEPTED",
      $or: [
        { targetTripId: tripId },
        { submittedTripId: tripId },
      ],
      $and: [
        {
          $or: [
            { requesterId: userId },
            { recipientId: userId },
          ],
        },
      ],
    }).lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "No accepted trip was found for this account.",
      });
    }

    const [targetTrip, submittedTrip] = await Promise.all([
      TravelBuddy.findById(request.targetTripId).lean(),
      TravelBuddy.findById(request.submittedTripId).lean(),
    ]);

    if (!targetTrip || !submittedTrip) {
      return res.status(404).json({
        success: false,
        message: "Matched trip details could not be found.",
      });
    }

    const otherUserId =
      String(request.requesterId) === String(userId)
        ? request.recipientId
        : request.requesterId;

    // Return only intended contact fields, not the full user document.
    const otherTraveller = await User.findById(otherUserId)
      .select("name fullName firstName lastName phone mobile email")
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        requestId: String(request._id),
        targetTrip,
        submittedTrip,
        otherTraveller: otherTraveller
          ? {
              name:
                otherTraveller.name ||
                otherTraveller.fullName ||
                [
                  otherTraveller.firstName,
                  otherTraveller.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                "Travel Buddy",
              phone:
                otherTraveller.phone ||
                otherTraveller.mobile ||
                "",
              email: otherTraveller.email || "",
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getAcceptedTripDetails failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load accepted trip details.",
    });
  }
};