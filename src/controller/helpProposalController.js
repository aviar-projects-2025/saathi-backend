import mongoose from "mongoose";
import HelpProposal from "../model/helpProposal.js";
import Ride from "../model/ride.js";

const log = (...args) => console.log("[I_CAN_HELP][API]", ...args);
const warn = (...args) => console.warn("[I_CAN_HELP][API]", ...args);
const errLog = (...args) => console.error("[I_CAN_HELP][API]", ...args);

function currentUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId || req.userId || null;
}
function asId(value) {
  return value?._id || value?.id || value;
}
function sendError(res, status, message, code = "HELP_PROPOSAL_ERROR") {
  return res.status(status).json({ success: false, message, error: { code, message } });
}
function publicOfferDetails(input, requestRide) {
  const source = input && typeof input === "object" ? input : {};
  const from = String(source.from ?? requestRide.from ?? "").trim();
  const destination = String(source.destination ?? requestRide.destination ?? requestRide.to ?? "").trim();
  const modeOfTravel = String(source.modeOfTravel ?? requestRide.modeOfTravel ?? "Car");
  const startTime = new Date(source.startTime ?? requestRide.startTime);
  const availableSeats = Number(source.availableSeats ?? source.totalSeats ?? requestRide.passengers ?? 1);
  const costPerSeat = source.costPerSeat === "" || source.costPerSeat === undefined
    ? null
    : source.costPerSeat === null ? null : Number(source.costPerSeat);

  if (!from || !destination) throw new Error("Origin and destination are required.");
  if (Number.isNaN(startTime.getTime())) throw new Error("A valid departure date and time are required.");
  if (!Number.isInteger(availableSeats) || availableSeats < 1 || availableSeats > 8) {
    throw new Error("Available seats must be between 1 and 8.");
  }
  if (costPerSeat !== null && (!Number.isFinite(costPerSeat) || costPerSeat < 0)) {
    throw new Error("Cost per seat must be zero or greater.");
  }

  return {
    from,
    destination,
    modeOfTravel,
    startTime,
    availableSeats,
    totalSeats: availableSeats,
    costPerSeat,
    description: String(source.description ?? "").trim(),
    notes: String(source.notes ?? "").trim(),
  };
}

export async function createHelpProposal(req, res) {
  const traceId = new mongoose.Types.ObjectId().toString();
  const helperId = currentUserId(req);
  const { requestRideId, offerDetails } = req.body || {};
  // log("create:start", { traceId, helperId: String(helperId || ""), requestRideId });

  try {
    if (!helperId) return sendError(res, 401, "Authentication is required.", "UNAUTHENTICATED");
    if (!mongoose.isValidObjectId(requestRideId)) return sendError(res, 400, "Invalid request ride ID.", "INVALID_RIDE_ID");

    const requestRide = await Ride.findById(requestRideId);
    if (!requestRide) return sendError(res, 404, "Ride request not found.", "REQUEST_NOT_FOUND");
    if (String(requestRide.kind || "").toLowerCase() !== "request") {
      return sendError(res, 400, "You can offer help only for a ride request.", "NOT_A_REQUEST");
    }
    if (String(asId(requestRide.createdBy)) === String(helperId)) {
      return sendError(res, 400, "You cannot offer help on your own request.", "SELF_PROPOSAL");
    }
    if (String(requestRide.status || "OPEN").toUpperCase() !== "OPEN" || ["CANCELLED", "COMPLETED"].includes(String(requestRide.travelStatus || "").toUpperCase())) {
      return sendError(res, 409, "This ride request is no longer open.", "REQUEST_CLOSED");
    }

    const normalizedDetails = publicOfferDetails(offerDetails, requestRide);
    const existing = await HelpProposal.findOne({
      requestRideId: requestRide._id,
      helperId,
      status: "PENDING",
    });
    if (existing) return sendError(res, 409, "You already have a pending offer for this request.", "DUPLICATE_PENDING_PROPOSAL");

    const proposal = await HelpProposal.create({
      requestRideId: requestRide._id,
      requesterId: requestRide.createdBy,
      helperId,
      offerDetails: normalizedDetails,
      status: "PENDING",
    });

    const result = await HelpProposal.findById(proposal._id)
      .populate("helperId", "firstName lastName profileImage zipcode")
      .populate("requestRideId");
    // log("create:success", { traceId, proposalId: String(proposal._id), requestRideId: String(requestRide._id), helperId: String(helperId) });
    return res.status(201).json({ success: true, message: "Your offer to help was sent.", data: result });
  } catch (error) {
    errLog("create:failed", { traceId, message: error?.message, stack: error?.stack });
    return sendError(res, 500, error?.message || "Unable to create help proposal.", "CREATE_FAILED");
  }
}

export async function getReceivedHelpProposals(req, res) {
  const requesterId = currentUserId(req);
  // console.log(requesterId,'requesterId')
  // log("received:start", { requesterId: String(requesterId || "") });
  try {
    if (!requesterId) return sendError(res, 401, "Authentication is required.", "UNAUTHENTICATED");
    const proposals = await HelpProposal.find({ requesterId })
      .populate("helperId", "firstName lastName profileImage zipcode")
      .populate("requestRideId")
      .sort({ createdAt: -1 })
      .lean();
    // log("received:success", { requesterId: String(requesterId), count: proposals.length, pending: proposals.filter(p => p.status === "PENDING").length });
    return res.status(200).json({ success: true, data: proposals, count: proposals.length });
  } catch (error) {
    errLog("received:failed", { requesterId: String(requesterId || ""), message: error?.message, stack: error?.stack });
    return sendError(res, 500, "Unable to fetch help proposals.", "FETCH_FAILED");
  }
}

export async function respondToHelpProposal(req, res) {
  const requesterId = currentUserId(req);
  const { id } = req.params;
  const action = String(req.body?.action || "").toLowerCase();
  const traceId = new mongoose.Types.ObjectId().toString();

  let claimedRequestId = null;
  let createdRideId = null;
  try {
    if (!requesterId) return sendError(res, 401, "Authentication is required.", "UNAUTHENTICATED");
    if (!mongoose.isValidObjectId(id)) return sendError(res, 400, "Invalid proposal ID.", "INVALID_PROPOSAL_ID");
    if (!["accept", "reject"].includes(action)) return sendError(res, 400, "Action must be accept or reject.", "INVALID_ACTION");

    const proposal = await HelpProposal.findOne({ _id: id, requesterId });
    if (!proposal) return sendError(res, 404, "Help proposal not found for this account.", "PROPOSAL_NOT_FOUND");
    if (proposal.status !== "PENDING") return sendError(res, 409, `This proposal has already been ${proposal.status.toLowerCase()}.`, "PROPOSAL_ALREADY_RESPONDED");

    if (action === "reject") {
      const updated = await HelpProposal.findOneAndUpdate(
        { _id: proposal._id, requesterId, status: "PENDING" },
        { $set: { status: "REJECTED", respondedAt: new Date() } },
        { new: true }
      );
      if (!updated) return sendError(res, 409, "This proposal was already processed.", "PROPOSAL_RACE");
      // log("respond:rejected", { traceId, proposalId: String(proposal._id), requestRideId: String(proposal.requestRideId) });
      return res.status(200).json({ success: true, message: "Offer rejected. Your ride request remains open.", data: updated });
    }

    const requestRide = await Ride.findOne({
      _id: proposal.requestRideId,
      createdBy: requesterId,
      kind: "request",
      status: "OPEN",
      travelStatus: { $nin: ["Cancelled", "Completed"] },
    });
    if (!requestRide) return sendError(res, 409, "The original request is no longer open. Refresh My Rides.", "REQUEST_NOT_OPEN");

    // Atomic claim prevents two proposals from being accepted for the same request.
    const claimed = await Ride.findOneAndUpdate(
      { _id: requestRide._id, createdBy: requesterId, kind: "request", status: "OPEN", travelStatus: { $nin: ["Cancelled", "Completed"] } },
      { $set: { status: "CLOSED" } },
      { new: true }
    );
    if (!claimed) return sendError(res, 409, "Another proposal was accepted first, or this request was closed.", "REQUEST_ALREADY_CLAIMED");
    claimedRequestId = claimed._id;

    const details = publicOfferDetails(proposal.offerDetails, requestRide);
    const rideData = requestRide.toObject();
    delete rideData._id;
    delete rideData.__v;
    delete rideData.createdAt;
    delete rideData.updatedAt;
    delete rideData.id;

    const finalRide = await Ride.create({
      ...rideData,
      ...details,
      createdBy: requestRide.createdBy, // passenger remains the record owner
      actualDriver: proposal.helperId, // helper is the actual driver
      helpProposalId: proposal._id,
      kind: "offer",
      status: "OPEN",
      travelStatus: "Waiting",
      startTime: details.startTime,
    });
    createdRideId = finalRide._id;

    const accepted = await HelpProposal.findOneAndUpdate(
      { _id: proposal._id, requesterId, status: "PENDING" },
      { $set: { status: "ACCEPTED", confirmedRideId: finalRide._id, respondedAt: new Date() } },
      { new: true }
    );
    if (!accepted) throw new Error("Proposal status changed while acceptance was being processed.");

    const otherResult = await HelpProposal.updateMany(
      { requestRideId: requestRide._id, _id: { $ne: proposal._id }, status: "PENDING" },
      { $set: { status: "REJECTED", respondedAt: new Date() } }
    );

    // log("respond:accepted", {
    //   traceId,
    //   proposalId: String(proposal._id),
    //   finalRideId: String(finalRide._id),
    //   passengerId: String(requestRide.createdBy),
    //   actualDriverId: String(proposal.helperId),
    //   otherProposalsRejected: otherResult.modifiedCount,
    // });
    return res.status(200).json({
      success: true,
      message: "Offer accepted. The confirmed ride has been created.",
      data: { proposal: accepted, ride: finalRide },
    });
  } catch (error) {
    errLog("respond:failed", { traceId, proposalId: id, action, message: error?.message, stack: error?.stack });
    // Best-effort rollback if anything after claiming the request fails.
    if (createdRideId) await Ride.findByIdAndDelete(createdRideId).catch((e) => errLog("rollback:deleteRideFailed", e.message));
    if (claimedRequestId) await Ride.findOneAndUpdate({ _id: claimedRequestId, status: "CLOSED", kind: "request" }, { $set: { status: "OPEN" } }).catch((e) => errLog("rollback:reopenRequestFailed", e.message));
    return sendError(res, 500, error?.message || "Unable to respond to help proposal.", "RESPOND_FAILED");
  }
}

export async function updateHelpRideStatus(req, res) {
  const helperId = currentUserId(req);
  const { rideId } = req.params;
  const nextStatus = req.body?.travelStatus;
  // log("ride-status:start", { rideId, helperId: String(helperId || ""), nextStatus });
  try {
    if (!helperId) return sendError(res, 401, "Authentication is required.", "UNAUTHENTICATED");
    if (!mongoose.isValidObjectId(rideId)) return sendError(res, 400, "Invalid ride ID.", "INVALID_RIDE_ID");
    if (!["Started", "Completed"].includes(nextStatus)) return sendError(res, 400, "travelStatus must be Started or Completed.", "INVALID_TRAVEL_STATUS");

    const ride = await Ride.findOne({ _id: rideId, actualDriver: helperId, helpProposalId: { $ne: null }, kind: "offer" });
    if (!ride) return sendError(res, 403, "Only the assigned helper can update this accepted help ride.", "NOT_ASSIGNED_HELPER");
    const allowed = nextStatus === "Started"
      ? ride.travelStatus === "Waiting"
      : ["Started", "Ongoing"].includes(ride.travelStatus);
    if (!allowed) return sendError(res, 409, `Cannot change ride from ${ride.travelStatus} to ${nextStatus}.`, "INVALID_STATUS_TRANSITION");

    const update = { travelStatus: nextStatus };
    if (nextStatus === "Started") update.startedAt = new Date();
    if (nextStatus === "Completed") update.endTime = req.body?.endTime ? new Date(req.body.endTime) : new Date();
    const updatedRide = await Ride.findOneAndUpdate(
      { _id: ride._id, actualDriver: helperId, travelStatus: ride.travelStatus },
      { $set: update },
      { new: true }
    ).populate("createdBy", "firstName lastName profileImage zipcode")
     .populate("actualDriver", "firstName lastName profileImage zipcode");
    if (!updatedRide) return sendError(res, 409, "Ride status changed concurrently. Refresh and try again.", "STATUS_RACE");
    // log("ride-status:success", { rideId: String(updatedRide._id), nextStatus, helperId: String(helperId) });
    return res.status(200).json({ success: true, message: `Ride ${nextStatus.toLowerCase()} successfully.`, data: updatedRide });
  } catch (error) {
    errLog("ride-status:failed", { rideId, message: error?.message, stack: error?.stack });
    return sendError(res, 500, "Unable to update accepted help ride status.", "RIDE_STATUS_FAILED");
  }
}

export async function getSentHelpProposals(req, res) {
  const helperId = currentUserId(req);
  // log("sent:start", { helperId: String(helperId || "") });
  try {
    if (!helperId) return sendError(res, 401, "Authentication is required.", "UNAUTHENTICATED");

    const proposals = await HelpProposal.find({ helperId })
      .populate("requestRideId")
      .populate("requesterId", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // log("sent:success", { helperId: String(helperId), count: proposals.length });
    return res.status(200).json({ success: true, data: proposals });
  } catch (error) {
    errLog("sent:failed", { helperId: String(helperId || ""), message: error?.message, stack: error?.stack });
    return sendError(res, 500, "Unable to fetch sent proposals.", "FETCH_FAILED");
  }
}