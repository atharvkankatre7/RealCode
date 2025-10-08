import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Admin route to fix MongoDB text index issue
router.post('/fix-index', async (req, res) => {
  try {
    console.log('🔧 [ADMIN] Starting MongoDB index fix...');
    
    const db = mongoose.connection.db;
    const collection = db.collection('codehistories');
    
    // List existing indexes
    console.log('📋 [ADMIN] Listing existing indexes...');
    const indexes = await collection.listIndexes().toArray();
    console.log('[ADMIN] Current indexes:', indexes.map(idx => idx.name));
    
    // Check if the problematic text index exists
    const textIndex = indexes.find(idx => 
      idx.key && (idx.key.title === 'text' || idx.key.description === 'text' || idx.key.tags === 'text')
    );
    
    let droppedIndex = null;
    if (textIndex) {
      console.log('🗑️ [ADMIN] Dropping problematic text index:', textIndex.name);
      await collection.dropIndex(textIndex.name);
      droppedIndex = textIndex.name;
      console.log('✅ [ADMIN] Text index dropped successfully');
    } else {
      console.log('ℹ️ [ADMIN] No problematic text index found');
    }
    
    // Create the new text index with proper language settings
    console.log('🔧 [ADMIN] Creating new text index with language override disabled...');
    const newIndex = await collection.createIndex(
      { 
        title: 'text', 
        description: 'text', 
        tags: 'text' 
      },
      { 
        default_language: 'none',
        name: 'text_search_index_fixed'
      }
    );
    console.log('✅ [ADMIN] New text index created:', newIndex);
    
    // Get final index list
    const finalIndexes = await collection.listIndexes().toArray();
    console.log('📋 [ADMIN] Final index list:', finalIndexes.map(idx => idx.name));
    
    res.json({
      success: true,
      message: 'MongoDB index fix completed successfully',
      droppedIndex,
      newIndex,
      finalIndexes: finalIndexes.map(idx => ({ name: idx.name, key: idx.key }))
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fixing MongoDB index:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fix MongoDB index'
    });
  }
});

// Health check for admin routes
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes are working',
    timestamp: new Date().toISOString()
  });
});

export default router;