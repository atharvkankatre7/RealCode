// server/models/User.js
import crypto from 'crypto';

// In-memory user database (in a real app, this would be a database)
const users = {};

// In-memory OTP storage (in a real app, this would be in a database with expiration)
const otpStore = {};

// Helper function to hash passwords
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
};

// Helper function to verify passwords
const verifyPassword = (password, hash, salt) => {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// Generate a random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP for a user
const storeOTP = (email, otp) => {
  // Store OTP with creation and expiration time
  otpStore[email] = {
    otp,
    createdAt: Date.now(),
    // OTP expires in 10 minutes
    expiresAt: Date.now() + 10 * 60 * 1000,
    // Track verification attempts
    attempts: 0,
    // Max allowed attempts
    maxAttempts: 5
  };

  console.log(`OTP stored for ${email}: ${otp} (expires in 10 minutes)`);

  // Set a timeout to automatically clean up expired OTPs
  setTimeout(() => {
    if (otpStore[email] && otpStore[email].otp === otp) {
      console.log(`OTP for ${email} expired and removed from store`);
      delete otpStore[email];
    }
  }, 10 * 60 * 1000);

  return otp;
};

// Verify OTP for a user
const verifyOTP = (email, otp) => {
  const otpData = otpStore[email];

  // If no OTP data found
  if (!otpData) {
    console.log(`No OTP found for ${email}`);
    return { valid: false, reason: 'no_otp_found' };
  }

  // Check if OTP is expired
  if (Date.now() > otpData.expiresAt) {
    console.log(`OTP for ${email} has expired`);
    delete otpStore[email];
    return { valid: false, reason: 'expired' };
  }

  // Increment attempt counter
  otpData.attempts += 1;

  // Check if max attempts exceeded
  if (otpData.attempts > otpData.maxAttempts) {
    console.log(`Max OTP attempts exceeded for ${email}`);
    delete otpStore[email];
    return { valid: false, reason: 'max_attempts' };
  }

  // Check if OTP matches
  if (otpData.otp !== otp) {
    console.log(`Invalid OTP attempt for ${email}: ${otp} (attempt ${otpData.attempts}/${otpData.maxAttempts})`);
    return { valid: false, reason: 'invalid_otp' };
  }

  // OTP is valid, remove it from store
  console.log(`OTP verified successfully for ${email}`);
  delete otpStore[email];
  return { valid: true };
};

// Check if a user exists
const userExists = (email) => {
  return !!users[email];
};

// Create a new user
const createUser = (email, password, name = '') => {
  if (userExists(email)) {
    throw new Error('User already exists');
  }

  const { hash, salt } = hashPassword(password);

  users[email] = {
    email,
    name,
    hash,
    salt,
    verified: false,
    emailVerified: false,
    createdAt: Date.now()
  };

  return users[email];
};

// Verify a user's email
const verifyUser = (email) => {
  if (!userExists(email)) {
    throw new Error('User not found');
  }

  users[email].verified = true;
  users[email].emailVerified = true;
  return users[email];
};

// Login a user
const loginUser = (email, password) => {
  if (!userExists(email)) {
    throw new Error('User not found');
  }

  const user = users[email];

  if (!verifyPassword(password, user.hash, user.salt)) {
    throw new Error('Invalid password');
  }

  if (!user.verified) {
    throw new Error('Account not verified');
  }

  if (!user.emailVerified) {
    throw new Error('Email not verified');
  }

  return user;
};

// Get a user by email
const getUser = (email) => {
  return users[email];
};

// Find or create a user with Google credentials
const findOrCreateGoogleUser = (email, name, googleId, photoURL) => {
  // Check if user already exists
  if (userExists(email)) {
    // Update existing user with Google info if needed
    const user = users[email];

    // Update Google ID if not set
    if (!user.googleId) {
      user.googleId = googleId;
    }

    // Update photo URL if provided
    if (photoURL && (!user.photoURL || user.photoURL !== photoURL)) {
      user.photoURL = photoURL;
    }

    // Ensure the user is verified
    user.verified = true;
    user.emailVerified = true;

    return user;
  }

  // Create a new user with Google credentials
  users[email] = {
    email,
    name: name || email.split('@')[0], // Use name or extract from email
    googleId,
    photoURL,
    verified: true,
    emailVerified: true,
    createdAt: Date.now()
  };

  console.log(`Created new user via Google: ${email}`);
  return users[email];
};

export {
  userExists,
  createUser,
  verifyUser,
  loginUser,
  getUser,
  generateOTP,
  storeOTP,
  verifyOTP,
  findOrCreateGoogleUser
};
