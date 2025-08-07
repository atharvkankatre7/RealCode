// server/routes/auth.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
  userExists,
  createUser,
  verifyUser,
  loginUser,
  getUser,
  findOrCreateGoogleUser,
  findOrCreateClerkUser
} from '../models/User.js';

const router = express.Router();

// Create a Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Secret key for JWT from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-development';

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Check if email exists
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const exists = userExists(email);

    return res.json({ exists });
  } catch (error) {
    console.error('Error checking email:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Send OTP for verification
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP
    storeOTP(email, otp);

    // Send verification email
    const emailResult = await sendVerificationEmail(email, otp);

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    // If using Ethereal for testing, include the preview URL
    const response = {
      success: true,
      message: 'OTP sent successfully'
    };

    if (emailResult.previewUrl) {
      response.previewUrl = emailResult.previewUrl;
      console.log('Email preview URL:', emailResult.previewUrl);
    }

    return res.json(response);
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    if (userExists(email)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const user = await createUser({
      email,
      password,
      displayName: name
    });

    return res.json({
      success: true,
      message: 'User registered successfully',
      requiresVerification: true
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Verify OTP
    const verificationResult = verifyOTP(email, otp);

    if (!verificationResult.valid) {
      // Return specific error messages based on the reason
      let errorMessage = 'Invalid or expired OTP';

      switch (verificationResult.reason) {
        case 'no_otp_found':
          errorMessage = 'No verification code found. Please request a new code.';
          break;
        case 'expired':
          errorMessage = 'Verification code has expired. Please request a new code.';
          break;
        case 'max_attempts':
          errorMessage = 'Too many failed attempts. Please request a new code.';
          break;
        case 'invalid_otp':
          errorMessage = 'Invalid verification code. Please try again.';
          break;
      }

      return res.status(400).json({ error: errorMessage, reason: verificationResult.reason });
    }

    // Mark user as verified if they exist
    if (userExists(email)) {
      verifyUser(email);
    }

    // Get user
    const user = getUser(email);

    // Generate token
    const token = user ? generateToken(user) : null;

    return res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: user ? {
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      } : null
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      // Login user
      const user = loginUser(email, password);

      // Generate token
      const token = generateToken(user);

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Google Authentication
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    try {
      // Verify the Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      // Get the payload from the ticket
      const payload = ticket.getPayload();

      // Extract user information from the payload
      const { email, name, picture, sub: googleId } = payload;

      // Find or create a user with Google credentials
      const user = findOrCreateGoogleUser(email, name, googleId, picture);

      // Generate a JWT token
      const token = generateToken(user);

      return res.json({
        success: true,
        message: 'Google authentication successful',
        token,
        user: {
          email: user.email,
          name: user.name,
          photoURL: user.photoURL,
          emailVerified: true
        }
      });
    } catch (error) {
      console.error('Error verifying Google token:', error);
      return res.status(401).json({ error: 'Invalid Google token' });
    }
  } catch (error) {
    console.error('Error with Google authentication:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Test endpoint to verify auth routes are working
router.get('/test', (req, res) => {
  console.log('🧪 Auth test endpoint called');
  res.json({ message: 'Auth routes are working!' });
});

// Clerk Authentication
router.post('/clerk', async (req, res) => {
  console.log('🔐 Clerk authentication endpoint called');
  console.log('📝 Request body:', req.body);
  
  try {
    const { email, name, clerkId, picture } = req.body;

    if (!email || !clerkId) {
      console.log('❌ Missing required fields:', { email: !!email, clerkId: !!clerkId });
      return res.status(400).json({ error: 'Email and clerkId are required' });
    }

    console.log('✅ Valid request, creating/finding user...');
    
    // Find or create a user with Clerk credentials
    const user = await findOrCreateClerkUser(email, name, clerkId, picture);

    console.log('✅ User created/found:', user.email);

    // Generate a JWT token
    const token = generateToken(user);

    console.log('✅ Clerk authentication successful');

    return res.json({
      success: true,
      message: 'Clerk authentication successful',
      token,
      user: {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        emailVerified: true
      }
    });
  } catch (error) {
    console.error('❌ Error with Clerk authentication:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
});

export default router;
