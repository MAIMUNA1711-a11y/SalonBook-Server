import { Router } from "express";
import { Appointment, Service } from "../models/index.js";
import { verifyJWT, requireCustomer } from "../middleware/auth.js";
import { ApiError, asyncHandler, isValidId, TIME_SLOTS } from "../utils/helpers.js";

const router = Router();
const ACTIVE = ["pending", "confirmed"];

const populate = (q) =>
  q.populate("serviceId", "serviceName image category price duration status");

// Slot availability for a service on a date (any logged-in user)
router.get(
  "/slots",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const { serviceId, date } = req.query;
    if (!isValidId(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new ApiError(400, "serviceId and date (YYYY-MM-DD) are required");
    const booked = await Appointment.find({ serviceId, appointmentDate: date, status: { $in: ACTIVE } }).select("timeSlot").lean();
    const taken = new Set(booked.map((b) => b.timeSlot));
    res.json({ success: true, data: TIME_SLOTS.map((time) => ({ time, available: !taken.has(time) })) });
  })
);

router.post(
  "/",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { serviceId, appointmentDate, timeSlot, message } = req.body;
    if (!isValidId(serviceId)) throw new ApiError(400, "Invalid service ID");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || "")) throw new ApiError(400, "Please choose a valid date");
    if (!TIME_SLOTS.includes(timeSlot)) throw new ApiError(400, "Please choose a valid time slot");

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (appointmentDate < yesterday) throw new ApiError(400, "Appointment date cannot be in the past");

    const service = await Service.findById(serviceId);
    if (!service) throw new ApiError(404, "Service not found");
    if (service.status !== "active") throw new ApiError(400, "This service is currently unavailable for booking");

    // Slot conflict: another active appointment for same service/date/slot,
    // or this customer already has an active appointment at that date/slot
    const conflict = await Appointment.findOne({
      appointmentDate,
      timeSlot,
      status: { $in: ACTIVE },
      $or: [{ serviceId }, { customerId: req.user.id }],
    });
    if (conflict) throw new ApiError(409, "This time slot is already booked. Please choose another one.");

    const appt = await Appointment.create({
      serviceId,
      customerId: req.user.id,
      appointmentDate,
      timeSlot,
      message: (message || "").toString().slice(0, 500),
      servicePrice: service.price,
    });
    res.status(201).json({ success: true, message: "Appointment request submitted", data: appt });
  })
);

router.get(
  "/my",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const data = await populate(Appointment.find({ customerId: req.user.id }).sort({ createdAt: -1 })).lean();
    res.json({ success: true, data });
  })
);

router.get(
  "/my/stats",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const rows = await Appointment.aggregate([
      { $match: { customerId: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const c = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const pending = c.pending || 0, confirmed = c.confirmed || 0, cancelled = c.cancelled || 0;
    res.json({ success: true, data: { total: pending + confirmed + cancelled, pending, confirmed, cancelled } });
  })
);

router.get(
  "/:id",
  verifyJWT,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid appointment ID");
    const appt = await populate(Appointment.findById(req.params.id)).lean();
    if (!appt) throw new ApiError(404, "Appointment not found");
    if (req.user.role !== "admin" && String(appt.customerId) !== req.user.id) throw new ApiError(403, "You can only view your own appointments");
    res.json({ success: true, data: appt });
  })
);

router.patch(
  "/:id/cancel",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid appointment ID");
    const appt = await Appointment.findById(req.params.id);
    if (!appt || String(appt.customerId) !== req.user.id) throw new ApiError(404, "Appointment not found");
    if (appt.status !== "pending") throw new ApiError(400, "Only pending appointment requests can be cancelled");
    appt.status = "cancelled";
    await appt.save();
    res.json({ success: true, message: "Appointment request cancelled", data: appt });
  })
);

export default router;
