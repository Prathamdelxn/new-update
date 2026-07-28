import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    
    // Find the user from the token info attached by withAuth
    const user = await User.findById(req.user.id);
    
    if (user) {
      // Record logout in audit trail
      user.auditTrail.push({
        user: user._id,
        userName: user.name,
        userRole: req.user.role || "User",
        action: "Update",
        details: "User logged out successfully",
        timestamp: new Date()
      });
      await user.save();
    }

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { message: "Error during logout" },
      { status: 500 }
    );
  }
});
