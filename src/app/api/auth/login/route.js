import { NextResponse } from "next/server"; // touch to trigger rebuild
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role"; // Ensure Role schema is registered for population
import { generateAccessToken, generateRefreshToken } from "@/lib/auth";

export async function POST(req) {
  try {
    await dbConnect();
    const { email, password } = await req.json();
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password").populate("role");

    if (!user) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update last login and record audit (updateOne avoids full-document validation)
    await User.updateOne(
      { _id: user._id },
      {
        $set: { lastLogin: new Date() },
        $push: {
          auditTrail: {
            user: user._id,
            userName: user.name,
            userRole: user.role?.name || "User",
            action: "Login",
            details: "User logged in successfully",
          },
        },
      }
    );

    return NextResponse.json(
      {
        message: "Login successful",
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organization?.toString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Error during login" },
      { status: 500 }
    );
  }
}
