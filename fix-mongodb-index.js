// Script to fix the MongoDB text index issue
// This will drop the problematic index and recreate it with proper settings

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixMongoIndex() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('codehistories');
    
    console.log('📋 Listing existing indexes...');
    const indexes = await collection.listIndexes().toArray();
    console.log('Current indexes:', indexes.map(idx => idx.name));
    
    // Check if the problematic text index exists
    const textIndex = indexes.find(idx => 
      idx.key && (idx.key.title === 'text' || idx.key.description === 'text' || idx.key.tags === 'text')
    );
    
    if (textIndex) {
      console.log('🗑️ Dropping problematic text index:', textIndex.name);
      await collection.dropIndex(textIndex.name);
      console.log('✅ Text index dropped successfully');
    } else {
      console.log('ℹ️ No problematic text index found');
    }
    
    // Create the new text index with proper language settings
    console.log('🔧 Creating new text index with language override disabled...');
    const newIndex = await collection.createIndex(
      { 
        title: 'text', 
        description: 'text', 
        tags: 'text' 
      },
      { 
        default_language: 'none',
        name: 'text_search_index'
      }
    );
    console.log('✅ New text index created:', newIndex);
    
    // Also ensure other indexes exist
    console.log('🔧 Ensuring other indexes exist...');
    await collection.createIndex({ userId: 1 });
    await collection.createIndex({ userId: 1, createdAt: -1 });
    await collection.createIndex({ language: 1, updatedAt: -1 });
    console.log('✅ All indexes verified');
    
    console.log('📋 Final index list:');
    const finalIndexes = await collection.listIndexes().toArray();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('🎉 MongoDB index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing MongoDB index:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixMongoIndex();