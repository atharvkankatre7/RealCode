// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: { 
    type: String, 
    required: false, // Changed from true to false
    unique: true,
    sparse: true // Allows multiple null values
  },
  clerkId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true
  },
  displayName: String,
  role: { 
    type: String, 
    enum: ['teacher', 'student'], 
    default: 'student' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastActive: { 
    type: Date, 
    default: Date.now 
  },
  preferences: {
    theme: { 
      type: String, 
      enum: ['dark', 'light'], 
      default: 'dark' 
    },
    defaultLanguage: { 
      type: String, 
      default: 'javascript' 
    },
    editorSettings: {
      fontSize: { 
        type: Number, 
        default: 14 
      },
      tabSize: { 
        type: Number, 
        default: 2 
      }
    }
  }
});

// Ensure unique index for email
userSchema.index({ email: 1 }, { unique: true });

// Update lastActive on save
userSchema.pre('save', function(next) {
  // Normalize email to lowercase and trimmed
  if (typeof this.email === 'string') {
    this.email = this.email.toLowerCase().trim();
  }
  this.lastActive = new Date();
  next();
});

const User = mongoose.model('User', userSchema);

// Create a new user document
export async function createUser(userData) {
  const normalized = { ...userData };
  if (normalized.email) normalized.email = normalized.email.toLowerCase().trim();
  const user = new User(normalized);
  return await user.save();
}

// Find or create a user with Google credentials (Firebase)
export async function findOrCreateGoogleUser(email, name, googleId, picture) {
  const normalizedEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = new User({
      email: normalizedEmail,
      displayName: name,
      firebaseUid: googleId,
      photoURL: picture,
      role: 'student',
      createdAt: new Date(),
      lastActive: new Date(),
    });
    await user.save();
  }
  return user;
}

// Find or create a user with Clerk credentials
export async function findOrCreateClerkUser(email, name, clerkId, picture) {
  console.log('🔍 Looking for existing user with email:', email);
  const normalizedEmail = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  
  if (!user) {
    console.log('👤 User not found, creating new user...');
    user = new User({
      email: normalizedEmail,
      displayName: name,
      clerkId: clerkId, // Only set clerkId, not firebaseUid
      photoURL: picture,
      role: 'student',
      createdAt: new Date(),
      lastActive: new Date(),
      // Don't set firebaseUid for Clerk users
    });
    
    try {
      await user.save();
      console.log('✅ New user created successfully:', user.email);
    } catch (saveError) {
      console.error('❌ Error saving new user:', saveError);
      throw saveError;
    }
  } else {
    console.log('👤 Existing user found:', user.email);
  }
  
  return user;
}

export default User;

// Get a user by email
export async function getUser(email) {
  return await User.findOne({ email: (email || '').toLowerCase().trim() });
}

// Login user by email and password
export async function loginUser(email, password) {
  const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
  if (!user) {
    throw new Error('User not found');
  }
  // NOTE: Replace with real password check if you store hashed passwords
  if (user.password !== password) {
    throw new Error('Invalid password');
  }
  return user;
}

// Check if a user exists by email
export async function userExists(email) {
  const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
  return !!user;
}

// Dummy verifyUser function (implement as needed)
export async function verifyUser(email) {
  // Example: set a verified flag (add to schema if needed)
  return await User.updateOne({ email: (email || '').toLowerCase().trim() }, { $set: { emailVerified: true } });
}
