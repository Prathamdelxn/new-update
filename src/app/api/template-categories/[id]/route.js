import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import TemplateCategory from "@/models/TemplateCategory";
import Template from "@/models/Template";
import { withRole } from "@/lib/middleware";

/**
 * PATCH: Update template category
 */
export const PATCH = withRole(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const updates = await req.json();

    const category = await TemplateCategory.findOne({ _id: id, organization: req.user.organizationId });
    if (!category) {
      return NextResponse.json({ message: "Category not found" }, { status: 404 });
    }

    // Apply updates (only name is left)
    if (updates.name) category.name = updates.name;

    // Add audit entry
    category.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: "Update",
      details: "Category details updated",
    });

    await category.save();
    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json(
      { message: "Error updating category" },
      { status: 500 }
    );
  }
}, ["Admin"]);

/**
 * DELETE: Remove template category
 */
export const DELETE = withRole(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    const category = await TemplateCategory.findOne({ _id: id, organization: req.user.organizationId });
    if (!category) {
      return NextResponse.json({ message: "Category not found" }, { status: 404 });
    }

    await TemplateCategory.findByIdAndDelete(id);
    await Template.deleteMany({ category: id, organization: req.user.organizationId });

    return NextResponse.json({ message: "Category and associated templates removed successfully" });
  } catch (error) {
    return NextResponse.json(
      { message: "Error removing category" },
      { status: 500 }
    );
  }
}, ["Admin"]);
