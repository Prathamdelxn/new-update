import mongoose from "mongoose";
import dns from "dns";

// DNS Fix for SRV resolution
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  console.log("📡 DNS configured for SRV");
} catch (e) {
  console.warn("⚠️ Default DNS used");
}
dns.setDefaultResultOrder("ipv4first");

const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI not defined in .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect(retryCount = 0) {
  try {
    if (cached.conn) {
      console.log("♻️ Using cached MongoDB connection");
      return cached.conn;
    }

    if (!cached.promise) {
      console.log(`🔄 Connecting to MongoDB (${retryCount + 1}/${MAX_RETRIES})...`);
      const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ":****@");
      console.log(`📍 URI: ${maskedUri}`);

      cached.promise = mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
      }).then((mongoose) => {
        console.log("✅ MongoDB connected successfully");
        console.log("📂 Database Name:", mongoose.connection.name);
        return mongoose;
      });
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error("❌ MongoDB connection error:", error.message);

    if (retryCount < MAX_RETRIES - 1) {
      console.log(`⏳ Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(res => setTimeout(res, RETRY_DELAY));
      return dbConnect(retryCount + 1);
    }

    throw error;
  }
}

export default dbConnect;