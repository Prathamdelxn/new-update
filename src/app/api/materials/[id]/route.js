// import { NextResponse } from "next/server";
// import dbConnect from "@/lib/db";
// import Material from "@/models/Material";
// import { withAuth } from "@/lib/middleware";

// // PATCH: Update material details or stock
// export const PATCH = withAuth(async function (req, { params }) {
//   try {
//     const { id } = await params;
//     await dbConnect();
//     const body = await req.json();
//     const { type, quantity, note, name, unit } = body;

//     const material = await Material.findOne({ 
//       _id: id, 
//       organization: req.user.organizationId 
//     });

//     if (!material) {
//       return NextResponse.json({ message: "Material not found" }, { status: 404 });
//     }

//     const oldName = material.name;
//     const oldUnit = material.unit;
//     let nameChanged = false;
//     let unitChanged = false;

//     // General updates
//     if (name && name !== oldName) {
//       material.name = name;
//       nameChanged = true;
//     }
//     if (unit && unit !== oldUnit) {
//       material.unit = unit;
//       unitChanged = true;
//     }

//     // Stock updates if type is provided
//     if (type && quantity) {
//       if (type === "Received" || type === "Purchase" || type === "In") {
//         material.totalReceived += Number(quantity);
//       } else if (type === "Used" || type === "Out") {
//         material.totalConsumed += Number(quantity);
//       }
      
//       // Add log
//       material.logs.push({
//         type,
//         quantity: Number(quantity),
//         note,
//         updatedBy: req.user.id,
//         updatedByName: req.user.name,
//         date: new Date()
//       });
//     }

//     await material.save();

//     // If name or unit changed, update all related records for consistency
//     if (nameChanged || unitChanged) {
//       const { default: BOQ } = await import("@/models/BOQ");
//       const { default: MaterialUsage } = await import("@/models/MaterialUsage");
//       const { default: MaterialReceipt } = await import("@/models/MaterialReceipt");
//       const { default: MaterialRequest } = await import("@/models/MaterialRequest");
//       const { default: MaterialPurchase } = await import("@/models/MaterialPurchase");

//       const projectId = material.project;

//       // 1. Update BOQ items if name matches
//       if (nameChanged) {
//         await BOQ.updateMany(
//           { project: projectId, itemDescription: oldName },
//           { $set: { itemDescription: name } }
//         );
//       }

//       // 2. Update all usage/receipt/request items with the new unit
//       if (unitChanged) {
//         const updateObj = { "items.$[elem].unit": unit };
//         const arrayFilters = [{ "elem.materialId": id }];

//         await Promise.all([
//           MaterialUsage.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
//           MaterialReceipt.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
//           MaterialRequest.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
//           MaterialPurchase.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters })
//         ]);
//       }
//     }

//     const { emitToProject } = await import("@/lib/socket-server");
//     emitToProject(material.project, 'material:updated');

//     return NextResponse.json(material);
//   } catch (error) {
//     console.error("Material update error:", error);
//     return NextResponse.json({ message: "Error updating material" }, { status: 500 });
//   }
// });

// // DELETE: Remove material
// export const DELETE = withAuth(async function (req, { params }) {
//   try {
//     const { id } = await params;
//     await dbConnect();
//     const material = await Material.findOneAndDelete({ 
//       _id: id, 
//       organization: req.user.organizationId 
//     });

//     if (!material) {
//       return NextResponse.json({ message: "Material not found" }, { status: 404 });
//     }

//     return NextResponse.json({ message: "Material deleted successfully" });
//   } catch (error) {
//     return NextResponse.json({ message: "Error deleting material" }, { status: 500 });
//   }
// });
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
 
// PATCH: Update material details or stock
export const PATCH = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const body = await req.json();
    const { type, quantity, note, name, unit } = body;
 
    const material = await Material.findOne({
      _id: id,
      organization: req.user.organizationId
    });
 
    if (!material) {
      return NextResponse.json({ message: "Material not found" }, { status: 404 });
    }
 
    const oldName = material.name;
    const oldUnit = material.unit;
    let nameChanged = false;
    let unitChanged = false;
 
    // General updates
    if (name && name !== oldName) {
      material.name = name;
      nameChanged = true;
    }
    if (unit && unit !== oldUnit) {
      material.unit = unit;
      unitChanged = true;
    }
 
    // Stock updates if type is provided
    if (type && quantity) {
      if (type === "Received" || type === "Purchase" || type === "In") {
        material.totalReceived += Number(quantity);
      } else if (type === "Used" || type === "Out") {
        const available = material.totalReceived - material.totalConsumed;
        if (Number(quantity) > available) {
          return NextResponse.json({
            message: `Cannot use/remove ${quantity} ${material.unit}. Only ${available} available.`
          }, { status: 400 });
        }
        material.totalConsumed += Number(quantity);
      }
     
      // Add log
      material.logs.push({
        type,
        quantity: Number(quantity),
        note,
        updatedBy: req.user.id,
        updatedByName: req.user.name,
        date: new Date()
      });
    }
 
    await material.save();
 
    // If name or unit changed, update all related records for consistency
    if (nameChanged || unitChanged) {
      const { default: BOQ } = await import("@/models/BOQ");
      const { default: MaterialUsage } = await import("@/models/MaterialUsage");
      const { default: MaterialReceipt } = await import("@/models/MaterialReceipt");
      const { default: MaterialRequest } = await import("@/models/MaterialRequest");
      const { default: MaterialPurchase } = await import("@/models/MaterialPurchase");
 
      const projectId = material.project;
 
      // 1. Update BOQ items if name matches
      if (nameChanged) {
        await BOQ.updateMany(
          { project: projectId, itemDescription: oldName },
          { $set: { itemDescription: name } }
        );
      }
 
      // 2. Update all usage/receipt/request items with the new unit
      if (unitChanged) {
        const updateObj = { "items.$[elem].unit": unit };
        const arrayFilters = [{ "elem.materialId": id }];
 
        await Promise.all([
          MaterialUsage.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
          MaterialReceipt.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
          MaterialRequest.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters }),
          MaterialPurchase.updateMany({ "items.materialId": id }, { $set: updateObj }, { arrayFilters })
        ]);
      }
    }
 
    const { emitToProject } = await import("@/lib/socket-server");
    emitToProject(material.project, 'material:updated');
 
    return NextResponse.json(material);
  } catch (error) {
    console.error("Material update error:", error);
    return NextResponse.json({ message: "Error updating material" }, { status: 500 });
  }
});
 
// DELETE: Remove material
export const DELETE = withAuth(async function (req, { params }) {
  try {
    const { id } = await params;
    await dbConnect();
    const material = await Material.findOneAndDelete({
      _id: id,
      organization: req.user.organizationId
    });
 
    if (!material) {
      return NextResponse.json({ message: "Material not found" }, { status: 404 });
    }
 
    return NextResponse.json({ message: "Material deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Error deleting material" }, { status: 500 });
  }
});
 
 