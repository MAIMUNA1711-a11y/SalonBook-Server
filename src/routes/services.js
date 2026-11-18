import { Router } from "express";
import { Service, Appointment } from "../models/index.js";
import { verifyJWT, requireAdmin } from "../middleware/auth.js";
import { ApiError, asyncHandler, isValidId, CATEGORIES, escapeRegex } from "../utils/helpers.js";

const router = Router();

function validateServiceBody(b, partial = false) {
  const out = {};
  const need = (k) => !partial || b[k] !== undefined;
  if (need("serviceName")) {
    if (!b.serviceName || !String(b.serviceName).trim()) throw new ApiError(400, "Service name is required");
    out.serviceName = String(b.serviceName).trim();
  }
  if (need("category")) {
    if (!CATEGORIES.includes(b.category)) throw new ApiError(400, "Please choose a valid category");
    out.category = b.category;
  }
  if (need("description")) {
    if (!b.description || !String(b.description).trim()) throw new ApiError(400, "Description is required");
    out.description = String(b.description).trim();
  }
  if (need("price")) {
    const p = Number(b.price);
    if (!Number.isFinite(p) || p <= 0) throw new ApiError(400, "Price must be a positive number");
    out.price = p;
  }
  if (need("duration")) {
    const d = Number(b.duration);
    if (!Number.isFinite(d) || d <= 0) throw new ApiError(400, "Duration must be a positive number");
    out.duration = d;
  }
  if (need("image")) {
    if (!b.image || !/^https?:\/\//.test(b.image)) throw new ApiError(400, "Service image is required");
    out.image = b.image;
  }
  if (b.status !== undefined) {
    if (!["active", "inactive"].includes(b.status)) throw new ApiError(400, "Invalid status");
    out.status = b.status;
  }
  return out;
}

// Public: active services with search / category filter / price sorting
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, category, sort, limit } = req.query;
    const filter = { status: "active" };
    if (search) filter.serviceName = { $regex: escapeRegex(String(search)), $options: "i" };
    if (category && category !== "all") filter.category = String(category);
    let sortObj = { createdAt: -1 };
    if (sort === "price_asc") sortObj = { price: 1 };
    if (sort === "price_desc") sortObj = { price: -1 };
    let q = Service.find(filter).sort(sortObj);
    if (limit) q = q.limit(Math.min(Number(limit) || 0, 100));
    res.json({ success: true, data: await q.lean() });
  })
);

// Public: categories with counts of active services
router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const counts = await Service.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    res.json({ success: true, data: CATEGORIES.map((name) => ({ name, count: map[name] || 0 })) });
  })
);

// Admin: all services (active + inactive)
router.get(
  "/admin/all",
  verifyJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.search) filter.serviceName = { $regex: escapeRegex(String(req.query.search)), $options: "i" };
    res.json({ success: true, data: await Service.find(filter).sort({ createdAt: -1 }).lean() });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid service ID");
    const service = await Service.findById(req.params.id).lean();
    if (!service) throw new ApiError(404, "Service not found");
    res.json({ success: true, data: service });
  })
);

router.post(
  "/",
  verifyJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = validateServiceBody(req.body);
    const service = await Service.create(data);
    res.status(201).json({ success: true, message: "Service created", data: service });
  })
);

router.put(
  "/:id",
  verifyJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid service ID");
    const data = validateServiceBody(req.body, true);
    const service = await Service.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!service) throw new ApiError(404, "Service not found");
    res.json({ success: true, message: "Service updated", data: service });
  })
);

router.patch(
  "/:id/status",
  verifyJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid service ID");
    if (!["active", "inactive"].includes(req.body.status)) throw new ApiError(400, "Invalid status");
    const service = await Service.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!service) throw new ApiError(404, "Service not found");
    res.json({ success: true, message: `Service ${service.status === "active" ? "activated" : "deactivated"}`, data: service });
  })
);

router.delete(
  "/:id",
  verifyJWT,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid service ID");
    const active = await Appointment.exists({ serviceId: req.params.id, status: { $in: ["pending", "confirmed"] } });
    if (active) throw new ApiError(409, "This service has active appointments. Deactivate it instead of deleting.");
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) throw new ApiError(404, "Service not found");
    res.json({ success: true, message: "Service deleted" });
  })
);

export default router;
