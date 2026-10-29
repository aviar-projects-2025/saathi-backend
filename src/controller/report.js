import { createReportService } from "../service/report.js";
import { emitNotification } from "../../socket.js"; 
import { buildNotification, createNotificationService } from "../service/notification.js";

export const createReport = async (req, res) => {
  try {
    const reporterId = req.user?.userId || req.user?.id;
    if (!reporterId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { rideId, reportedUserId, reason, details } = req.body;

    if (!rideId || !reportedUserId || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const report = await createReportService({
      rideId,
      reporterId,
      reportedUserId,
      reason,
      details,
    });

    // Optional: Notify Admins or the reported user (if your app requires it)
    // You can also trigger an automated suspension here if they hit 3 reports.

    res.status(201).json({ success: true, message: "Report submitted successfully", data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};