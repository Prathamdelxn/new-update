import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import TemplateCategory from "@/models/TemplateCategory";
import { withAuth, withRole } from "@/lib/middleware";

/**
 * GET: Fetch all template categories
 */
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    const categories = await TemplateCategory.find({ organization: req.user.organizationId }).sort({ name: 1 });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching categories" },
      { status: 500 }
    );
  }
});

/**
 * POST: Create a new template category
 */
export const POST = withRole(async function (req) {
  try {
    await dbConnect();
    const { name } = await req.json();

    const existing = await TemplateCategory.findOne({ name, organization: req.user.organizationId });
    if (existing) {
      return NextResponse.json(
        { message: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const category = new TemplateCategory({
      name,
      organization: req.user.organizationId,
    });

    // Add audit entry
    category.auditTrail.push({
      user: req.user.id,
      userName: req.user.name || "Admin",
      userRole: req.user.role || "Admin",
      action: "Create",
      details: `Category ${name} initialized`,
    });

    await category.save();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json({ message: messages.join(", ") }, { status: 400 });
    }
    return NextResponse.json(
      { message: "Error creating category" },
      { status: 500 }
    );
  }
}, ["Admin"]);
