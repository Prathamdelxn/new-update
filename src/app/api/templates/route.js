import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Template from "@/models/Template";
import { withAuth } from "@/lib/middleware";
import TemplateCategory from "@/models/TemplateCategory";
/**
 * GET: Fetch all project templates
 */
export const GET = withAuth(async function (req) {
  try {
    await dbConnect();
    // Populate category and createdBy
    const templates = await Template.find({ organization: req.user.organizationId })
      .populate("category", "name")
      .populate("createdBy", "name email");

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Fetch templates error:", error);
    return NextResponse.json(
      { message: "Error fetching templates" },
      { status: 500 }
    );
  }
});

/**
 * POST: Create a new project template
 */
export const POST = withAuth(async function (req) {
  try {
    await dbConnect();
    const data = await req.json();

    // The middleware adds the user info to the request object
    const userId = req.user.id;
    const userName = req.user.name || "User";
    const userRole = req.user.role || "User";

    const newTemplate = new Template({
      ...data,
      createdBy: userId,
      organization: req.user.organizationId,
      auditTrail: [
        {
          user: userId,
          userName: userName,
          userRole: userRole,
          action: "Create",
          details: `Template "${data.name}" created by ${userName}`,
        },
      ],
    });

    await newTemplate.save();

    // Return the created template with populated fields
    const result = await Template.findById(newTemplate._id)
      .populate("category", "name")
      .populate("createdBy", "name email");

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { message: messages.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Error creating template" },
      { status: 500 }
    );
  }
});
