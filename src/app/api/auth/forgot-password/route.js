import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/emailTemplates";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    await dbConnect();

    // 1. Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Return 200 even if user not found to prevent email enumeration attacks
      return NextResponse.json({ message: "If that email is registered, we have sent an OTP to it." }, { status: 200 });
    }

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Save OTP and expiration (10 minutes from now)
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 4. Send email
    await sendEmail({
      to: user.email,
      subject: "Your Password Reset OTP - Skystruct App",
      html: otpEmail({ name: user.name, otp }),
    });

    return NextResponse.json({ message: "If that email is registered, we have sent an OTP to it." }, { status: 200 });

  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: "An error occurred during the request" }, { status: 500 });
  }
}
