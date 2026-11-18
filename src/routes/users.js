import { Router } from "express";
import { User } from "../models/index.js";
import { verifyJWT } from "../middleware/auth.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

const router = Router();

const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  image: u.image || "",
  phone: u.phone || "",
  role: u.role,
  isBlocked: !!u.isBlocked,
  createdAt: u.createdAt,
});

router.get("/me", verifyJWT, (req, res) => res.json({ success: true, data: publicUser(req.user) }));

// Only name / image / phone can be changed. role & isBlocked are never read from the body,
// and the target is always the authenticated user (no :id param => no editing other users).
router.patch(
  "/me",
  verifyJWT,
  asyncHandler(async (req, res) => {
    const { name, image, phone } = req.body;
    const update = {};
    if (name !== undefined) {
      if (!String(name).trim() || String(name).trim().length < 2) throw new ApiError(400, "Name must be at least 2 characters");
      update.name = String(name).trim();
    }
    if (image !== undefined) {
      if (image && !/^https?:\/\//.test(image)) throw new ApiError(400, "Image must be a valid URL");
      update.image = image;
    }
    if (phone !== undefined) {
      if (phone && !/^[+\d][\d\s-]{6,19}$/.test(String(phone))) throw new ApiError(400, "Please enter a valid phone number");
      update.phone = String(phone);
    }
    if (!Object.keys(update).length) throw new ApiError(400, "Nothing to update");
    update.updatedAt = new Date();
    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true, strict: false }).lean();
    res.json({ success: true, message: "Profile updated", data: publicUser(user) });
  })
);

export default router;
