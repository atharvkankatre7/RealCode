export default function requireUser(req, res, next) {
  try {
    const headerEmail = req.headers['x-user-email'];
    if (!headerEmail || typeof headerEmail !== 'string' || !headerEmail.includes('@')) {
      return res.status(401).json({ error: 'Unauthorized: missing x-user-email header' });
    }
    const normalized = headerEmail.toLowerCase().trim();
    req.userEmail = normalized;
    req.userId = normalized; // For this app, userId == email
    return next();
  } catch (err) {
    return res.status(400).json({ error: 'Bad Request: invalid auth header' });
  }
}


