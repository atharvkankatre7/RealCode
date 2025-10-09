import Room from '../models/Room.js';

class RoomCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  // Start the cleanup service
  start() {
    if (this.isRunning) {
      console.log('🔄 Room cleanup service already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting room cleanup service');
    
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // 1 hour

    // Also run an initial cleanup
    this.performCleanup();
  }

  // Stop the cleanup service
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Room cleanup service stopped');
  }

  // Main cleanup function
  async performCleanup() {
    try {
      console.log('🧹 Running room cleanup...');

      // Step 1: Delete rooms that are scheduled for cleanup
      await this.deleteScheduledRooms();
      
      // Step 2: Schedule inactive rooms for cleanup
      await this.scheduleInactiveRooms();
      
      console.log('✅ Room cleanup completed');
    } catch (error) {
      console.error('❌ Error during room cleanup:', error);
    }
  }

  // Delete rooms that have reached their scheduled cleanup time
  async deleteScheduledRooms() {
    try {
      const roomsToDelete = await Room.findRoomsForCleanup();
      
      if (roomsToDelete.length === 0) {
        console.log('📋 No rooms scheduled for cleanup');
        return;
      }

      console.log(`🗑️ Found ${roomsToDelete.length} rooms ready for deletion`);

      for (const room of roomsToDelete) {
        try {
          console.log(`🗑️ Deleting abandoned room: ${room.roomId} (created by: ${room.createdBy}, last active: ${room.lastActivity})`);
          
          // Delete the room
          await Room.findByIdAndDelete(room._id);
          
          console.log(`✅ Successfully deleted room: ${room.roomId}`);
        } catch (error) {
          console.error(`❌ Error deleting room ${room.roomId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in deleteScheduledRooms:', error);
    }
  }

  // Schedule inactive rooms for cleanup
  async scheduleInactiveRooms() {
    try {
      // Find rooms inactive for more than 48 hours
      const inactiveRooms = await Room.findInactiveRooms(48);
      
      if (inactiveRooms.length === 0) {
        console.log('📋 No inactive rooms found');
        return;
      }

      console.log(`⏰ Found ${inactiveRooms.length} inactive rooms to schedule for cleanup`);

      for (const room of inactiveRooms) {
        try {
          // Schedule cleanup in 24 hours (giving users time to return)
          await room.scheduleCleanup(24);
          console.log(`⏰ Scheduled cleanup for inactive room: ${room.roomId}`);
        } catch (error) {
          console.error(`❌ Error scheduling cleanup for room ${room.roomId}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduleInactiveRooms:', error);
    }
  }

  // Manual cleanup for specific room
  async cleanupRoom(roomId) {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      await Room.findByIdAndDelete(room._id);
      console.log(`🗑️ Manually deleted room: ${roomId}`);
      
      return { success: true, message: `Room ${roomId} deleted successfully` };
    } catch (error) {
      console.error(`❌ Error manually cleaning up room ${roomId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get cleanup statistics
  async getCleanupStats() {
    try {
      const now = new Date();
      
      // Rooms scheduled for cleanup
      const scheduledRooms = await Room.find({
        inactiveCleanupAt: { $exists: true, $ne: null }
      });

      // Inactive rooms (not yet scheduled)
      const inactiveRooms = await Room.findInactiveRooms(48);
      
      // Recently active rooms (active in last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      const recentlyActiveRooms = await Room.find({
        lastActivity: { $gte: oneDayAgo }
      });

      // All rooms
      const totalRooms = await Room.countDocuments();

      return {
        total: totalRooms,
        recentlyActive: recentlyActiveRooms.length,
        inactive: inactiveRooms.length,
        scheduledForCleanup: scheduledRooms.length,
        scheduledRooms: scheduledRooms.map(r => ({
          roomId: r.roomId,
          createdBy: r.createdBy,
          lastActivity: r.lastActivity,
          cleanupAt: r.inactiveCleanupAt
        }))
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      return { error: error.message };
    }
  }

  // Cancel cleanup for a room (when users rejoin)
  async cancelRoomCleanup(roomId) {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      await room.cancelCleanup();
      return { success: true, message: `Cleanup cancelled for room ${roomId}` };
    } catch (error) {
      console.error(`❌ Error cancelling cleanup for room ${roomId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new RoomCleanupService();