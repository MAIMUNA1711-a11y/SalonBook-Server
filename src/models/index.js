import mongoose from "mongoose";
const { Schema } = mongoose;

// "users" collection is owned by Better Auth (client app). Here we only read it
// and update the permitted fields (name, image, phone, isBlocked for admins).
export const User =
  mongoose.models.User ||
  mongoose.model("User", new Schema({}, { strict: false, collection: "users" }));

const serviceSchema = new Schema({
  serviceName: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0.01 },
  duration: { type: Number, required: true, min: 1 },
  image: { type: String, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});
export const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema, "services");

const appointmentSchema = new Schema({
  serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  appointmentDate: { type: String, required: true }, // YYYY-MM-DD
  timeSlot: { type: String, required: true },
  message: { type: String, default: "", maxlength: 500 },
  servicePrice: { type: Number, required: true },
  paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
  status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});
export const Appointment =
  mongoose.models.Appointment || mongoose.model("Appointment", appointmentSchema, "appointments");

const transactionSchema = new Schema({
  appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  stripeSessionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["paid", "failed"], required: true },
  createdAt: { type: Date, default: Date.now },
});
export const Transaction =
  mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema, "transactions");
