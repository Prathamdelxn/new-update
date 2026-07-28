import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Labour from "@/models/Labour";
import { withAuth } from "@/lib/middleware";
import mongoose from "mongoose";

export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ message: "projectId is required" }, { status: 400 });
    }

    const query = {
      organization: req.user.organizationId,
      project: projectId,
    };

    const labourers = await Labour.find(query).sort({ createdAt: -1 });

    return NextResponse.json(labourers);
  } catch (error) {
    console.error("GET /api/labour error:", error);
    return NextResponse.json({ message: "Error fetching labourers" }, { status: 500 });
  }
});

export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const { name, project, type, paymentCycle, wageAmount } = await req.json();

    if (!name || !project || !type || !paymentCycle || wageAmount === undefined) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const labour = new Labour({
      organization: req.user.organizationId,
      project,
      name,
      type,
      paymentCycle,
      wageAmount: Number(wageAmount),
      status: "Active"
    });

    await labour.save();

    return NextResponse.json(labour, { status: 201 });
  } catch (error) {
    console.error("POST /api/labour error:", error);
    return NextResponse.json({ message: "Error creating labour" }, { status: 500 });
  }
});
