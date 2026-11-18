import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { ApiError, asyncHandler } from "../utils/helpers.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new ApiError(400, "Only PNG, JPG, WEBP or GIF images are allowed")),
});

// Public on purpose (sign-up needs a profile image before an account exists) but rate-limited.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many uploads. Please try again later." } });

router.post(
  "/",
  limiter,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No image file provided");
    if (!process.env.IMGBB_API_KEY) throw new ApiError(500, "Image hosting is not configured");

    const form = new FormData();
    form.append("image", req.file.buffer.toString("base64"));
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, { method: "POST", body: form });
    const json = await r.json().catch(() => ({}));
    if (!r.ok || !json?.data?.url) throw new ApiError(502, "Image upload failed. Please try again.");
    res.json({ success: true, data: { url: json.data.url } });
  })
);

export default router;
