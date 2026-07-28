require("dotenv").config({ path: ".env.local" });
const mongoose = require("mongoose");

async function clearAttendance() {
  try {
    console.log("Connecting to MongoDB:", process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");
    const db = mongoose.connection;
    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const result = await db.collection("attendances").deleteMany({ attendanceDate: today });
    console.log(`Deleted ${result.deletedCount} attendance records for ${today}.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearAttendance();
