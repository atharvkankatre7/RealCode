import express from 'express';
import Room from '../models/Room.js';
import roomCleanupService from '../services/roomCleanupService.js';

const router = express.Router();

// Get room statistics and cleanup status
router.get('/stats', async (req, res) => {
  try {
    const stats = await roomCleanupService.getCleanupStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting room stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of all rooms with their status
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    
    // Filter by status
    if (status === 'active') {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      filter.lastActivity = { $gte: oneDayAgo };
    } else if (status === 'inactive') {
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
      filter.lastActivity = { $lte: twoDaysAgo };
    } else if (status === 'scheduled') {
      filter.inactiveCleanupAt = { $exists: true, $ne: null };
    }

    const rooms = await Room.find(filter)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('roomId createdBy createdAt lastActivity inactiveCleanupAt participants currentCode.lastSaved');

    const total = await Room.countDocuments(filter);

    const roomsWithStatus = rooms.map(room => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      
      let roomStatus = 'unknown';
      if (room.inactiveCleanupAt && room.inactiveCleanupAt <= now) {
        roomStatus = 'ready_for_cleanup';
      } else if (room.inactiveCleanupAt) {
        roomStatus = 'scheduled_for_cleanup';
      } else if (room.lastActivity >= oneDayAgo) {
        roomStatus = 'active';
      } else if (room.lastActivity <= twoDaysAgo) {
        roomStatus = 'inactive';
      } else {
        roomStatus = 'moderately_active';
      }

      return {
        roomId: room.roomId,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
        cleanupScheduledAt: room.inactiveCleanupAt,
        participantCount: room.participants.length,
        lastSaved: room.currentCode?.lastSaved,
        status: roomStatus,
        hoursInactive: Math.floor((now - room.lastActivity) / (1000 * 60 * 60))
      };
    });

    res.json({
      success: true,
      rooms: roomsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting rooms list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific room details
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const now = new Date();
    const hoursInactive = Math.floor((now - room.lastActivity) / (1000 * 60 * 60));
    
    let status = 'unknown';
    if (room.inactiveCleanupAt && room.inactiveCleanupAt <= now) {
      status = 'ready_for_cleanup';
    } else if (room.inactiveCleanupAt) {
      status = 'scheduled_for_cleanup';
    } else if (hoursInactive < 24) {
      status = 'active';
    } else if (hoursInactive > 48) {
      status = 'inactive';
    } else {
      status = 'moderately_active';
    }

    res.json({
      success: true,
      room: {
        ...room.toObject(),
        status,
        hoursInactive,
        cleanupScheduledAt: room.inactiveCleanupAt
      }
    });
  } catch (error) {
    console.error('Error getting room details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manually cleanup a specific room
router.delete('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const result = await roomCleanupService.cleanupRoom(roomId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error manually cleaning up room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel scheduled cleanup for a room
router.post('/room/:roomId/cancel-cleanup', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const result = await roomCleanupService.cancelRoomCleanup(roomId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error cancelling room cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule a room for cleanup
router.post('/room/:roomId/schedule-cleanup', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { hours = 24 } = req.body;
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    await room.scheduleCleanup(parseInt(hours));
    
    res.json({
      success: true,
      message: `Room ${roomId} scheduled for cleanup in ${hours} hours`,
      cleanupAt: room.inactiveCleanupAt
    });
  } catch (error) {
    console.error('Error scheduling room cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Force cleanup of all scheduled rooms
router.post('/cleanup/run', async (req, res) => {
  try {
    await roomCleanupService.performCleanup();
    
    const stats = await roomCleanupService.getCleanupStats();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      stats
    });
  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Room recovery endpoint (allow users to claim/recover their rooms)
router.post('/room/:roomId/recover', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Check if user is the original creator
    if (room.createdBy !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only the original room creator can recover this room' 
      });
    }

    // Cancel any scheduled cleanup
    await room.cancelCleanup();
    
    // Update activity
    await room.updateActivity();
    
    res.json({
      success: true,
      message: `Room ${roomId} recovered successfully`,
      room: {
        roomId: room.roomId,
        createdBy: room.createdBy,
        lastActivity: room.lastActivity,
        cleanupCancelled: true
      }
    });
  } catch (error) {
    console.error('Error recovering room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;