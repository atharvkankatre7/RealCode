import express from 'express';
import CodeHistory from '../models/CodeHistory.js';

const router = express.Router();

// Get all code history for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('📚 Fetching code history for user:', userId);
    
    const codeHistory = await CodeHistory.find({ userId })
      .sort({ updatedAt: -1 }) // Most recent first
      .limit(20);
    
    console.log(`✅ Found ${codeHistory.length} code files for user ${userId}`);
    res.json({ success: true, codeHistory });
  } catch (error) {
    console.error('❌ Error fetching code history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save code to history
router.post('/save', async (req, res) => {
  try {
    const { userId, title, code, language, description, tags } = req.body;
    
    if (!userId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields: userId, code, language' });
    }
    
    console.log('💾 Saving code to history for user:', userId);
    console.log('📝 Code details:', { title, language, codeLength: code.length });
    
    // Create new code history entry
    const newCodeHistory = new CodeHistory({
      userId,
      title: title || 'Untitled Code',
      code,
      language,
      description: description || '',
      tags: tags || []
    });
    
    await newCodeHistory.save();
    
    // Maintain 20-file limit
    await CodeHistory.maintainFileLimit(userId);
    
    console.log('✅ Code saved successfully:', newCodeHistory._id);
    res.json({ 
      success: true, 
      message: 'Code saved to history',
      codeHistory: newCodeHistory 
    });
  } catch (error) {
    console.error('❌ Error saving code to history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific code by ID
router.get('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log('📖 Fetching code file:', fileId);
    
    const codeFile = await CodeHistory.findById(fileId);
    
    if (!codeFile) {
      return res.status(404).json({ error: 'Code file not found' });
    }
    
    console.log('✅ Code file found:', codeFile.title);
    res.json({ success: true, codeFile });
  } catch (error) {
    console.error('❌ Error fetching code file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete code file
router.delete('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.body; // For security, verify user owns the file
    
    console.log('🗑️ Deleting code file:', fileId, 'for user:', userId);
    
    const codeFile = await CodeHistory.findById(fileId);
    
    if (!codeFile) {
      return res.status(404).json({ error: 'Code file not found' });
    }
    
    if (codeFile.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this file' });
    }
    
    await CodeHistory.findByIdAndDelete(fileId);
    
    console.log('✅ Code file deleted successfully');
    res.json({ success: true, message: 'Code file deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting code file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update code file
router.put('/file/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId, title, code, language, description, tags } = req.body;
    
    console.log('✏️ Updating code file:', fileId);
    
    const codeFile = await CodeHistory.findById(fileId);
    
    if (!codeFile) {
      return res.status(404).json({ error: 'Code file not found' });
    }
    
    if (codeFile.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this file' });
    }
    
    const updatedFile = await CodeHistory.findByIdAndUpdate(
      fileId,
      {
        title: title || codeFile.title,
        code: code || codeFile.code,
        language: language || codeFile.language,
        description: description || codeFile.description,
        tags: tags || codeFile.tags,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    console.log('✅ Code file updated successfully');
    res.json({ success: true, codeFile: updatedFile });
  } catch (error) {
    console.error('❌ Error updating code file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file count for a user
router.get('/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await CodeHistory.countDocuments({ userId });
    
    res.json({ success: true, count, limit: 20 });
  } catch (error) {
    console.error('❌ Error getting file count:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
