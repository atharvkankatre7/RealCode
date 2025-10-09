import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realcode';

async function fixCodeHistoryIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collection = db.collection('codehistories');
    
    console.log('📋 Current indexes:');
    const currentIndexes = await collection.listIndexes().toArray();
    currentIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('🗑️ Dropping problematic indexes...');
    
    // Drop the language index that might be causing issues
    try {
      await collection.dropIndex({ language: 1, updatedAt: -1 });
      console.log('✅ Dropped language index');
    } catch (e) {
      console.log('⚠️ Language index not found or already dropped');
    }
    
    // Drop and recreate text index with proper language override
    try {
      await collection.dropIndex('title_text_description_text_tags_text');
      console.log('✅ Dropped text index');
    } catch (e) {
      console.log('⚠️ Text index not found or already dropped');
    }
    
    console.log('🔧 Creating new indexes...');
    
    // Create userId + updatedAt index (for efficient queries)
    await collection.createIndex({ userId: 1, updatedAt: -1 });
    console.log('✅ Created userId + updatedAt index');
    
    // Create text index with proper language override disabled
    await collection.createIndex(
      { title: 'text', description: 'text', tags: 'text' },
      { 
        default_language: 'none',
        language_override: 'none',
        name: 'search_text_index'
      }
    );
    console.log('✅ Created text search index with language override disabled');
    
    console.log('📋 Final indexes:');
    const finalIndexes = await collection.listIndexes().toArray();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      if (index.textIndexVersion) {
        console.log(`    Text index options: ${JSON.stringify({
          default_language: index.default_language,
          language_override: index.language_override
        })}`);
      }
    });
    
    console.log('✅ CodeHistory indexes fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixCodeHistoryIndexes();