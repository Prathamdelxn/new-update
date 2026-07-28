// import { NextResponse } from "next/server";
// import dbConnect from "@/lib/db";
// import MaterialUsage from "@/models/MaterialUsage";
// import Material from "@/models/Material";
// import { withAuth } from "@/lib/middleware";
// import { emitToProject } from "@/lib/socket-server";

// // GET: Fetch all material usage logs for a project
// export const GET = withAuth(async function (req, { params }) {
//   try {
//     const { id: projectId } = await params;
//     await dbConnect();

//     const usages = await MaterialUsage.find({
//       project: projectId,
//       organization: req.user.organizationId,
//     })
//       .populate("items.materialId", "name unit")
//       .sort({ createdAt: -1 });

//     return NextResponse.json(usages);
//   } catch (error) {
//     console.error("Fetch material usage error:", error);
//     return NextResponse.json({ message: "Error fetching material usage" }, { status: 500 });
//   }
// });

// // POST: Create a new material usage log
// export const POST = withAuth(async function (req, { params }) {
//   try {
//     const { id: projectId } = await params;
//     await dbConnect();
//     const { items, commonNote, locationOrTask } = await req.json();

//     if (!items || !Array.isArray(items) || items.length === 0) {
//       return NextResponse.json({ message: "No items provided" }, { status: 400 });
//     }

//     // Process items
//     const processedItems = [];
//     for (const item of items) {
//       const material = await Material.findOne({ 
//         _id: item.materialId, 
//         project: projectId,
//         organization: req.user.organizationId 
//       });

//       if (material) {
//         processedItems.push({
//           materialId: material._id,
//           quantity: item.quantity,
//           unit: material.unit
//         });
//       }
//     }

//     if (processedItems.length === 0) {
//       return NextResponse.json({ message: "No valid materials found for usage" }, { status: 400 });
//     }

//     const newUsage = await MaterialUsage.create({
//       project: projectId,
//       organization: req.user.organizationId,
//       usedBy: req.user.id,
//       usedByName: req.user.name,
//       locationOrTask: locationOrTask || "",
//       items: processedItems,
//       commonNote: commonNote || "",
//       status: "Verified"
//     });

//     // Immediately update actual inventory (totalConsumed)
//     for (const item of processedItems) {
//       const material = await Material.findOne({ _id: item.materialId });
//       if (material) {
//         material.totalConsumed += Number(item.quantity);
        
//         let noteStr = `Direct Usage ${newUsage._id}`;
//         if (newUsage.locationOrTask) noteStr += ` | Task: ${newUsage.locationOrTask}`;
//         if (newUsage.commonNote) noteStr += ` | Note: ${newUsage.commonNote}`;

//         material.logs.push({
//           type: "Used",
//           quantity: Number(item.quantity),
//           note: noteStr,
//           updatedBy: req.user.id,
//           updatedByName: req.user.name,
//           date: new Date()
//         });
        
//         await material.save();
//       }
//     }

//     emitToProject(projectId, 'material:updated');
//     return NextResponse.json({
//       message: "Material usage created and inventory updated",
//       usage: newUsage
//     }, { status: 201 });
//   } catch (error) {
//     console.error("Create material usage error:", error);
//     return NextResponse.json({ message: "Error creating material usage" }, { status: 500 });
//   }
// });


import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MaterialUsage from "@/models/MaterialUsage";
import Material from "@/models/Material";
import { withAuth } from "@/lib/middleware";
import { emitToProject } from "@/lib/socket-server";
 
// GET: Fetch all material usage logs for a project
export const GET = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
 
    const usages = await MaterialUsage.find({
      project: projectId,
      organization: req.user.organizationId,
    })
      .populate("items.materialId", "name unit")
      .sort({ createdAt: -1 });
 
    return NextResponse.json(usages);
  } catch (error) {
    console.error("Fetch material usage error:", error);
    return NextResponse.json({ message: "Error fetching material usage" }, { status: 500 });
  }
});
 
// POST: Create a new material usage log
export const POST = withAuth(async function (req, { params }) {
  try {
    const { id: projectId } = await params;
    await dbConnect();
    const { items, commonNote, locationOrTask } = await req.json();
 
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "No items provided" }, { status: 400 });
    }
 
    // Process items
    const processedItems = [];
    for (const item of items) {
      const material = await Material.findOne({
        _id: item.materialId,
        project: projectId,
        organization: req.user.organizationId
      });
 
      if (material) {
        const availableStock = material.totalReceived - material.totalConsumed;
        if (Number(item.quantity) > availableStock) {
          return NextResponse.json({
            message: `Cannot use ${item.quantity} ${material.unit} of ${material.name}. Only ${availableStock} ${material.unit} available.`
          }, { status: 400 });
        }
 
        processedItems.push({
          materialId: material._id,
          quantity: item.quantity,
          unit: material.unit
        });
      }
    }
 
    if (processedItems.length === 0) {
      return NextResponse.json({ message: "No valid materials found for usage" }, { status: 400 });
    }
 
    const newUsage = await MaterialUsage.create({
      project: projectId,
      organization: req.user.organizationId,
      usedBy: req.user.id,
      usedByName: req.user.name,
      locationOrTask: locationOrTask || "",
      items: processedItems,
      commonNote: commonNote || "",
      status: "Verified"
    });
 
    // Immediately update actual inventory (totalConsumed)
    for (const item of processedItems) {
      const material = await Material.findOne({ _id: item.materialId });
      if (material) {
        material.totalConsumed += Number(item.quantity);
       
        let noteStr = `Direct Usage ${newUsage._id}`;
        if (newUsage.locationOrTask) noteStr += ` | Task: ${newUsage.locationOrTask}`;
        if (newUsage.commonNote) noteStr += ` | Note: ${newUsage.commonNote}`;
 
        material.logs.push({
          type: "Used",
          quantity: Number(item.quantity),
          note: noteStr,
          updatedBy: req.user.id,
          updatedByName: req.user.name,
          date: new Date()
        });
       
        await material.save();
      }
    }
 
    emitToProject(projectId, 'material:updated');
    return NextResponse.json({
      message: "Material usage created and inventory updated",
      usage: newUsage
    }, { status: 201 });
  } catch (error) {
    console.error("Create material usage error:", error);
    return NextResponse.json({ message: "Error creating material usage" }, { status: 500 });
  }
});
 
 