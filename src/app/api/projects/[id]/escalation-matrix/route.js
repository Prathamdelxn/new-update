import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import EscalationMatrix from "@/models/EscalationMatrix";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();

    let matrix = await EscalationMatrix.findOne({ project: id })
      .populate({ 
        path: 'levels.user', 
        select: 'name email phoneNumber role __enc_name __enc_phoneNumber',
        populate: { path: 'role', select: 'name' }
      });

    if (!matrix) {
      // Return a default structure if not found
      return NextResponse.json({ 
        project: id, 
        levels: [] 
      });
    }

    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Fetch matrix error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await dbConnect();

    const sanitizedLevels = body.levels?.map(lvl => ({
      ...lvl,
      user: lvl.user?._id || lvl.user || null
    })) || [];

    const matrix = await EscalationMatrix.findOneAndUpdate(
      { project: id },
      { 
        $set: {
          levels: sanitizedLevels, 
          project: id, 
          organization: req.user.organizationId,
          updatedBy: req.user.id 
        },
        $push: {
          auditTrail: {
            user: req.user.id,
            userName: req.user.name || "Admin",
            action: "MatrixUpdated",
            details: `Escalation matrix configured with ${sanitizedLevels.length} levels by ${req.user.name || "Admin"}`,
            timestamp: new Date()
          }
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Populate user details for returning JSON to avoid display issues
    await matrix.populate({
      path: 'levels.user',
      select: 'name email phoneNumber role __enc_name __enc_phoneNumber',
      populate: { path: 'role', select: 'name' }
    });

    emitToProject(id, 'escalation:updated');
    return NextResponse.json(matrix);
  } catch (error) {
    console.error("Save matrix error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
});

