import Report from "../model/report.js";

export const createReportService = async (data) => {
  const { rideId, reporterId, reportedUserId, reason, details } = data;

  // Prevent duplicate reports for the same ride to avoid spam
  const existingReport = await Report.findOne({ rideId, reporterId, reportedUserId });
  if (existingReport) {
    throw new Error("You have already reported this user for this ride");
  }

  return await Report.create({
    rideId,
    reporterId,
    reportedUserId,
    reason,
    details,
  });
};