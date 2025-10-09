import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    default: 'Untitled Room' 
  },
  description: String,
  createdBy: { 
    type: String, 
    default: '' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  inactiveCleanupAt: {
    type: Date,
    default: null  // Set when room becomes empty, cleared when users rejoin
  },
  settings: {
    canEdit: { 
      type: Boolean, 
      default: false  // Changed to false for security
    },
    defaultLanguage: { 
      type: String, 
      default: 'javascript' 
    },
    maxUsers: { 
      type: Number, 
      default: 10 
    }
  },
  // Individual user permissions - overrides room-wide setting
  userPermissions: {
    type: Map,
    of: {
      canEdit: { type: Boolean, default: false },
      grantedBy: { type: String, default: '' }, // teacher's username for display
      grantedAt: { type: Date, default: Date.now },
      reason: { type: String, default: '' }
    },
    default: {}
  },
  currentCode: {
    language: { 
      type: String, 
      default: 'javascript' 
    },
    content: { 
      type: String, 
      default: '// Start coding here...' 
    },
    lastSaved: { 
      type: Date, 
      default: Date.now 
    },
    lastSavedBy: { 
      type: String, 
      default: '' 
    }
  },
  participants: [
    {
      userId: { 
        type: String, 
        default: '' 
      },
      joinedAt: { 
        type: Date, 
        default: Date.now 
      },
      lastActive: { 
        type: Date, 
        default: Date.now 
      },
      permissions: { 
        type: String, 
        enum: ['teacher', 'student'], 
        default: 'student' 
      }
    }
  ]
});

// Update updatedAt on save
roomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to get user's edit permission (considers both room-wide and individual)
roomSchema.methods.getUserEditPermission = function(userId) {
  // Teachers can always edit
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (participant && participant.permissions === 'teacher') {
    return true;
  }
  
  // Check individual permission override
  if (this.userPermissions.has(userId)) {
    return this.userPermissions.get(userId).canEdit;
  }
  
  // Fall back to room-wide setting
  return this.settings.canEdit;
};

// Method to set individual user permission
roomSchema.methods.setUserPermission = async function(userId, canEdit, grantedBy, reason = '') {
  try {
    if (!this.userPermissions.has(userId)) {
      this.userPermissions.set(userId, {});
    }
    
    const userPerm = this.userPermissions.get(userId);
    userPerm.canEdit = canEdit;
    userPerm.grantedBy = grantedBy;
    userPerm.grantedAt = new Date();
    userPerm.reason = reason;
    
    await this.save();
    console.log(`[Room.setUserPermission] Set permission for userId=${userId}: canEdit=${canEdit}, grantedBy=${grantedBy}`);
    return this;
  } catch (error) {
    console.error(`[Room.setUserPermission] Error setting permission for userId=${userId}:`, error);
    throw error;
  }
};

// Method to remove individual user permission (fall back to room-wide)
roomSchema.methods.removeUserPermission = async function(userId) {
  try {
    if (this.userPermissions.has(userId)) {
      this.userPermissions.delete(userId);
      await this.save();
      console.log(`[Room.removeUserPermission] Removed permission for userId=${userId}`);
    }
    return this;
  } catch (error) {
    console.error(`[Room.removeUserPermission] Error removing permission for userId=${userId}:`, error);
    throw error;
  }
};

// Method to get all user permissions for a room
roomSchema.methods.getAllUserPermissions = function() {
  const permissions = {};
  this.userPermissions.forEach((value, key) => {
    permissions[key] = value;
  });
  return permissions;
};

// Method to save code
roomSchema.methods.saveCode = async function(content, language, userId) {
  try {
    this.currentCode.content = content;
    this.currentCode.language = language;
    this.currentCode.lastSaved = new Date();
    this.currentCode.lastSavedBy = userId;
    
    const doc = await this.save();
    console.log(`[Room.saveCode] Code saved for roomId=${this.roomId}, userId=${userId}, language=${language}`);
    console.log('[Room.saveCode] Saved document:', JSON.stringify(doc, null, 2));
    return doc;
  } catch (error) {
    console.error(`[Room.saveCode] Error saving code for roomId=${this.roomId}, userId=${userId}:`, error);
    throw error;
  }
};

// Method to add participant
roomSchema.methods.addParticipant = async function(userId, permissions = 'student') {
  try {
    const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
    if (existingParticipant) {
      existingParticipant.lastActive = new Date();
      console.log(`[Room.addParticipant] Updated lastActive for userId=${userId} in roomId=${this.roomId}`);
    } else {
      this.participants.push({
        userId,
        permissions,
        joinedAt: new Date(),
        lastActive: new Date()
      });
      console.log(`[Room.addParticipant] Added new participant userId=${userId}, permissions=${permissions} in roomId=${this.roomId}`);
    }
    
    const doc = await this.save();
    console.log(`[Room.addParticipant] Participant saved for roomId=${this.roomId}, userId=${userId}`);
    console.log('[Room.addParticipant] Saved document:', JSON.stringify(doc, null, 2));
    return doc;
  } catch (error) {
    console.error(`[Room.addParticipant] Error for userId=${userId} in roomId=${this.roomId}:`, error);
    throw error;
  }
};

// Method to update participant activity
roomSchema.methods.updateParticipantActivity = async function(userId) {
  try {
    const participant = this.participants.find(p => p.userId.toString() === userId.toString());
    if (participant) {
      participant.lastActive = new Date();
      console.log(`[Room.updateParticipantActivity] Updated lastActive for userId=${userId} in roomId=${this.roomId}`);
      
      const doc = await this.save();
      console.log(`[Room.updateParticipantActivity] Participant activity saved for roomId=${this.roomId}, userId=${userId}`);
      console.log('[Room.updateParticipantActivity] Saved document:', JSON.stringify(doc, null, 2));
      return doc;
    }
    console.warn(`[Room.updateParticipantActivity] No participant found for userId=${userId} in roomId=${this.roomId}`);
    return this;
  } catch (error) {
    console.error(`[Room.updateParticipantActivity] Error for userId=${userId} in roomId=${this.roomId}:`, error);
    throw error;
  }
};

// Method to update room activity
roomSchema.methods.updateActivity = async function() {
  try {
    this.lastActivity = new Date();
    this.inactiveCleanupAt = null; // Clear cleanup timer when activity occurs
    await this.save();
    console.log(`🔄 Updated activity for room ${this.roomId}`);
    return this;
  } catch (error) {
    console.error(`❌ Error updating activity for room ${this.roomId}:`, error);
    throw error;
  }
};

// Method to mark room for cleanup (when it becomes empty)
roomSchema.methods.scheduleCleanup = async function(cleanupDelayHours = 24) {
  try {
    const cleanupTime = new Date();
    cleanupTime.setHours(cleanupTime.getHours() + cleanupDelayHours);
    
    this.inactiveCleanupAt = cleanupTime;
    await this.save();
    console.log(`⏰ Scheduled cleanup for room ${this.roomId} at ${cleanupTime}`);
    return this;
  } catch (error) {
    console.error(`❌ Error scheduling cleanup for room ${this.roomId}:`, error);
    throw error;
  }
};

// Method to cancel scheduled cleanup (when users rejoin)
roomSchema.methods.cancelCleanup = async function() {
  try {
    if (this.inactiveCleanupAt) {
      this.inactiveCleanupAt = null;
      await this.save();
      console.log(`✅ Cancelled cleanup for room ${this.roomId}`);
    }
    return this;
  } catch (error) {
    console.error(`❌ Error cancelling cleanup for room ${this.roomId}:`, error);
    throw error;
  }
};

// Static method to find rooms ready for cleanup
roomSchema.statics.findRoomsForCleanup = async function() {
  const now = new Date();
  return await this.find({
    inactiveCleanupAt: { $lte: now }
  });
};

// Static method to find inactive rooms (no activity for X hours)
roomSchema.statics.findInactiveRooms = async function(inactiveHours = 48) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - inactiveHours);
  
  return await this.find({
    lastActivity: { $lte: cutoffTime },
    inactiveCleanupAt: null // Not already scheduled for cleanup
  });
};

export default mongoose.model('Room', roomSchema);
