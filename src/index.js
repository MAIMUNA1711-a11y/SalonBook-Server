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

const defaultOrigins = [
  "http://localhost:3000",
  "https://salon-book-client-ruddy.vercel.app",
  "https://salon-book-client-git-main-m-ccf1.vercel.app",
];

const envOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const isOriginAllowed = (origin) => {
  if (!origin) return true; // server-to-server / Postman / curl
  const cleanOrigin = origin.trim().replace(/\/$/, "");
  if (allowedOrigins.includes(cleanOrigin)) return true;

  // Allow any Vercel deployment URL for this project if needed
  try {
    const parsed = new URL(cleanOrigin);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".vercel.app") &&
      parsed.hostname.startsWith("salon-book-client")
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Extra safety guard so disallowed origins get a clean 403 without noisy error stack traces
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    return res.status(403).json({
      success: false,
      message: `Origin not allowed by CORS: ${origin}`,
    });
  }
  next();
});

// Stripe webhook needs the RAW body to verify the signature -> must be before express.json()
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    await connectDB();
    return webhookHandler(req, res);
  } catch (e) {
    next(e);
  }
});

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => res.json({ success: true, message: "SalonBook API is running" }));
app.get("/api/health", (_req, res) => res.json({ success: true, status: "ok" }));

// Ensure DB is connected (works for serverless cold starts too)
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    next(e);
  }
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
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`SalonBook API running on http://localhost:${port}`));
}

export default app;