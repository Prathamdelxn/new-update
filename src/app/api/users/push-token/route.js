import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { withAuth } from "@/lib/middleware";

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ message: "Token is required" }, { status: 400 });
    }

    // Add token to user's pushTokens array if it's not already there
    await User.updateOne(
      { _id: req.user.id },
      { $addToSet: { pushTokens: token } }
    );

    return NextResponse.json({ success: true, message: "Push token registered" });
  } catch (error) {
    console.error("Error registering push token:", error);
    return NextResponse.json({ message: "Error registering push token" }, { status: 500 });
  }
});
