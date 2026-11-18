import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.js";
import servicesRoutes from "./routes/services.js";
import appointmentRoutes from "./routes/appointments.js";
import paymentRoutes, { webhookHandler } from "./routes/payments.js";
import userRoutes from "./routes/users.js";
import adminRoutes from "./routes/admin.js";
import uploadRoutes from "./routes/upload.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());

const allowed = (process.env.CLIENT_URL || "http://localhost:3000").split(",").map((s) => s.trim().replace(/\/$/, ""));
app.use(
  cors({
    origin: (origin, cb) => (!origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"))),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Stripe webhook needs the RAW body to verify the signature -> must be before express.json()
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  try { await connectDB(); webhookHandler(req, res); } catch (e) { next(e); }
});

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => res.json({ success: true, message: "SalonBook API is running" }));
app.get("/api/health", (_req, res) => res.json({ success: true, status: "ok" }));

// Ensure DB is connected (works for serverless cold starts too)
app.use(async (_req, _res, next) => {
  try { await connectDB(); next(); } catch (e) { next(e); }
});

app.use("/api/services", servicesRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
if (!process.env.VERCEL) app.listen(port, () => console.log(`SalonBook API running on http://localhost:${port}`));

export default app;
