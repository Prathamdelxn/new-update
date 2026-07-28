const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const SuperAdminSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:  { type: String, required: true, select: false },
  lastLogin: { type: Date },
}, { timestamps: true });

const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', SuperAdminSchema);

const CREDENTIALS = {
  name:     'Super Admin',
  email:    'superadmin@skylite.com',
  password: 'SuperAdmin@123',
};

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await SuperAdmin.findOne({ email: CREDENTIALS.email });
  if (existing) {
    console.log('SuperAdmin already exists:', CREDENTIALS.email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(CREDENTIALS.password, 10);
  await SuperAdmin.create({ ...CREDENTIALS, password: hashed });

  console.log('');
  console.log('SuperAdmin created successfully');
  console.log('  Email   :', CREDENTIALS.email);
  console.log('  Password:', CREDENTIALS.password);
  console.log('');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
