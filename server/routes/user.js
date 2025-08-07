import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// PUT /api/users/preferences
router.put('/preferences', async (req, res) => {
  const { userId, theme, language } = req.body;
  if (!userId || !theme || !language) {
    return res.status(400).json({ error: 'userId, theme, and language are required.' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { theme, language },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, preferences: { theme: user.theme, language: user.language } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
