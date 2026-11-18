import { Router } from "express";
import { User, Service, Appointment, Transaction } from "../models/index.js";
import { verifyJWT, requireAdmin } from "../middleware/auth.js";
import { ApiError, asyncHandler, isValidId } from "../utils/helpers.js";

const router = Router();
router.use(verifyJWT, requireAdmin);

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [customers, activeServices, total, pending, confirmed, payments] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      Service.countDocuments({ status: "active" }),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: "pending" }),
      Appointment.countDocuments({ status: "confirmed" }),
      Transaction.countDocuments({ status: "paid" }),
    ]);
    res.json({ success: true, data: { customers, activeServices, total, pending, confirmed, payments } });
  })
);

// ---------- Appointments ----------
router.get(
  "/appointments",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (["pending", "confirmed", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
    const data = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .populate("customerId", "name email image phone")
      .populate("serviceId", "serviceName image category price duration")
      .lean();
    res.json({ success: true, data });
  })
);

router.patch(
  "/appointments/:id/confirm",
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid appointment ID");
    const appt = await Appointment.findById(req.params.id);
    if (!appt) throw new ApiError(404, "Appointment not found");
    if (appt.status !== "pending") throw new ApiError(400, "Only pending appointments can be confirmed");
    appt.status = "confirmed";
    await appt.save();
    res.json({ success: true, message: "Appointment confirmed", data: appt });
  })
);

router.patch(
  "/appointments/:id/cancel",
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid appointment ID");
    const appt = await Appointment.findById(req.params.id);
    if (!appt) throw new ApiError(404, "Appointment not found");
    if (!["pending", "confirmed"].includes(appt.status)) throw new ApiError(400, "Only pending or confirmed appointments can be cancelled");
    appt.status = "cancelled";
    await appt.save();
    res.json({ success: true, message: "Appointment cancelled", data: appt });
  })
);

// ---------- Users ----------
const userFields = "name email image phone role isBlocked createdAt";

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const data = await User.find({ role: "customer" }).select(userFields).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data });
  })
);

router.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid user ID");
    const user = await User.findById(req.params.id).select(userFields).lean();
    if (!user) throw new ApiError(404, "User not found");
    const [total, paid] = await Promise.all([
      Appointment.countDocuments({ customerId: user._id }),
      Appointment.countDocuments({ customerId: user._id, paymentStatus: "paid" }),
    ]);
    res.json({ success: true, data: { ...user, totalAppointments: total, paidAppointments: paid } });
  })
);

const setBlocked = (blocked) =>
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid user ID");
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found");
    if (user.get("role") === "admin") throw new ApiError(400, "Admin accounts cannot be blocked");
    user.set("isBlocked", blocked);
    await user.save();
    res.json({ success: true, message: blocked ? "User blocked" : "User unblocked" });
  });
router.patch("/users/:id/block", setBlocked(true));
router.patch("/users/:id/unblock", setBlocked(false));

// ---------- Transactions (read-only: admins cannot edit payment records) ----------
router.get(
  "/transactions",
  asyncHandler(async (_req, res) => {
    const data = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate("customerId", "name email")
      .populate({ path: "appointmentId", select: "appointmentDate timeSlot serviceId", populate: { path: "serviceId", select: "serviceName" } })
      .lean();
    res.json({ success: true, data });
  })
);

export default router;
