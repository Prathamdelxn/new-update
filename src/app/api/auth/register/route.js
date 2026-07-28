import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import OtpRegistration from "@/models/OtpRegistration";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/emailTemplates";

export async function POST(req) {
  try {
    await dbConnect();
    const { name, email, password, phoneNumber } = await req.json();

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password before storing — never persist plaintext credentials
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in OtpRegistration (upsert to handle if they try again)
    await OtpRegistration.findOneAndUpdate(
      { email },
      { name, email, password: hashedPassword, phoneNumber, otp, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Development fallback so user isn't stuck if Gmail limit is exceeded
    console.log(`[DEV] Registration OTP for ${email}: ${otp}`);

    // Send email
    await sendEmail({
      to: email,
      subject: "Your Registration OTP - Skystruct App",
      html: otpEmail({ name, otp }),
    });

    return NextResponse.json(
      {
        message: "OTP sent successfully to email",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Registration initiation error:", error);
    return NextResponse.json(
      { message: "Error initiating registration" },
      { status: 500 }
    );
  }
}
