import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Role from "@/models/Role";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";

export async function POST(req) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ message: "Refresh token is required" }, { status: 400 });
    }

    // Verify token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json({ message: "Invalid or expired refresh token" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(decoded.id).populate("role");

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Generate new Access Token
    const accessToken = generateAccessToken(user);

    return NextResponse.json({
      token: accessToken,
    });
  } catch (error) {
    return NextResponse.json({ message: "Error refreshing token" }, { status: 500 });
  }
}
