// Usage: npm run seed   -> inserts sample services (only if the collection is empty)
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { Service } from "../src/models/index.js";

const img = (t, c) => `https://placehold.co/800x600/${c}/ffffff?text=${encodeURIComponent(t)}`;
const samples = [
  ["Signature Haircut", "Haircut & Styling", "A tailored cut with consultation, shampoo and blow-dry finish.", 35, 45, "5b2a5e"],
  ["Blow-dry & Style", "Haircut & Styling", "Smooth, voluminous styling for everyday or special occasions.", 25, 30, "7a3e7d"],
  ["Full Color", "Hair Coloring", "Single-process color with premium products and gloss finish.", 80, 120, "b4536a"],
  ["Balayage Highlights", "Hair Coloring", "Hand-painted highlights for a soft, sun-kissed look.", 140, 180, "a2455c"],
  ["Keratin Smoothing", "Hair Treatment", "Frizz-control treatment that leaves hair smooth for weeks.", 110, 150, "3f6f62"],
  ["Deep Conditioning Spa", "Hair Treatment", "Intensive moisture mask with scalp massage.", 40, 40, "4f8577"],
  ["Hydrating Facial", "Facial & Skincare", "Deep cleanse, exfoliation and hydrating mask for glowing skin.", 60, 60, "8a5a83"],
  ["Bridal Makeup", "Makeup", "Long-lasting makeup with a trial-friendly consultation.", 120, 90, "c46a86"],
  ["Gel Manicure", "Manicure & Pedicure", "Shape, cuticle care and long-wear gel polish.", 30, 45, "6b4a8a"],
  ["Relaxing Body Massage", "Spa & Massage", "60-minute full-body massage to melt away tension.", 75, 60, "2f5d62"],
];

await connectDB();
if (await Service.countDocuments()) {
  console.log("Services already exist — skipping seed.");
} else {
  await Service.insertMany(samples.map(([serviceName, category, description, price, duration, c]) => ({ serviceName, category, description, price, duration, image: img(serviceName, c), status: "active" })));
  console.log(`✅ Seeded ${samples.length} services (replace placeholder images from the admin dashboard).`);
}
await mongoose.disconnect();
