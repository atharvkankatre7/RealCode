import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function migrateUserPreferences() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realcode';
  await mongoose.connect(mongoURI);

  const db = mongoose.connection.db;
  const users = db.collection('users');

  const cursor = users.find({ $or: [{ theme: { $exists: true } }, { language: { $exists: true } }] });

  let count = 0;
  while (await cursor.hasNext()) {
    const user = await cursor.next();
    const update = {};
    if (user.theme) update['preferences.theme'] = user.theme;
    if (user.language) update['preferences.defaultLanguage'] = user.language;
    await users.updateOne(
      { _id: user._id },
      {
        $set: update,
        $unset: { theme: "", language: "" }
      }
    );
    count++;
  }

  console.log(`Migrated ${count} users.`);
  await mongoose.disconnect();
}

migrateUserPreferences();

