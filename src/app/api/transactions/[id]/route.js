import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import { withAuth } from "@/lib/middleware";

// PATCH: Edit an existing transaction
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id: transactionId } = await params;
    await dbConnect();
    
    const updateData = await req.json();

    // Prevent modifying core linking if needed, but allow basic edits
    delete updateData.project;
    delete updateData.organization;
    delete updateData.createdBy;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, organization: req.user.organizationId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!transaction) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Transaction updated successfully",
      transaction
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json({ message: "Error updating transaction" }, { status: 500 });
  }
});

// DELETE: Remove a transaction
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id: transactionId } = await params;
    await dbConnect();

    const transaction = await Transaction.findOneAndDelete({ 
      _id: transactionId,
      organization: req.user.organizationId 
    });

    if (!transaction) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ message: "Error deleting transaction" }, { status: 500 });
  }
});
