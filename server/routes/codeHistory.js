import express from 'express';
import CodeHistory from '../models/CodeHistory.js';
import requireUser from '../middleware/requireUser.js';
import rateLimit from 'express-rate-limit';

const saveLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
import zlib from 'zlib';
import archiver from 'archiver';

const router = express.Router();

// Get all code history for a user
router.get('/:userId', requireUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const normalizedUserId = String(userId).toLowerCase().trim();
    if (req.userId !== normalizedUserId) return res.status(403).json({ error: 'Forbidden' });
    const { page = 1, limit = 20, q } = req.query;
    console.log('📚 Fetching code history for user:', userId);
    
    const skip = (Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1);
    const filter = { userId: normalizedUserId };
    if (q && typeof q === 'string' && q.trim()) {
      filter.$text = { $search: q.trim() };
    }
    
    let codeHistory = await CodeHistory.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Math.min(Math.max(Number(limit), 1), 50));
    let total = await CodeHistory.countDocuments(filter);

    // Self-heal legacy records that used different casing
    if (total === 0 && normalizedUserId !== userId) {
      const escaped = String(userId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ciFilter = { userId: { $regex: new RegExp(`^${escaped}$`, 'i') } };
      const legacy = await CodeHistory.find(ciFilter).sort({ updatedAt: -1 });
      if (legacy.length > 0) {
        await CodeHistory.updateMany(ciFilter, { $set: { userId: normalizedUserId } });
        codeHistory = legacy.map((d) => ({ ...d.toObject(), userId: normalizedUserId })).slice(skip, skip + Math.min(Math.max(Number(limit), 1), 50));
        total = legacy.length;
        console.log(`🔧 Migrated ${legacy.length} legacy code-history docs to normalized userId`);
      }
    }
    
    console.log(`✅ Found ${codeHistory.length} code files for user ${userId}`);
    res.json({ success: true, codeHistory, total });
  } catch (error) {
    console.error('❌ Error fetching code history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save code to history
router.post('/save', saveLimiter, requireUser, async (req, res) => {
  try {
    const { userId, title, code, language, description, tags } = req.body;
    const normalizedUserId = String(userId || '').toLowerCase().trim();
    if (req.userId !== normalizedUserId) return res.status(403).json({ error: 'Forbidden' });
    
    if (!normalizedUserId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields: userId, code, language' });
    }
    if (typeof code !== 'string' || code.length > 200_000) {
      return res.status(413).json({ error: 'Code too large (max 200KB)' });
    }
    
    console.log('💾 Saving code to history for user:', normalizedUserId);
    console.log('📝 Code details:', { title, language, codeLength: code.length });
    
    // Create new code history entry
    const newCodeHistory = new CodeHistory({
      userId: normalizedUserId,
      title: title || 'Untitled Code',
      code,
      language,
      description: description || '',
      tags: tags || []
    });
    
    await newCodeHistory.save();
    
    // Maintain 20-file limit
    await CodeHistory.maintainFileLimit(normalizedUserId);
    
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
router.get('/file/:fileId', requireUser, async (req, res) => {
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
router.delete('/file/:fileId', requireUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.body; // For security, verify user owns the file
    
    console.log('🗑️ Deleting code file:', fileId, 'for user:', userId);
    
    const codeFile = await CodeHistory.findById(fileId);
    
    if (!codeFile) {
      return res.status(404).json({ error: 'Code file not found' });
    }
    
    if (codeFile.userId !== userId || req.userId !== userId) {
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
router.put('/file/:fileId', requireUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId, title, code, language, description, tags, lastOpenedAt, favorite } = req.body;
    
    console.log('✏️ Updating code file:', fileId);
    
    const codeFile = await CodeHistory.findById(fileId);
    
    if (!codeFile) {
      return res.status(404).json({ error: 'Code file not found' });
    }
    
    if (codeFile.userId !== userId || req.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to update this file' });
    }
    
    const updateDoc = {
      title: title || codeFile.title,
      code: code || codeFile.code,
      language: language || codeFile.language,
      description: description || codeFile.description,
      tags: tags || codeFile.tags,
      updatedAt: new Date()
    };
    if (lastOpenedAt) {
      updateDoc.lastOpenedAt = new Date(lastOpenedAt);
    }
    if (typeof favorite === 'boolean') {
      updateDoc.favorite = favorite;
    }
    const updatedFile = await CodeHistory.findByIdAndUpdate(fileId, updateDoc, { new: true });
    
    console.log('✅ Code file updated successfully');
    res.json({ success: true, codeFile: updatedFile });
  } catch (error) {
    console.error('❌ Error updating code file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file count for a user
router.get('/count/:userId', requireUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    const count = await CodeHistory.countDocuments({ userId });
    
    res.json({ success: true, count, limit: 20 });
  } catch (error) {
    console.error('❌ Error getting file count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download a single file with proper headers
router.get('/download/:fileId', requireUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    const codeFile = await CodeHistory.findById(fileId);
    if (!codeFile) return res.status(404).json({ error: 'Code file not found' });

    const extMap = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      ruby: 'rb',
      go: 'go',
      rust: 'rs',
      php: 'php'
    };
    const ext = extMap[codeFile.language] || 'txt';
    const filename = `${codeFile.title}.${ext}`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(codeFile.code);
  } catch (error) {
    console.error('❌ Error downloading code file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export all user files as zip
router.get('/export/:userId', requireUser, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    const files = await CodeHistory.find({ userId }).sort({ updatedAt: -1 }).limit(200);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(userId)}-code-history.zip"`);

    const archive = archiver('zip', { zlib: { level: zlib.constants.Z_BEST_COMPRESSION } });
    archive.on('error', (err) => {
      throw err;
    });
    archive.pipe(res);

    const extMap = {
      javascript: 'js', typescript: 'ts', python: 'py', java: 'java', cpp: 'cpp',
      csharp: 'cs', ruby: 'rb', go: 'go', rust: 'rs', php: 'php'
    };
    for (const f of files) {
      const ext = extMap[f.language] || 'txt';
      const safeTitle = String(f.title || 'Untitled').replace(/[^a-z0-9-_]+/gi, '_');
      const name = `${safeTitle}.${ext}`;
      archive.append(f.code || '', { name });
    }

    archive.finalize();
  } catch (error) {
    console.error('❌ Error exporting code files:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
