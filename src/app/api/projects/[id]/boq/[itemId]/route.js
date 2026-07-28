import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Project from "@/models/Project";
import BOQ from "@/models/BOQ";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
import RiskEngine from "@/lib/riskEngine";

/**
 * PATCH /api/projects/:id/boq/:itemId
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id, itemId } = await params;
    await dbConnect();

    const updates = await req.json();
    const item = await BOQ.findOne({ _id: itemId, project: id });

    if (!item) {
      return NextResponse.json({ message: "BOQ item not found" }, { status: 404 });
    }

    // If item is in Draft or Rejected, update it in-place
    if (item.status === "Draft" || item.status === "Rejected") {
      const wasRejected = item.status === "Rejected";

      item.groupName = updates.groupName || item.groupName;
      item.itemNumber = updates.itemNumber !== undefined ? updates.itemNumber : item.itemNumber;
      item.itemDescription = updates.itemDescription || item.itemDescription;
      item.unit = updates.unit !== undefined ? updates.unit : item.unit;
      item.quantity = updates.quantity !== undefined ? Number(updates.quantity) : item.quantity;
      item.unitCost = updates.unitCost !== undefined ? Number(updates.unitCost) : item.unitCost;
      item.remark = updates.remark !== undefined ? updates.remark : item.remark;
      item.totalCost = (item.quantity || 0) * (item.unitCost || 0);

      // Reset to Draft and clear rejection data
      if (wasRejected) {
        item.status = "Draft";
        item.rejectionReason = undefined;
        item.approvedBy = undefined;
        item.approvedByName = undefined;
        item.approvedAt = undefined;
      }

      await item.save();

      const project = await Project.findById(id);
      if (project) {
        project.auditTrail.push({
          user: req.user.id,
          userName: req.user.name || "User",
          userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
          action: "Update",
          details: wasRejected
            ? `Re-drafted rejected BOQ item: ${item.itemNumber || item.itemDescription} (v${item.version})`
            : `Edited Draft BOQ item: ${item.itemNumber || item.itemDescription} (v${item.version})`,
        });
        await project.save();
      }

      return NextResponse.json(item);
    }

    // For Approved items — create a new version
    const oldVersion = item.version || 1;
    const historyId = item.historyId || item._id;

    // Mark old as not latest
    item.isLatest = false;
    await item.save();

    // Create new version
    const newBOQItem = new BOQ({
      project: id,
      groupName: updates.groupName || item.groupName,
      itemNumber: updates.itemNumber !== undefined ? updates.itemNumber : item.itemNumber,
      itemDescription: updates.itemDescription || item.itemDescription,
      unit: updates.unit !== undefined ? updates.unit : item.unit,
      quantity: updates.quantity !== undefined ? Number(updates.quantity) : item.quantity,
      unitCost: updates.unitCost !== undefined ? Number(updates.unitCost) : item.unitCost,
      remark: updates.remark !== undefined ? updates.remark : item.remark,
      version: oldVersion + 1,
      isLatest: true,
      historyId: historyId,
      createdBy: req.user.id,
      createdByName: req.user.name || "User",
      status: "Draft" // Reset status to Draft on update
    });

    newBOQItem.totalCost = (newBOQItem.quantity || 0) * (newBOQItem.unitCost || 0);
    await newBOQItem.save();

    const project = await Project.findById(id);
    if (project) {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
        action: "Update",
        details: `Updated BOQ item: ${newBOQItem.itemNumber || newBOQItem.itemDescription} (v${newBOQItem.version})`,
      });
      await project.save();
    }

    // Evaluate for Financial Risk (>10% cost increase)
    const oldCost = item.totalCost || 0;
    const newCost = newBOQItem.totalCost || 0;
    if (oldCost > 0 && newCost > (oldCost * 1.10)) {
      const percentageIncrease = (((newCost - oldCost) / oldCost) * 100).toFixed(1);
      await RiskEngine.evaluateAndCreateRisk({
        projectId: id,
        organizationId: req.user.organizationId,
        user: req.user,
        sourceType: 'BOQ',
        sourceId: newBOQItem.historyId,
        sourceName: newBOQItem.itemDescription,
        title: `Cost Escalation Risk: ${newBOQItem.itemDescription}`,
        category: 'Financial',
        description: `Auto-generated risk: BOQ item ${newBOQItem.itemNumber || newBOQItem.itemDescription} cost increased by ${percentageIncrease}% (from ${oldCost} to ${newCost}).`,
        impact: 'High',
        probability: 'High'
      }).catch(err => console.error("Risk auto-gen failed for BOQ:", err));
    }

    // emitToProject(id, 'boq:updated');
    return NextResponse.json(newBOQItem);
  } catch (error) {
    console.error("BOQ update error:", error);
    return NextResponse.json({ message: "Error updating BOQ" }, { status: 500 });
  }
});

/**
 * DELETE /api/projects/:id/boq/:itemId
 */
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id, itemId } = await params;
    console.log("[DELETE BOQ Item] Params received by Next.js:", { id, itemId });
    await dbConnect();

    const item = await BOQ.findOneAndDelete({ _id: itemId, project: id });
    if (!item) {
      console.log("[DELETE BOQ Item] Item not found in DB for query:", { _id: itemId, project: id });
      return NextResponse.json({ message: "BOQ item not found" }, { status: 404 });
    }

    const project = await Project.findById(id);
    if (project) {
      project.auditTrail.push({
        user: req.user.id,
        userName: req.user.name || "User",
        userRole: req.user.role === "Admin" ? "Admin" : (req.user.role?.name || "Member"),
        action: "Update",
        details: `Deleted BOQ item: ${item.itemNumber || item.itemDescription}`,
      });
      await project.save();
    }

    emitToProject(id, 'boq:updated');
    return NextResponse.json({ message: "BOQ item deleted" });
  } catch (error) {
    console.error("BOQ delete error:", error);
    return NextResponse.json({ message: "Error deleting BOQ" }, { status: 500 });
  }
});
