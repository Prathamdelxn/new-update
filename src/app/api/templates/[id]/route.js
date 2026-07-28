import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Template from "@/models/Template";
import { withAuth } from "@/lib/middleware";

/**
 * GET: Fetch a single project template
 */
export const GET = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const template = await Template.findOne({ _id: id, organization: req.user.organizationId })
      .populate("category", "name")
      .populate("createdBy", "name email");

    if (!template) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Fetch template error:", error);
    return NextResponse.json(
      { message: "Error fetching template" },
      { status: 500 }
    );
  }
});

/**
 * PATCH: Update a project template
 */
export const PATCH = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const data = await req.json();

    const userId = req.user.id;
    const userName = req.user.name || "User";

    const updateData = {
      ...data,
      $push: {
        auditTrail: {
          user: userId,
          userName: userName,
          userRole: req.user.role || "User",
          action: "Update",
          details: `Template updated by ${userName}`,
        },
      },
    };

    const updatedTemplate = await Template.findOneAndUpdate(
      { _id: id, organization: req.user.organizationId },
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).populate("category", "name");

    if (!updatedTemplate) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Update template error:", error);
    return NextResponse.json(
      { message: "Error updating template" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: Remove a project template
 */
export const DELETE = withAuth(async function (req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const deletedTemplate = await Template.findOneAndDelete({ _id: id, organization: req.user.organizationId });

    if (!deletedTemplate) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json(
      { message: "Error deleting template" },
      { status: 500 }
    );
  }
});
