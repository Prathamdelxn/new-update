import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Transaction from "@/models/Transaction";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const transactions = await Transaction.find({
      project: projectId,
      organization: req.user.organizationId,
    }).sort({ date: -1, createdAt: -1 });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Fetch transactions error:", error);
    return NextResponse.json({ message: "Error fetching transactions" }, { status: 500 });
  }
});

export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    
    const { 
      type, amount, date, paymentMethod, partyName, 
      referenceNumber, category, description, linkedPurchase, invoiceUrl
    } = await req.json();

    if (!type || !amount || !partyName) {
      return NextResponse.json({ message: "Type, amount, and party name are required" }, { status: 400 });
    }

    const newTransaction = await Transaction.create({
      project: projectId,
      organization: req.user.organizationId,
      createdBy: req.user.id,
      createdByName: req.user.name,
      type,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || "Other",
      partyName,
      referenceNumber: referenceNumber || "",
      category: category || "",
      description: description || "",
      invoiceUrl: invoiceUrl || null,
      linkedPurchase: linkedPurchase || null
    });

    emitToProject(projectId, 'transactions:updated');
    return NextResponse.json({
      message: "Transaction recorded successfully",
      transaction: newTransaction
    }, { status: 201 });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json({ message: "Error creating transaction" }, { status: 500 });
  }
});
