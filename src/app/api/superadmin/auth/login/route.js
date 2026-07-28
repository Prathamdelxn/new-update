import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import SuperAdmin from "@/models/SuperAdmin";
import { generateSuperAdminToken } from "@/lib/auth";

export async function POST(req) {
  try {
    await dbConnect();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase() }).select("+password");
    if (!superAdmin) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await superAdmin.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Generate token with isSuperAdmin flag
    const token = generateSuperAdminToken(superAdmin);

    // Update last login
    await SuperAdmin.updateOne({ _id: superAdmin._id }, { $set: { lastLogin: new Date() } });

    const response = NextResponse.json(
      {
        message: "Login successful",
        superAdmin: { id: superAdmin._id, name: superAdmin.name, email: superAdmin.email },
        saToken: token,
      },
      { status: 200 }
    );

    // Set httpOnly cookie
    response.cookies.set("sa_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("SuperAdmin login error:", error);
    return NextResponse.json({ message: "Login error" }, { status: 500 });
  }
}
