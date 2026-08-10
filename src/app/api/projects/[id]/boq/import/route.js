import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BOQ from "@/models/BOQ";
import Project from "@/models/Project";
import { withPermission } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import mongoose from "mongoose";
import * as XLSX from "xlsx";

/**
 * POST /api/projects/:id/boq/import
 * Handles Excel/CSV parsing and importing.
 */
export const POST = withPermission(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const formData = await req.formData();
    const file = formData.get("file");
    const action = formData.get("action"); // "preview" or "confirm"

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse the Excel/CSV file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Map raw data to BOQ schema based on exact Excel columns:
    // Group Name, Item Number, Item Description, Unit, Quantity, Unit Cost, Remark
    const mappedItems = rawData.map((row) => {
      const quantity = Number(row["Quantity"] || 0);
      const unitCost = Number(row["Unit Cost"] || 0);
      const _id = new mongoose.Types.ObjectId();
      
      return {
        _id,
        project: id,
        groupName: row["Group Name"] || "General",
        itemNumber: String(row["Item Number"] || ""),
        itemDescription: row["Item Description"] || "No description",
        unit: row["Unit"] || "",
        quantity: quantity,
        unitCost: unitCost,
        totalCost: quantity * unitCost,
        remark: row["Remark"] || "",
        version: 1,
        isLatest: true,
        historyId: _id,
        createdBy: req.user.id,
        createdByName: req.user.name || "User"
      };
    });

    if (action === "preview") {
      return NextResponse.json({ 
        preview: mappedItems,
        totalItems: mappedItems.length,
        estimatedTotal: mappedItems.reduce((sum, item) => sum + item.totalCost, 0)
      });
    }

    if (action === "confirm") {
      // Perform batch insert
      const insertedItems = await BOQ.insertMany(mappedItems);

      // Add to audit trail
      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
          action: "Update",
          details: `Imported ${insertedItems.length} BOQ items via Excel`,
        });
        await project.save();
      }

      emitToProject(id, 'boq:updated');
      return NextResponse.json({
        message: "Import successful",
        count: insertedItems.length
      });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("BOQ Import error:", error);
    return NextResponse.json({ message: "Error processing import" }, { status: 500 });
  }
}, "boq:create");
