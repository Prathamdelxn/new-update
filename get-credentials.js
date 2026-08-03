const dns = require('dns');
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

async function check() {
  await mongoose.connect(MONGODB_URI);
  const users = await mongoose.connection.collection('users').find({}).limit(10).toArray();
  const superadmins = await mongoose.connection.collection('superadmins').find({}).limit(5).toArray();

  console.log('--- SUPERADMINS ---');
  superadmins.forEach(s => console.log(`Email: ${s.email}`));

  console.log('--- USERS ---');
  users.forEach(u => console.log(`Name: ${u.name} | Email: ${u.email}`));

  process.exit(0);
}

check().catch(console.error);
