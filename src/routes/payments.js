import { Router } from "express";
import Stripe from "stripe";
import { Appointment, Transaction } from "../models/index.js";
import { verifyJWT, requireCustomer } from "../middleware/auth.js";
import { ApiError, asyncHandler, isValidId } from "../utils/helpers.js";

const router = Router();
const stripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);
const clientUrl = () => (process.env.CLIENT_URL || "").replace(/\/$/, "");

// Create a Stripe Checkout session for a CONFIRMED + UNPAID appointment owned by the caller.
// The amount always comes from the database, never from the client.
router.post(
  "/checkout",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const { appointmentId } = req.body;
    if (!isValidId(appointmentId)) throw new ApiError(400, "Invalid appointment ID");
    const appt = await Appointment.findById(appointmentId).populate("serviceId", "serviceName image");
    if (!appt || String(appt.customerId) !== req.user.id) throw new ApiError(404, "Appointment not found");
    if (appt.status !== "confirmed") throw new ApiError(400, "You can only pay for confirmed appointments");
    if (appt.paymentStatus === "paid") throw new ApiError(400, "This appointment is already paid");

    const currency = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round(appt.servicePrice * 100),
            product_data: {
              name: appt.serviceId?.serviceName || "Salon service",
              description: `Appointment on ${appt.appointmentDate} at ${appt.timeSlot}`,
            },
          },
        },
      ],
      metadata: { appointmentId: String(appt._id), customerId: req.user.id },
      success_url: `${clientUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl()}/payment/cancel?appointment_id=${appt._id}`,
    });
    res.json({ success: true, data: { url: session.url } });
  })
);

// Read-only status for the success page. This NEVER updates payment status;
// only the verified webhook below does.
router.get(
  "/session/:sessionId",
  verifyJWT,
  requireCustomer,
  asyncHandler(async (req, res) => {
    const tx = await Transaction.findOne({ stripeSessionId: req.params.sessionId, customerId: req.user.id })
      .populate({ path: "appointmentId", select: "appointmentDate timeSlot paymentStatus serviceId", populate: { path: "serviceId", select: "serviceName" } })
      .lean();
    if (!tx) return res.json({ success: true, data: { status: "processing" } });
    res.json({ success: true, data: { status: tx.status, transaction: tx } });
  })
);

// ---------- Webhook (mounted in index.js with express.raw BEFORE express.json) ----------
export const webhookHandler = async (req, res) => {
  let event;
  try {
    event = stripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const session = event.data.object;
    const appointmentId = session?.metadata?.appointmentId;
    const customerId = session?.metadata?.customerId;

    if (appointmentId && customerId) {
      const base = {
        appointmentId,
        customerId,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        stripeSessionId: session.id,
      };

      if (
        (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
        session.payment_status === "paid"
      ) {
        await Transaction.findOneAndUpdate(
          { stripeSessionId: session.id },
          { $set: { ...base, status: "paid" }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        await Appointment.findByIdAndUpdate(appointmentId, { paymentStatus: "paid" });
      } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        // Never downgrade a successful payment
        await Transaction.findOneAndUpdate(
          { stripeSessionId: session.id },
          { $setOnInsert: { ...base, status: "failed", createdAt: new Date() } },
          { upsert: true }
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ received: false });
  }
};

export default router;

// verified
