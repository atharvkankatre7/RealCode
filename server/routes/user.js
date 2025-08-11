import express from 'express';
import User from '../models/User.js';
import requireUser from '../middleware/requireUser.js';

const router = express.Router();

// PUT /api/users/preferences
router.put('/preferences', requireUser, async (req, res) => {
  const { email, theme, language } = req.body;
  if (!email || !theme || !language) {
    return res.status(400).json({ error: 'email, theme, and language are required.' });
  }

  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    if (normalizedEmail !== req.userEmail) return res.status(403).json({ error: 'Forbidden' });
    const updates = {
      'preferences.theme': theme,
      'preferences.defaultLanguage': language
    };
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, preferences: user.preferences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
