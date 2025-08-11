import express from 'express';
import Comment from '../models/Comment.js';
import requireUser from '../middleware/requireUser.js';

const router = express.Router();

// List comments for a room
router.get('/:roomId', requireUser, async (req, res) => {
  try {
    const { roomId } = req.params;
    const comments = await Comment.find({ roomId }).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, comments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create comment
router.post('/:roomId', requireUser, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { text, range } = req.body;
    if (!text || !range) return res.status(400).json({ error: 'text and range required' });
    const comment = await Comment.create({
      roomId,
      authorEmail: req.userEmail,
      authorName: req.userEmail.split('@')[0],
      text,
      range
    });
    res.json({ success: true, comment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update comment (resolve/unresolve or edit text)
router.put('/:commentId', requireUser, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text, resolved } = req.body;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Not found' });
    if (comment.authorEmail !== req.userEmail) return res.status(403).json({ error: 'Forbidden' });
    const update = { updatedAt: new Date() };
    if (typeof text === 'string') update.text = text;
    if (typeof resolved === 'boolean') update.resolved = resolved;
    const updated = await Comment.findByIdAndUpdate(commentId, update, { new: true });
    res.json({ success: true, comment: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete comment
router.delete('/:commentId', requireUser, async (req, res) => {
  try {
    const { commentId } = req.params;
    const c = await Comment.findById(commentId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.authorEmail !== req.userEmail) return res.status(403).json({ error: 'Forbidden' });
    await Comment.findByIdAndDelete(commentId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;


