const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const OrgSchema = new mongoose.Schema({ name: String }, { strict: false });
const Organization = mongoose.models.Organization || mongoose.model('Organization', OrgSchema);

const UserSchema = new mongoose.Schema({ name: String, email: String, organization: mongoose.Schema.Types.ObjectId }, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  currency: { type: String, default: "AED" },
  area: Number,
  projectType: String,
  status: String,
  priority: String,
  organization: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  startDate: Date,
  endDate: Date,
}, { timestamps: true, strict: false });
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the specific user
    const targetEmail = "prathameshgodage@gmail.com";
    const user = await User.findOne({ email: targetEmail });
    
    if (!user) {
       console.log(`No user found with email: ${targetEmail}`);
       process.exit(1);
    }
    
    if (!user.organization) {
       console.log(`User ${targetEmail} does not belong to any organization.`);
       process.exit(1);
    }

    const projects = [];
    for (let i = 1; i <= 20; i++) {
      projects.push({
        name: `Admin Project ${i}`,
        description: `This is an auto-generated project for admin ${targetEmail}.`,
        currency: "AED",
        area: 100 + (i * 10),
        projectType: i % 2 === 0 ? "Interior" : "Construction",
        status: "Initialized",
        priority: ["Low", "Medium", "High", "Urgent"][i % 4],
        organization: user.organization,
        createdBy: user._id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    await Project.insertMany(projects);
    console.log(`Successfully added 20 projects for User: ${targetEmail} (ID: ${user._id}) in Org ID: ${user.organization}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed projects:', err);
    process.exit(1);
  }
}

seed();
