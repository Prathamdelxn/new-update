import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialPurchase from "@/models/MaterialPurchase";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";

// GET: Fetch all material purchases for a project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();

    const purchases = await MaterialPurchase.find({
      project: projectId,
      organization: req.user.organizationId,
    })
      .populate("items.materialId", "name unit")
      .sort({ createdAt: -1 });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error("Fetch material purchase error:", error);
    return NextResponse.json({ message: "Error fetching material purchases" }, { status: 500 });
  }
});

// POST: Create a new material purchase log
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { items, vendorName, poNumber, advancePayment, commonNote, invoiceUrl, billNumber } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "No items provided" }, { status: 400 });
    }
    if (!vendorName) {
      return NextResponse.json({ message: "Vendor name is required" }, { status: 400 });
    }

    // Process items and calculate grand total
    const processedItems = [];
    let grandTotal = 0;

    for (const item of items) {
      const material = await Material.findOne({ 
        _id: item.materialId, 
        project: projectId,
        organization: req.user.organizationId 
      });

      if (material) {
        const unitPrice = Number(item.unitPrice) || 0;
        const qty = Number(item.quantity) || 0;
        const totalPrice = unitPrice * qty;
        
        grandTotal += totalPrice;

        processedItems.push({
          materialId: material._id,
          quantity: qty,
          unit: material.unit,
          unitPrice,
          totalPrice
        });
      }
    }

    if (processedItems.length === 0) {
      return NextResponse.json({ message: "No valid materials found for purchase" }, { status: 400 });
    }

    const advance = Number(advancePayment) || 0;
    const remainingBalance = grandTotal - advance;
    
    let paymentStatus = "Unpaid";
    if (advance > 0) {
      if (advance >= grandTotal) paymentStatus = "Paid";
      else paymentStatus = "Partial";
    }

    const newPurchase = await MaterialPurchase.create({
      project: projectId,
      organization: req.user.organizationId,
      purchasedBy: req.user.id,
      purchasedByName: req.user.name,
      vendorName,
      poNumber: poNumber || "",
      items: processedItems,
      grandTotal,
      advancePayment: advance,
      remainingBalance,
      paymentStatus,
      commonNote: commonNote || "",
      invoiceUrl: invoiceUrl || null,
      billNumber: billNumber || "",
      status: "Pending Approval"
    });

    emitToProject(projectId, 'material:updated');
    return NextResponse.json({
      message: "Material purchase logged successfully (Pending Approval)",
      purchase: newPurchase
    }, { status: 201 });
  } catch (error) {
    console.error("Create material purchase error:", error);
    return NextResponse.json({ message: "Error creating material purchase" }, { status: 500 });
  }
});
