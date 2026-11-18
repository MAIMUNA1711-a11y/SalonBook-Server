// Usage: npm run make-admin -- admin@example.com
// 1) Sign up normally on the website with this email  2) run this script to promote it to admin.
import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/index.js";
import mongoose from "mongoose";

const email = process.argv[2];
if (!email) { console.error("Usage: npm run make-admin -- <email>"); process.exit(1); }
await connectDB();
const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { $set: { role: "admin", isBlocked: false } }, { new: true, strict: false });
console.log(user ? `✅ ${email} is now an admin` : `❌ No user found with email ${email}. Sign up on the website first.`);
await mongoose.disconnect();
