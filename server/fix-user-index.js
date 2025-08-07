import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixUserIndex() {
  try {
    console.log('🔧 Fixing user index issue...');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realcode';
    console.log('📡 Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Database connected successfully');
    
    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Drop the problematic firebaseUid index
    console.log('🗑️ Dropping firebaseUid index...');
    try {
      await usersCollection.dropIndex('firebaseUid_1');
      console.log('✅ firebaseUid index dropped successfully');
    } catch (error) {
      console.log('ℹ️ firebaseUid index not found or already dropped');
    }
    
    // Drop the clerkId index if it exists
    console.log('🗑️ Dropping clerkId index...');
    try {
      await usersCollection.dropIndex('clerkId_1');
      console.log('✅ clerkId index dropped successfully');
    } catch (error) {
      console.log('ℹ️ clerkId index not found or already dropped');
    }
    
    // Update existing users to remove null firebaseUid
    console.log('🔄 Updating existing users...');
    const result = await usersCollection.updateMany(
      { firebaseUid: null },
      { $unset: { firebaseUid: "" } }
    );
    console.log(`✅ Updated ${result.modifiedCount} users`);
    
    // Create new sparse indexes
    console.log('🔨 Creating new sparse indexes...');
    await usersCollection.createIndex({ firebaseUid: 1 }, { 
      unique: true, 
      sparse: true 
    });
    await usersCollection.createIndex({ clerkId: 1 }, { 
      unique: true, 
      sparse: true 
    });
    
    console.log('✅ New indexes created successfully');
    console.log('🎉 User index fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing user index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Run the fix
fixUserIndex();
