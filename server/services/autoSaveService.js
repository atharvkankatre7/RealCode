import Room from '../models/Room.js';
import User from '../models/User.js';

class AutoSaveService {
  constructor() {
    this.autoSaveIntervals = new Map(); // roomId -> interval
    this.saveQueue = new Map(); // roomId -> { content, language, userId, timestamp }
    this.isConnected = false;
  }

  // Initialize database connection status
  setConnectionStatus(connected) {
    this.isConnected = connected;
  }

  // Start auto-save for a room
  startAutoSave(roomId, content, language, userId) {
    // Clear existing interval if any
    this.stopAutoSave(roomId);

    // Queue the initial save
    this.queueSave(roomId, content, language, userId);

    // Set up auto-save interval (every 30 seconds)
    const interval = setInterval(() => {
      const queuedSave = this.saveQueue.get(roomId);
      if (queuedSave) {
        this.performSave(roomId, queuedSave.content, queuedSave.language, queuedSave.userId);
        this.saveQueue.delete(roomId);
      }
    }, 30000); // 30 seconds

    this.autoSaveIntervals.set(roomId, interval);
    console.log(`🔄 Auto-save started for room: ${roomId}`);
  }

  // Stop auto-save for a room
  stopAutoSave(roomId) {
    const interval = this.autoSaveIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.autoSaveIntervals.delete(roomId);
      console.log(`⏹️  Auto-save stopped for room: ${roomId}`);
    }
  }

  // Queue a save operation
  queueSave(roomId, content, language, userId) {
    this.saveQueue.set(roomId, {
      content,
      language,
      userId,
      timestamp: Date.now()
    });
  }

  // Perform immediate save (for Ctrl+S)
  async manualSave(roomId, content, language, userId) {
    if (!this.isConnected) {
      console.log('⚠️  Database not connected, skipping save');
      return { success: false, error: 'Database not connected' };
    }

    try {
      const result = await this.performSave(roomId, content, language, userId);
      console.log(`💾 Manual save completed for room: ${roomId}`);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Manual save failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Perform the actual save operation
  async performSave(roomId, content, language, userId) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      console.log(`[AutoSave] Starting save operation for room: ${roomId}`);
      
      // Find or create room
      let room = await Room.findOne({ roomId });
      
      if (!room) {
        // Create new room
        console.log(`[AutoSave] Room not found, creating new room: ${roomId}`);
        room = new Room({
          roomId,
          createdBy: userId || 'unknown',
          currentCode: {
            content,
            language: language || 'javascript',
            lastSaved: new Date(),
            lastSavedBy: userId || 'unknown'
          }
        });
        
        try {
          await room.save();
          console.log(`[AutoSave] New room created successfully: ${roomId}`);
        } catch (saveError) {
          console.error(`[AutoSave] Error saving new room: ${roomId}`, saveError);
          throw saveError;
        }
      } else {
        // Update existing room
        console.log(`[AutoSave] Room found, updating existing room: ${roomId}`);
        try {
          await room.saveCode(content, language, userId);
          console.log(`[AutoSave] Room updated successfully: ${roomId}`);
        } catch (updateError) {
          console.error(`[AutoSave] Error updating room: ${roomId}`, updateError);
          throw updateError;
        }
      }

      // Update participant activity
      try {
        await room.updateParticipantActivity(userId);
        console.log(`[AutoSave] Participant activity updated for room: ${roomId}`);
      } catch (activityError) {
        console.error(`[AutoSave] Error updating participant activity for room: ${roomId}`, activityError);
        // Don't throw here as the main save was successful
      }

      return {
        roomId,
        lastSaved: room.currentCode.lastSaved,
        savedBy: room.currentCode.lastSavedBy
      };
    } catch (error) {
      console.error(`[AutoSave] Save operation failed for room: ${roomId}`, error);
      console.error(`[AutoSave] Error details:`, {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      
      // Check specific error types
      if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
        console.error(`[AutoSave] Database connection error for room: ${roomId} - MongoDB may not be running`);
      } else if (error.name === 'ValidationError') {
        console.error(`[AutoSave] Validation error for room: ${roomId} - check the data being saved`);
      } else if (error.name === 'CastError') {
        console.error(`[AutoSave] Cast error for room: ${roomId} - check the data types being saved`);
      }
      
      throw error;
    }
  }

  // Load saved code for a room
  async loadSavedCode(roomId, userId) {
    if (!this.isConnected) {
      console.log('⚠️  Database not connected, using default code');
      return {
        content: '// Start coding here...',
        language: 'javascript',
        lastSaved: null
      };
    }

    try {
      const room = await Room.findOne({ roomId });
      
      if (room) {
        // Update participant activity
        await room.updateParticipantActivity(userId);
        
        return {
          content: room.currentCode.content,
          language: room.currentCode.language,
          lastSaved: room.currentCode.lastSaved
        };
      } else {
        return {
          content: '// Start coding here...',
          language: 'javascript',
          lastSaved: null
        };
      }
    } catch (error) {
      console.error('❌ Load saved code failed:', error);
      return {
        content: '// Start coding here...',
        language: 'javascript',
        lastSaved: null
      };
    }
  }

  // Get save status for a room
  getSaveStatus(roomId) {
    const queuedSave = this.saveQueue.get(roomId);
    const hasAutoSave = this.autoSaveIntervals.has(roomId);
    
    return {
      hasAutoSave,
      hasQueuedSave: !!queuedSave,
      lastQueuedSave: queuedSave?.timestamp || null
    };
  }

  // Cleanup on room disconnect
  cleanupRoom(roomId) {
    this.stopAutoSave(roomId);
    this.saveQueue.delete(roomId);
    console.log(`🧹 Cleaned up auto-save for room: ${roomId}`);
  }
}

export default new AutoSaveService(); 