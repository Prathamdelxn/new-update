/**
 * One-time backfill: for every user who has projects in User.projects,
 * make sure they are also in the corresponding Project.members array.
 *
 * Run: node sync-project-members.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI missing'); process.exit(1); }

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected');

  const db = mongoose.connection.db;
  const users = await db.collection('users').find({ projects: { $exists: true, $ne: [] } }).toArray();

  let fixed = 0;
  for (const user of users) {
    if (!user.projects?.length) continue;
    const result = await db.collection('projects').updateMany(
      { _id: { $in: user.projects } },
      { $addToSet: { members: user._id } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  Fixed: ${user.name} → added to ${result.modifiedCount} project(s)`);
      fixed += result.modifiedCount;
    }
  }

  console.log(`\nDone. ${fixed} project document(s) updated.`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
