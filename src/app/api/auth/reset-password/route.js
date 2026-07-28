import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json({ message: "Email, OTP, and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });
    }

    await dbConnect();

    // 1. Find user by email and otp
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      resetPasswordOtp: String(otp),
      resetPasswordExpires: { $gt: Date.now() } // Ensure OTP hasn't expired
    });

    if (!user) {
      return NextResponse.json({ message: "Invalid or expired OTP" }, { status: 400 });
    }

    // 2. Update password
    user.password = newPassword;
    
    // 3. Clear OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;

    // 4. Save user (pre-save hook will hash the new password)
    await user.save();

    return NextResponse.json({ message: "Password has been successfully reset" }, { status: 200 });

  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: "An error occurred while resetting password" }, { status: 500 });
  }
}
