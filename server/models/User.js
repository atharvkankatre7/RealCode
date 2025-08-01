// server/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firebaseUid: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true 
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

// Update lastActive on save
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});


const User = mongoose.model('User', userSchema);

// Create a new user document
export async function createUser(userData) {
  const user = new User(userData);
  return await user.save();
}


// Find or create a user with Google credentials
export async function findOrCreateGoogleUser(email, name, googleId, picture) {
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      email,
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

export default User;

// Get a user by email
export async function getUser(email) {
  return await User.findOne({ email });
}

// Login user by email and password
export async function loginUser(email, password) {
  const user = await User.findOne({ email });
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
  const user = await User.findOne({ email });
  return !!user;
}

// Dummy verifyUser function (implement as needed)
export async function verifyUser(email) {
  // Example: set a verified flag (add to schema if needed)
  return await User.updateOne({ email }, { $set: { emailVerified: true } });
}
