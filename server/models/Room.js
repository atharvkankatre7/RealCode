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
  settings: {
    canEdit: { 
      type: Boolean, 
      default: true 
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

export default mongoose.model('Room', roomSchema); 