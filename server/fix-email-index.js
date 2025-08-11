import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/realcode';
  await mongoose.connect(mongoUri, { autoIndex: true });
  const db = mongoose.connection;
  console.log('Connected to DB:', db.name);

  const users = db.collection('users');

  // Normalize all email values to lowercase/trim
  console.log('Normalizing existing emails...');
  const cursor = users.find({ email: { $exists: true, $type: 'string' } });
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const normalized = String(doc.email).toLowerCase().trim();
    if (doc.email !== normalized) {
      await users.updateOne({ _id: doc._id }, { $set: { email: normalized } });
      updated += 1;
    }
  }
  console.log(`Emails normalized: ${updated}`);

  // Drop any previous non-unique email indexes
  try {
    await users.dropIndex('email_1');
    console.log('Dropped existing email_1 index');
  } catch (e) {
    console.log('No existing email_1 index to drop');
  }

  // Create unique index on email
  await users.createIndex({ email: 1 }, { unique: true });
  console.log('Created unique index on email');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


