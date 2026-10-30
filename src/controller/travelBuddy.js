import TravelBuddy from "../model/travelBuddy.js";
import User from "../model/user.js";
import mongoose from "mongoose";
import TravelBuddyRequest from "../model/travelBuddyRequest.js";
import { createNotificationService } from "../service/notification.js";
import { emitNotification } from "../../socket.js";

const getUserId = (req) =>
  req.user?._id || req.user?.id || req.user?.userId || req.userId;

/* ───────────────────────────────────────────────────────
   Helper: auto-complete trips whose last arrival has passed
   ─────────────────────────────────────────────────────── */
const autoCompleteExpiredTrips = async (userId) => {
  const now = new Date();
  const candidates = await TravelBuddy.find({
    status: { $in: ["OPEN", "MATCHED"] },
    createdBy: userId,
  }).select("_id flights");
  const expiredIds = candidates
    .filter((t) => {
      const last = t.flights?.[t.flights.length - 1];
      if (!last?.arrivalTime) return false;
      return new Date(last.arrivalTime) < now;
    })
    .map((t) => t._id);
  if (expiredIds.length) {
    await TravelBuddy.updateMany(
      { _id: { $in: expiredIds } },
      { $set: { status: "COMPLETED" } }
    );
  }
};

/* ───────────────────────────────────────────────────────
   Create
   ─────────────────────────────────────────────────────── */
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

/* ───────────────────────────────────────────────────────
   My Trips — ★ includes matched trips via accepted requests
   ─────────────────────────────────────────────────────── */
export const getMyTrips = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });

    await autoCompleteExpiredTrips(userId);

    // ★ Only return trips created by this user. 
    // The other person's trip details are fetched via the /accepted/:id endpoint.
    const trips = await TravelBuddy.find({ createdBy: userId })
      .populate("createdBy", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: trips });
  } catch (error) {
    console.error("getMyTrips Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ───────────────────────────────────────────────────────
   Flight helpers
   ─────────────────────────────────────────────────────── */
const normalizeFlightValue = (v) => String(v || "").trim().toUpperCase().replace(/\s+/g, "");
const getFinalFlight = (trip) =>
  Array.isArray(trip?.flights) && trip.flights.length ? trip.flights[trip.flights.length - 1] : null;

const isSameDepartureDate = (a, b) => {
  if (!a?.departureTime || !b?.departureTime) return false;
  const d1 = new Date(a.departureTime);
  const d2 = new Date(b.departureTime);
  if (isNaN(d1) || isNaN(d2)) return false;
  return d1.toISOString().slice(0, 10) === d2.toISOString().slice(0, 10);
};

const getSharedFlight = (a, b) => {
  for (const f1 of a.flights || []) {
    for (const f2 of b.flights || []) {
      if (
        normalizeFlightValue(f1.airline) === normalizeFlightValue(f2.airline) &&
        normalizeFlightValue(f1.flightNumber) === normalizeFlightValue(f2.flightNumber) &&
        isSameDepartureDate(f1, f2)
      ) return f1;
    }
  }
  return null;
};

const getPrivateSubmittedTripIds = async () =>
  TravelBuddyRequest.distinct("submittedTripId", {
    $or: [
      { status: "PENDING" },
      { status: "ACCEPTED" },
      { status: "REJECTED", publishOnReject: { $ne: true } },
      { status: "CANCELLED", publishOnReject: { $ne: true } },
    ],
  });

/* ───────────────────────────────────────────────────────
   Matches
   ─────────────────────────────────────────────────────── */
export const getMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid trip ID" });
    if (!userId || !mongoose.isValidObjectId(userId)) return res.status(401).json({ success: false, message: "Authentication required" });

    const trip = await TravelBuddy.findOne({ _id: id, createdBy: userId }).lean();
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (trip.status !== "OPEN") return res.status(400).json({ success: false, message: "Matching is available only for open trips" });
    if (!Array.isArray(trip.flights) || trip.flights.length === 0) return res.status(400).json({ success: false, message: "This trip has no flight segments" });

    const oppositeRole = trip.role === "parent" ? "companion" : "parent";
    const privateSubmittedTripIds = await getPrivateSubmittedTripIds();

    if (trip.isRequestSubmission || privateSubmittedTripIds.some((t) => String(t) === String(trip._id))) {
      return res.status(403).json({ success: false, message: "This submitted offer is private until it is published or approved." });
    }

    const candidates = await TravelBuddy.find({
      _id: { $ne: trip._id, $nin: privateSubmittedTripIds },
      createdBy: { $ne: userId },
      role: oppositeRole,
      status: "OPEN",
      isRequestSubmission: { $ne: true },
    }).select("role flights languages help createdAt").lean();

    const tier1 = [], tier2 = [];
    const formatMatch = (candidate, tier, sharedFlight = null) => {
      const last = getFinalFlight(candidate);
      return {
        id: String(candidate._id),
        tripId: String(candidate._id),
        role: candidate.role,
        tier,
        tierLabel: tier === 1 ? "Tier 1: Same flight" : "Tier 2: Same arrival airport",
        route: last ? `${candidate.flights[0].fromCode} → ${last.toCode}` : "",
        flightNumber: sharedFlight?.flightNumber || null,
        arrivalAirport: last?.toCode || null,
        arrivalTime: last?.arrivalTime || null,
        languages: candidate.languages || [],
        help: candidate.help || [],
        note: tier === 1 ? "This member shares a flight with your trip." : "This member may be able to meet at the arrival airport.",
        name: "Saathi member",
        initials: "S",
      };
    };

    const ownLast = getFinalFlight(trip);
    if (!ownLast?.arrivalTime || !ownLast?.toCode) {
      return res.status(400).json({ success: false, message: "The final flight segment is missing arrival details" });
    }
    const ownArrival = new Date(ownLast.arrivalTime);
    const fourHrs = 4 * 60 * 60 * 1000;

    for (const cand of candidates) {
      if (!cand.flights?.length) continue;
      const shared = getSharedFlight(trip, cand);
      if (shared) {
        tier1.push(formatMatch(cand, 1, shared));
        continue;
      }
      const cLast = getFinalFlight(cand);
      if (!cLast?.toCode || !cLast?.arrivalTime) continue;
      if (normalizeFlightValue(cLast.toCode) !== normalizeFlightValue(ownLast.toCode)) continue;
      const cArrival = new Date(cLast.arrivalTime);
      if (Number.isNaN(cArrival.getTime())) continue;
      if (Math.abs(cArrival.getTime() - ownArrival.getTime()) <= fourHrs) {
        tier2.push(formatMatch(cand, 2));
      }
    }

    return res.status(200).json({
      success: true,
      data: { tripId: String(trip._id), tier1, tier2, totalMatches: tier1.length + tier2.length },
    });
  } catch (error) {
    console.error("getMatches Error:", error);
    return res.status(500).json({ success: false, message: "Unable to find matching trips" });
  }
};

/* ───────────────────────────────────────────────────────
   Browse All Trips
   ─────────────────────────────────────────────────────── */
export const getAllTrips = async (req, res) => {
  try {
    const { search, role } = req.query;
    const userId = getUserId(req);
    const privateSubmittedTripIds = await getPrivateSubmittedTripIds();

    const query = {
      status: "OPEN",
      createdBy: { $ne: userId },
      _id: { $nin: privateSubmittedTripIds },
      isRequestSubmission: { $ne: true },
    };

    if (role && ["parent", "companion"].includes(role)) query.role = role;

    if (search) {
      const esc = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(esc, "i");
      query.$or = [
        { "flights.flightNumber": rx },
        { "flights.airline": rx },
        { "flights.fromCode": rx },
        { "flights.toCode": rx },
      ];
    }

    const trips = await TravelBuddy.find(query)
      .populate("createdBy", "firstName lastName profileImage languages")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Smart sort: same-flight at top
    let myTrip = null;
    if (userId) {
      myTrip = await TravelBuddy.findOne({ createdBy: userId, status: "OPEN" }).lean();
    }
    if (myTrip?.flights?.length) {
      const myNums = myTrip.flights.map((f) => f.flightNumber);
      trips.sort((a, b) => {
        const aM = a.flights?.some((f) => myNums.includes(f.flightNumber));
        const bM = b.flights?.some((f) => myNums.includes(f.flightNumber));
        if (aM && !bM) return -1;
        if (!aM && bM) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    return res.status(200).json({ success: true, data: trips });
  } catch (error) {
    console.error("getAllTrips Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ───────────────────────────────────────────────────────
   Notify helper
   ─────────────────────────────────────────────────────── */
const notifyUser = async ({ userId, actorId, type, title, message, data }) => {
  try {
    const notification = await createNotificationService({
      userId, actorId, type, title, message, data,
    });
    emitNotification(String(userId), {
      _id: String(notification._id),
      userId: String(userId),
      actorId: String(actorId),
      type, title, message,
      data: { ...data, _id: String(notification._id) },
      isRead: false,
      createdAt: notification.createdAt,
    });
  } catch (err) {
    console.error("Travel Buddy notification error:", err);
  }
};

/* ───────────────────────────────────────────────────────
   Create request
   ─────────────────────────────────────────────────────── */
export const createTravelBuddyRequest = async (req, res) => {
  const userId = getUserId(req);
  let submittedTrip = null;
  try {
    if (!userId || !mongoose.isValidObjectId(userId)) return res.status(401).json({ success: false, message: "Authentication required." });
    const { targetTripId, trip: tripPayload, contactConsent } = req.body || {};
    if (contactConsent !== true) return res.status(400).json({ success: false, message: "You must agree to contact sharing before sending this request." });
    if (!mongoose.isValidObjectId(targetTripId) || !tripPayload || typeof tripPayload !== "object") {
      return res.status(400).json({ success: false, message: "A valid target trip and submitted trip are required." });
    }

    const targetTrip = await TravelBuddy.findById(targetTripId);
    if (!targetTrip) return res.status(404).json({ success: false, message: "The original trip was not found." });
    if (String(targetTrip.createdBy) === String(userId)) return res.status(400).json({ success: false, message: "You cannot request approval for your own trip." });
    if (targetTrip.status !== "OPEN") return res.status(409).json({ success: false, message: "This trip is no longer open for requests." });

    const expectedRole = targetTrip.role === "parent" ? "companion" : "parent";
    if (tripPayload.role !== expectedRole) return res.status(400).json({ success: false, message: `The submitted trip must use the ${expectedRole} role.` });

    const existing = await TravelBuddyRequest.findOne({ targetTripId: targetTrip._id, requesterId: userId, status: "PENDING" });
    if (existing) return res.status(409).json({ success: false, message: "You already have a pending request for this trip.", data: existing });

    // ★ Only allow the fields we need; disable client override of critical fields
    const safe = {
      role: tripPayload.role,
      flights: tripPayload.flights,
      relationship: tripPayload.role === "parent" ? tripPayload.relationship : undefined,
      ageBand: tripPayload.role === "parent" ? tripPayload.ageBand : undefined,
      languages: tripPayload.languages,
      help: tripPayload.help,
      pickup: tripPayload.pickup,
      status: "OPEN",
      matchedWith: null,
    };

    submittedTrip = await TravelBuddy.create({ ...safe, createdBy: userId });

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
    } catch (err) {
      await TravelBuddy.findByIdAndDelete(submittedTrip._id);
      throw err;
    }

    const requester = await User.findById(userId).select("firstName lastName").lean();
    const requesterName = [requester?.firstName, requester?.lastName].filter(Boolean).join(" ") || "A Saathi member";

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

    return res.status(201).json({ success: true, message: "Your request has been sent for approval.", data: { request, submittedTrip } });
  } catch (error) {
    console.error("Create Travel Buddy Request Error:", error);
    return res.status(500).json({ success: false, message: "Unable to submit the Travel Buddy request." });
  }
};

/* ───────────────────────────────────────────────────────
   Received / Sent
   ─────────────────────────────────────────────────────── */
export const getReceivedTravelBuddyRequests = async (req, res) => {
  const userId = getUserId(req);
  try {
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    const requests = await TravelBuddyRequest.find({ recipientId: userId })
      .populate("requesterId", "firstName lastName profileImage")
      .populate("targetTripId")
      .populate("submittedTripId")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("getReceivedTravelBuddyRequests Error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch received requests." });
  }
};

export const getSentTravelBuddyRequests = async (req, res) => {
  const userId = getUserId(req);
  try {
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    const requests = await TravelBuddyRequest.find({ requesterId: userId })
      .populate("recipientId", "firstName lastName profileImage")
      .populate("targetTripId")
      .populate("submittedTripId")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("getSentTravelBuddyRequests Error:", error);
    return res.status(500).json({ success: false, message: "Unable to fetch sent requests." });
  }
};

/* ───────────────────────────────────────────────────────
   Respond (accept / reject)
   ─────────────────────────────────────────────────────── */
export const respondToTravelBuddyRequest = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const action = String(req.body?.action || "").toLowerCase();
  const contactConsent = req.body?.contactConsent === true;

  try {
    if (!userId || !mongoose.isValidObjectId(userId)) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid request ID." });
    if (!["accept", "reject"].includes(action)) return res.status(400).json({ success: false, message: "Action must be accept or reject." });
    if (action === "accept" && !contactConsent) return res.status(400).json({ success: false, message: "You must agree to contact sharing before approving this request." });

    const request = await TravelBuddyRequest.findOne({ _id: id, recipientId: userId });
    if (!request) return res.status(404).json({ success: false, message: "Request not found for this account." });
    if (request.status !== "PENDING") return res.status(409).json({ success: false, message: "This request has already been processed." });

    const targetTrip = await TravelBuddy.findOne({ _id: request.targetTripId, createdBy: userId, status: "OPEN" });
    const submittedTrip = await TravelBuddy.findOne({ _id: request.submittedTripId, createdBy: request.requesterId, status: "OPEN" });

    if (!targetTrip || !submittedTrip) return res.status(409).json({ success: false, message: "One of the trips is no longer open." });

    if (action === "reject") {
      const rejected = await TravelBuddyRequest.findOneAndUpdate(
        { _id: id, recipientId: userId, status: "PENDING" },
        { $set: { status: "REJECTED", respondedAt: new Date() } },
        { new: true }
      );
      if (!rejected) return res.status(409).json({ success: false, message: "This request was already processed." });
      await notifyUser({
        userId: request.requesterId, actorId: userId,
        type: "travel_buddy_request_rejected",
        title: "Travel Buddy request declined",
        message: "Your Travel Buddy request was declined.",
        data: { requestId: String(request._id), targetTripId: String(request.targetTripId), submittedTripId: String(request.submittedTripId) },
      });
      return res.status(200).json({ success: true, message: "Request rejected.", data: rejected });
    }

    // Accept
    const accepted = await TravelBuddyRequest.findOneAndUpdate(
      { _id: id, recipientId: userId, status: "PENDING", requesterContactConsent: true },
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
    if (!accepted) return res.status(409).json({ success: false, message: "The request was already processed or requester consent is missing." });

    const updatedTarget = await TravelBuddy.findOneAndUpdate(
      { _id: targetTrip._id, createdBy: userId, status: "OPEN" },
      { $set: { status: "MATCHED", matchedWith: request.requesterId } },
      { new: true }
    );
    const updatedSubmitted = await TravelBuddy.findOneAndUpdate(
      { _id: submittedTrip._id, createdBy: request.requesterId, status: "OPEN" },
      { $set: { status: "MATCHED", matchedWith: userId } },
      { new: true }
    );

    if (!updatedTarget || !updatedSubmitted) {
      await Promise.all([
        TravelBuddy.findOneAndUpdate({ _id: targetTrip._id, status: "MATCHED", matchedWith: request.requesterId }, { $set: { status: "OPEN", matchedWith: null } }),
        TravelBuddy.findOneAndUpdate({ _id: submittedTrip._id, status: "MATCHED", matchedWith: userId }, { $set: { status: "OPEN", matchedWith: null } }),
        TravelBuddyRequest.findOneAndUpdate({ _id: id, status: "ACCEPTED" }, { $set: { status: "PENDING", respondedAt: null, recipientContactConsent: false, recipientConsentAt: null } }),
      ]);
      return res.status(409).json({ success: false, message: "A trip changed while processing. Refresh and try again." });
    }

    await TravelBuddyRequest.updateMany(
      { targetTripId: targetTrip._id, _id: { $ne: request._id }, status: "PENDING" },
      { $set: { status: "REJECTED", respondedAt: new Date() } }
    );

    await notifyUser({
      userId: request.requesterId, actorId: userId,
      type: "travel_buddy_request_accepted",
      title: "Travel Buddy request approved",
      message: "Your Travel Buddy request was approved.",
      data: { requestId: String(request._id), targetTripId: String(request.targetTripId), submittedTripId: String(request.submittedTripId) },
    });

    return res.status(200).json({
      success: true,
      message: "Request approved. The trips are now matched.",
      data: { request: accepted, targetTrip: updatedTarget, submittedTrip: updatedSubmitted },
    });
  } catch (error) {
    console.error("Respond to Travel Buddy Request Error:", error);
    return res.status(500).json({ success: false, message: "Unable to process the Travel Buddy request." });
  }
};

/* ───────────────────────────────────────────────────────
   Contact / accepted details
   ─────────────────────────────────────────────────────── */
export const getTravelBuddyRequestContact = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  try {
    if (!userId || !mongoose.isValidObjectId(userId)) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid request ID." });

    const request = await TravelBuddyRequest.findOne({
      _id: id, status: "ACCEPTED",
      requesterContactConsent: true, recipientContactConsent: true,
      $or: [{ requesterId: userId }, { recipientId: userId }],
    }).lean();
    if (!request) return res.status(403).json({ success: false, message: "Contact details are available only after both members consent and the request is approved." });

    const otherUserId = String(request.requesterId) === String(userId) ? request.recipientId : request.requesterId;
    const contact = await User.findById(otherUserId).select("firstName lastName profileImage mobile messageNumber isMessageApproved").lean();
    if (!contact) return res.status(404).json({ success: false, message: "Member not found." });

    return res.status(200).json({
      success: true,
      data: {
        firstName: contact.firstName, lastName: contact.lastName,
        profileImage: contact.profileImage,
        mobile: contact.isMessageApproved ? contact.mobile : null,
        messageNumber: contact.isMessageApproved ? contact.messageNumber : null,
        isMessageApproved: Boolean(contact.isMessageApproved),
      },
    });
  } catch (error) {
    console.error("getTravelBuddyRequestContact Error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve contact details." });
  }
};

export const getTripById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid trip ID." });

    const trip = await TravelBuddy.findOne({ _id: id, createdBy: userId }).lean();
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found." });
    return res.status(200).json({ success: true, data: trip });
  } catch (error) {
    console.error("getTripById failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load trip." });
  }
};

export const getAcceptedTripDetails = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { tripId } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!mongoose.isValidObjectId(tripId)) return res.status(400).json({ success: false, message: "Invalid trip ID." });

    const request = await TravelBuddyRequest.findOne({
      status: "ACCEPTED",
      $or: [{ targetTripId: tripId }, { submittedTripId: tripId }],
      $and: [{ $or: [{ requesterId: userId }, { recipientId: userId }] }],
    }).lean();
    if (!request) return res.status(404).json({ success: false, message: "No accepted trip was found for this account." });

    const [targetTrip, submittedTrip] = await Promise.all([
      TravelBuddy.findById(request.targetTripId).lean(),
      TravelBuddy.findById(request.submittedTripId).lean(),
    ]);
    if (!targetTrip || !submittedTrip) return res.status(404).json({ success: false, message: "Matched trip details could not be found." });

    const otherUserId = String(request.requesterId) === String(userId) ? request.recipientId : request.requesterId;
    const otherTraveller = await User.findById(otherUserId).select("name fullName firstName lastName phone mobile email").lean();

    return res.status(200).json({
      success: true,
      data: {
        requestId: String(request._id),
        targetTrip,
        submittedTrip,
        otherTraveller: otherTraveller ? {
          name: otherTraveller.name || otherTraveller.fullName || [otherTraveller.firstName, otherTraveller.lastName].filter(Boolean).join(" ") || "Travel Buddy",
          phone: otherTraveller.phone || otherTraveller.mobile || "",
          email: otherTraveller.email || "",
        } : null,
      },
    });
  } catch (error) {
    console.error("getAcceptedTripDetails failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load accepted trip details." });
  }
};