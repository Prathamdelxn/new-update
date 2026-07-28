import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import BOQ from "@/models/BOQ";
import mongoose from "mongoose";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

/**
 * GET /api/projects/:id/boq
 * 
 * Fetches all BOQ items for a specific project.
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    console.log("asdf");
    await dbConnect();

    const items = await BOQ.find({ project: id, isLatest: { $ne: false } }).sort({ createdAt: 1 }).lean();

    const historyIds = items.filter(item => item.version > 1 && item.status !== "Approved").map(i => i.historyId);
    let approvedCosts = {};
    
    if (historyIds.length > 0) {
      const approvedItems = await BOQ.find({
        project: id,
        historyId: { $in: historyIds },
        status: "Approved"
      }).sort({ version: -1 }).lean();
      
      for (const item of approvedItems) {
        if (approvedCosts[item.historyId] === undefined) {
          approvedCosts[item.historyId] = item.totalCost;
        }
      }
    }
    
    const finalItems = items.map(item => {
      let effectiveCost = item.totalCost;
      if (item.version > 1 && item.status !== "Approved") {
        effectiveCost = approvedCosts[item.historyId] !== undefined ? approvedCosts[item.historyId] : item.totalCost;
      }
      return { ...item, effectiveTotalCost: effectiveCost };
    });

    return NextResponse.json(finalItems);
  } catch (error) {
    return NextResponse.json({ message: "Error fetching BOQ" }, { status: 500 });
  }
});

/**
 * POST /api/projects/:id/boq
 * 
 * Adds one or more items to the project's Bill of Quantities.
 */
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const { items } = await req.json(); // Expecting an array of items or a single item

    const project = await Project.findOne({
      _id: id,
      organization: req.user.organizationId
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const itemsArray = Array.isArray(items) ? items : [items];
    const boqData = itemsArray.map(item => {
      const _id = new mongoose.Types.ObjectId();
      return {
        ...item,
        _id,
        project: id,
        historyId: _id, // For version 1, historyId matches original _id
        version: 1,
        isLatest: true,
        createdBy: req.user.id,
        createdByName: req.user.name || "User",
        totalCost: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
      };
    });

    const result = await BOQ.insertMany(boqData);

    project.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "User",
      userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
      action: "Update",
      details: `Added ${result.length} items to BOQ`,
    });

    await project.save();
    emitToProject(id, 'boq:updated', { count: result.length });

    return NextResponse.json(result);
  } catch (error) {
    console.error("BOQ add error:", error);
    return NextResponse.json(
      { message: "Error adding BOQ items" },
      { status: 500 }
    );
  }
});
