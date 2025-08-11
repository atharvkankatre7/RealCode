// server/sockets/room.js

import autoSaveService from '../services/autoSaveService.js';
import Room from '../models/Room.js';

// Simple in-memory data store for rooms
const rooms = {};

// Initialize a room with default code
export function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: [],
      files: { 'main': "// Start coding..." }, // Default file 'main'
      teacherId: null, // Store the teacher's user ID for persistent role assignment
      roomPermission: false, // RBAC: Room-wide permission (false = students can't edit)
      studentList: [], // Store detailed student information
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    console.log(`Room ${roomId} created with RBAC permission system and multi-file support`);
  }
  return rooms[roomId];
}

// Log the current state of all rooms (for debugging)
function logRoomsState() {
  console.log('Current rooms state:',
    Object.keys(rooms).map(roomId => ({
      roomId,
      userCount: rooms[roomId].users.length,
      codeLength: rooms[roomId].files['main'].length,
      teacherId: rooms[roomId].teacherId
    }))
  );
}

// RBAC: Enhanced emit function for reliable user list broadcasting
function emitRoomUsersUpdated(io, roomId) {
  const room = rooms[roomId];
  if (!room) {
    console.warn(`⚠️ [EMIT_USERS] Room ${roomId} not found`);
    return;
  }

  const users = room.users.map((user) => ({
    username: user.username,
    role: user.role,
    socketId: user.socketId,
    userId: user.userId,
    canEdit: user.role === 'teacher' || room.roomPermission, // Teachers always can edit, students based on room permission
    lastSeen: user.lastSeen || new Date().toISOString()
  }));

  // Throttle: allow at most one emit every 500 ms per room
  const now = Date.now();
  if (!emitRoomUsersUpdated.lastEmit) emitRoomUsersUpdated.lastEmit = {};
  if (emitRoomUsersUpdated.lastEmit[roomId] && now - emitRoomUsersUpdated.lastEmit[roomId] < 500) {
    return; // Skip to avoid flooding
  }
  emitRoomUsersUpdated.lastEmit[roomId] = now;

  console.log(`📤 [EMIT_USERS] Broadcasting user list to room ${roomId}: ${users.length} users`);

  // Emit to ALL users in the room
  io.to(roomId).emit("room-users-updated", {
    users,
    count: users.length,
    roomId,
    timestamp: new Date().toISOString(),
    event: 'users-updated'
  });

  // Also emit update-user-list for comprehensive coverage
  io.to(roomId).emit("update-user-list", {
    users,
    timestamp: new Date().toISOString(),
    triggeredBy: 'room-users-updated',
    roomId
  });

  console.log(`✅ [EMIT_USERS] Successfully broadcasted user list to ${users.length} users in room ${roomId}`);
}

// RBAC: Simple room-wide permission management
function toggleRoomPermission(roomId) {
  console.log(`📝 [ROOM_PERMISSION] Toggling room permission for room ${roomId}`);

  const room = rooms[roomId];
  if (!room) {
    const error = `Room ${roomId} not found`;
    console.error(`❌ [ROOM_PERMISSION] ${error}`);
    return { success: false, error };
  }

  // Toggle room permission (default is false - students can't edit)
  room.roomPermission = !room.roomPermission;

  console.log(`✅ [ROOM_PERMISSION] Room ${roomId} permission toggled to: ${room.roomPermission}`);

  return {
    success: true,
    roomId,
    canEdit: room.roomPermission,
    timestamp: new Date().toISOString()
  };
}

// Get room permission state
function getRoomPermission(roomId) {
  const room = rooms[roomId];
  if (!room) return false;

  // Default to false (students can't edit) if not set
  return room.roomPermission || false;
}

// RBAC: Get edit permission for a user based on role and room permission
function getEditPermission(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return false;

  // Find the user
  const user = room.users.find(u => u.socketId === socketId);
  if (!user) return false;

  // Teachers can always edit, students based on room permission
  return user.role === 'teacher' || room.roomPermission;
}

// RBAC: No need to remove individual permissions on disconnect
// Room permission persists regardless of user connections

// Update student list with permission info
function updateStudentList(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // DEBUG: Log all users in the room before filtering
  console.log(`[DEBUG] updateStudentList: room.users for room ${roomId}:`, JSON.stringify(room.users, null, 2));

  room.studentList = room.users
    .filter(user => user.role === 'student')
    .map(user => ({
      socketId: user.socketId,
      username: user.username,
      userId: user.userId,
      email: user.email || null,
      canEdit: room.roomPermission, // RBAC: All students have same permission
      joinedAt: user.joinedAt || new Date().toISOString(),
      lastActivity: user.lastActivity || new Date().toISOString()
    }));

  // DEBUG: Log the resulting studentList
  console.log(`[DEBUG] updateStudentList: studentList for room ${roomId}:`, JSON.stringify(room.studentList, null, 2));

  console.log(`Updated student list for room ${roomId}:`, room.studentList.length, 'students');
}

// RBAC: No individual permission functions needed
// Room permission applies to all students uniformly

// Get student list for teacher
function getStudentList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];

  updateStudentList(roomId);
  return room.studentList;
}

// Check if user is teacher
function isTeacher(roomId, userId, _socketId) {
  const room = rooms[roomId];
  if (!room) return false;

  // Check by userId first (persistent), then by being the first user
  if (room.teacherId === userId) return true;

  // If no teacher set and this is the first user, make them teacher
  if (!room.teacherId && room.users.length === 1) {
    room.teacherId = userId;
    return true;
  }

  return false;
}

// Export RBAC functions for use in other modules
export { toggleRoomPermission, getRoomPermission, getEditPermission, getStudentList, isTeacher, updateStudentList };

// Get complete room state for synchronization
function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) {
    return null;
  }

  return {
    files: room.files,
    users: room.users.map(user => ({
      socketId: user.socketId,
      username: user.username,
      userId: user.userId,
      role: user.role,
      canEdit: getEditPermission(roomId, user.socketId),
      lastSeen: user.lastSeen || new Date().toISOString()
    })),
    permissions: {
      canEdit: room.roomPermission || false,
      roomPermission: room.roomPermission || false
    },
    lastUpdated: new Date().toISOString(),
    roomId
  };
}

// Throttle map to prevent spamming room-state broadcasts
const lastBroadcastTimes = {};

// Broadcast room state to all users (throttled to once every 500 ms per room)
function broadcastRoomState(io, roomId, eventType = 'room-state-update') {
  const now = Date.now();
  if (lastBroadcastTimes[roomId] && now - lastBroadcastTimes[roomId] < 500) {
    // Too soon since last broadcast – skip to avoid log/emit flood
    return;
  }
  lastBroadcastTimes[roomId] = now;

  const state = getRoomState(roomId);
  if (!state) {
    console.warn(`⚠️ [ROOM_STATE] Cannot broadcast - room ${roomId} not found`);
    return;
  }

  // console.log(`📤 [ROOM_STATE] Broadcasting ${eventType} to room ${roomId}`);
  // Always include top-level canEdit for room-permission-changed events
  const payload = {
    state,
    timestamp: new Date().toISOString(),
    eventType
  };
  if (eventType === 'room-permission-changed') {
    // Try to get canEdit from state.permissions or fallback to false
    payload.canEdit = state?.permissions?.canEdit ?? false;
  }
  io.to(roomId).emit(eventType, payload);
}

// --- MULTI-FILE SUPPORT: Store code per file in each room ---
// Each room now has a 'files' object: { [fileId]: code }
const codeChangeThrottle = {};

function canEmitCodeChange(roomId, fileId) {
  const key = `${roomId}:${fileId}`;
  const now = Date.now();
  if (!codeChangeThrottle[key] || now - codeChangeThrottle[key] > 100) {
    codeChangeThrottle[key] = now;
    return true;
  }
  return false;
}

export const registerRoomHandlers = (io, socket) => {
  // Create a new room
  socket.on("create-room", ({ username, roomId: customRoomId, userId }, callback) => {
    try {
      // Use exactly the username provided by the user without any modifications
      // This ensures we use exactly what the user entered on the dashboard
      const validUsername = username;

      // Validate userId
      const validUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Always use the provided room ID (which should be randomly generated on the client)
      const roomId = customRoomId || `${Math.random().toString(36).substring(2, 11)}`;
      console.log(`${validUsername} (${validUserId}) creating room: ${roomId}`);

      // Join the socket.io room
      socket.join(roomId);

      // Initialize room and add user
      const room = getRoom(roomId);

      // Set the teacher ID if not already set (room creator becomes the permanent teacher)
      if (!room.teacherId) {
        room.teacherId = validUserId;
        console.log(`Set teacherId to ${validUserId} for room ${roomId}`);
      }

      // Check if user already exists in the room
      const existingUserIndex = room.users.findIndex((u) => u.userId === validUserId);

      let role;
      if (existingUserIndex === -1) {
        // For create-room, the user is always the teacher (room creator)
        role = "teacher";

        // Add user to the room with the assigned role
        room.users.push({
          socketId: socket.id,
          username: validUsername,
          userId: validUserId,
          role, // Add the role to the user object
        });
      } else {
        // Update existing user's socket ID and ensure they have teacher role
        room.users[existingUserIndex].socketId = socket.id;
        room.users[existingUserIndex].role = "teacher"; // Ensure creator is teacher
        role = "teacher";
      }

      // Store user info on the socket for easy access
      socket.username = validUsername;
      socket.userId = validUserId;
      socket.currentRoomId = roomId;
      socket.role = role; // Store the role on the socket

      console.log(`Set role to ${role} for ${validUsername} (${validUserId}) in room ${roomId}`);
      // Send success response with room ID, username, and role
      callback({ roomId, username: validUsername, role, users: room.users });
      console.log(`Room ${roomId} created by ${validUsername} (${validUserId})`);
      logRoomsState();
    } catch (error) {
      console.error(`Error creating room:`, error);
      callback({ error: `Failed to create room: ${error.message}` });
    }
  })

  // Add a new handler to validate if a room exists
  socket.on("validate-room", ({ roomId }, callback) => {
    if (!roomId) {
      return callback({ exists: false });
    }

    const roomExists = !!rooms[roomId];
    callback({ exists: roomExists });
  });

  // Update the join-room handler to validate room existence
  socket.on("join-room", ({ roomId, username, userId }, callback) => {
    if (!roomId) {
      return callback({ error: "Room ID is required" });
    }

    try {
      const validUsername = username;
      const validUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      console.log(`${validUsername} (${validUserId}) attempting to join room: ${roomId}`);

      // Check if the room exists
      if (!rooms[roomId]) {
        console.error(`Room ${roomId} does not exist`);
        return callback({ error: "Room does not exist" });
      }

      // Proceed with joining the room
      const room = getRoom(roomId);
      socket.join(roomId);

      const existingUserIndex = room.users.findIndex((u) => u.userId === validUserId);
      let userRole;

      // Determine role based on whether this user is the teacher
      const isTeacher = room.teacherId === validUserId;

      if (existingUserIndex === -1) {
        // New user joining - assign role based on teacher ID
        userRole = isTeacher ? "teacher" : "student";
        room.users.push({
          socketId: socket.id,
          username: validUsername,
          userId: validUserId,
          role: userRole,
        });
        console.log(`New user ${validUsername} (${validUserId}) joined as ${userRole} in room ${roomId}`);
      } else {
        // Existing user reconnecting - assign role based on teacher ID (not stored role)
        userRole = isTeacher ? "teacher" : "student";
        room.users[existingUserIndex].socketId = socket.id;
        room.users[existingUserIndex].role = userRole; // Update role to ensure consistency
        console.log(`Existing user ${validUsername} (${validUserId}) reconnected as ${userRole} in room ${roomId}`);
      }

      socket.username = validUsername;
      socket.userId = validUserId;
      socket.currentRoomId = roomId;
      socket.role = userRole;

      console.log(`${validUsername} (${validUserId}) joined room: ${roomId}`);
      callback({ success: true, users: room.users, role: userRole, username: validUsername });

      // RELIABLE BROADCASTING: Always emit user updates
      const isNewUser = existingUserIndex === -1;

      // Emit the updated list of users to ALL users in room
      emitRoomUsersUpdated(io, roomId);

      // ALWAYS broadcast user-joined event for reliable updates
      if (isNewUser) {
        console.log(`📢 [JOIN] Broadcasting user-joined event for ${validUsername} to all users in room ${roomId}`);

        // Emit to all OTHER users in the room (not the joining user)
        socket.to(roomId).emit('user-joined', {
          newUserSocketId: socket.id,
          newUserName: validUsername,
          newUserId: validUserId,
          newUserRole: userRole,
          allUsers: room.users,
          timestamp: new Date().toISOString(),
          totalUsers: room.users.length
        });

        console.log(`✅ [JOIN] Broadcasted user-joined to ${room.users.length - 1} existing users`);
      }

      // Request initial code from existing users if this is a new user
      if (isNewUser && room.users.length > 1) {
        console.log(`📥 [JOIN] Requesting initial code for new user ${validUsername} in room ${roomId}`);
        socket.to(roomId).emit('get-initial-code', {
          requestingUserId: validUserId,
          requestingUsername: validUsername
        });
      }

      // Send initial edit permission to the new user
      const canEdit = getEditPermission(roomId, socket.id);
      socket.emit('edit-permission', { canEdit });
      console.log(`Sent initial edit permission to ${validUsername}: ${canEdit}`);

      // NEW: Always broadcast full room state after join
      broadcastRoomState(io, roomId, isNewUser ? 'user-joined' : 'user-reconnected');
    } catch (error) {
      console.error("Error in join-room handler:", error);
      callback({ error: `Failed to join room: ${error.message}` });
    }
  })

  // RBAC: Handle room permission toggle (teacher only)
  socket.on("toggle-room-permission", ({ roomId }, callback) => {
    console.log(`📥 [RBAC] Room permission toggle request:`, { roomId, teacherSocket: socket.id });

    if (!roomId) {
      const error = 'Room ID is required';
      console.error(`❌ [RBAC] ${error}`);
      if (callback) callback({ success: false, error });
      return;
    }

    try {
      const room = getRoom(roomId);
      if (!room) {
        const error = `Room ${roomId} not found`;
        console.error(`❌ [RBAC] ${error}`);
        if (callback) callback({ success: false, error });
        return;
      }

      // Validate teacher authorization
      let teacher = room.users.find(u => u.socketId === socket.id);
      if (!teacher && socket.userId) {
        teacher = room.users.find(u => u.userId === socket.userId);
      }

      if (!teacher || teacher.role !== 'teacher') {
        const error = `Only teachers can toggle room permissions. User: ${teacher?.username || 'unknown'}, Role: ${teacher?.role || 'unknown'}`;
        console.error(`❌ [RBAC_SECURITY] Unauthorized toggle attempt:`, {
          socketId: socket.id,
          username: teacher?.username,
          role: teacher?.role,
          roomId,
          timestamp: new Date().toISOString()
        });
        if (callback) callback({ success: false, error });
        return;
      }

      // Toggle room permission
      const result = toggleRoomPermission(roomId);
      if (!result.success) {
        console.error(`❌ [RBAC] Failed to toggle room permission:`, result.error);
        if (callback) callback(result);
        return;
      }

      // Send confirmation to teacher
      if (callback) {
        callback({
          success: true,
          canEdit: result.canEdit,
          roomId: result.roomId,
          timestamp: result.timestamp
        });
      }

      // Emit room-permission-changed to all users in the room
      let lastPermissionEmit = {};
      if (typeof result.canEdit === 'boolean') {
        // Throttle emission to once every 100ms per room
        const now = Date.now();
        if (!lastPermissionEmit[roomId] || now - lastPermissionEmit[roomId] > 100) {
          lastPermissionEmit[roomId] = now;
          const eventObj = {
            canEdit: result.canEdit,
            changedBy: teacher.username,
            timestamp: result.timestamp,
            roomId
          };
          console.log('[SERVER][RBAC] Emitting room-permission-changed event:', JSON.stringify(eventObj, null, 2));
          io.to(roomId).emit('room-permission-changed', eventObj);
        } else {
          console.warn('[SERVER][RBAC] Skipped room-permission-changed emit due to throttle:', roomId);
        }
      } else {
        console.warn('[SERVER][RBAC] Not emitting room-permission-changed: canEdit is not boolean', result);
      }

      // Update student list for teachers
      const studentList = getStudentList(roomId);
      room.users.filter(u => u.role === 'teacher').forEach(t => {
        io.to(t.socketId).emit('update-student-list', { students: studentList });
      });

      // Emit updated user list to all users
      const allUsers = room.users.map(u => ({
        socketId: u.socketId,
        username: u.username,
        userId: u.userId,
        role: u.role,
        canEdit: getEditPermission(roomId, u.socketId),
        lastUpdated: new Date().toISOString()
      }));
      io.to(roomId).emit('update-user-list', {
        users: allUsers,
        timestamp: new Date().toISOString(),
        triggeredBy: 'room-permission-toggle'
      });

      // NEW: Always broadcast full room state after permission toggle
      broadcastRoomState(io, roomId, 'room-permission-changed');

      console.log(`✅ [RBAC] Room ${roomId} permission toggled to ${result.canEdit} by ${teacher.username}`);
    } catch (error) {
      console.error(`💥 [RBAC] Error handling toggle-room-permission:`, error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  // RBAC: Old individual permission handlers removed
  // Use toggle-room-permission instead

  // RBAC: Individual grant permission removed - use toggle-room-permission

  // RBAC: Individual revoke permission removed - use toggle-room-permission

  // Handle real-time code changes (broadcast to all users including view-only)
  socket.on("code-change", async (data) => {
    // Log the entire incoming payload for debugging
    console.log("[SOCKET] code-change received:", data);
    const { roomId, fileId = 'main', code, userId, username, timestamp } = data;
    if (!roomId || !code) {
      console.log("[SOCKET] Missing roomId or code.", { roomId, code });
      return;
    }
    try {
      // Attempt to update the DB and log the query and update
      console.log("[SOCKET] Attempting DB update:", {
        query: { roomId },
        update: {
          "currentCode.content": code,
          "currentCode.lastSaved": new Date(),
          "currentCode.lastSavedBy": userId
        }
      });
      
      // First, try to find the room to see if it exists
      let room = await Room.findOne({ roomId });
      
      if (!room) {
        // Room doesn't exist, create it
        console.log("[SOCKET] Room not found, creating new room:", roomId);
        room = new Room({
          roomId,
          createdBy: userId || 'unknown',
          currentCode: {
            content: code,
            language: 'javascript', // default language
            lastSaved: new Date(),
            lastSavedBy: userId || 'unknown'
          }
        });
        await room.save();
        console.log("[SOCKET] New room created successfully:", roomId);
      } else {
        // Room exists, update it
        console.log("[SOCKET] Room found, updating existing room:", roomId);
        const result = await Room.findOneAndUpdate(
          { roomId },
          {
            "currentCode.content": code,
            "currentCode.lastSaved": new Date(),
            "currentCode.lastSavedBy": userId
          },
          { new: true, upsert: false }
        );
        console.log("[SOCKET] Room updated successfully:", result ? "yes" : "no");
      }
      
      // Broadcast to all other users in the room (including view-only)
      if (canEmitCodeChange(roomId, fileId)) {
        socket.to(roomId).emit("code-change", {
          code,
          fileId,
          userId,
          username,
          roomId,
          timestamp: timestamp || Date.now()
        });
        socket.to(roomId).emit("code-update", { code, fileId });
      }
    } catch (err) {
      console.error("[SOCKET] Mongo update ERROR:", err);
      console.error("[SOCKET] Error details:", {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack
      });
      
      // Check if it's a connection error
      if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
        console.error("[SOCKET] Database connection error - MongoDB may not be running");
      }
      
      // Check if it's a validation error
      if (err.name === 'ValidationError') {
        console.error("[SOCKET] Validation error - check the data being saved");
      }
      
      // Check if it's a cast error
      if (err.name === 'CastError') {
        console.error("[SOCKET] Cast error - check the data types being saved");
      }
    }
  });

  // Handle manual save (Ctrl+S)
  socket.on("manual-save", async (data) => {
    const { roomId, code, language, userId } = data;
    if (!roomId || code === undefined || !userId) {
      return console.error(`Invalid manual-save data:`, data);
    }
    
    try {
      console.log(`💾 Manual save requested for room ${roomId} by user ${userId}`);
      
      const result = await autoSaveService.manualSave(roomId, code, language, userId);
      
      if (result.success) {
        // Notify the user that save was successful
        socket.emit("save-status", {
          success: true,
          message: "Code saved successfully",
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Manual save completed for room ${roomId}`);
      } else {
        // Notify the user that save failed
        socket.emit("save-status", {
          success: false,
          message: result.error || "Save failed",
          timestamp: new Date().toISOString()
        });
        console.log(`❌ Manual save failed for room ${roomId}: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error handling manual-save for room ${roomId}:`, error);
      socket.emit("save-status", {
        success: false,
        message: "Save failed due to server error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle initial code response from existing users
  socket.on("send-initial-code", ({ roomId, code, requestingUserId }) => {
    if (!roomId || code === undefined || !requestingUserId) {
      return console.error(`Invalid send-initial-code payload:`, { roomId, code, requestingUserId });
    }

    try {
      console.log(`Sending initial code to user ${requestingUserId} in room ${roomId}, code length: ${code.length}`);

      // Find the requesting user's socket and send them the code
      const room = getRoom(roomId);
      const requestingUser = room.users.find(user => user.userId === requestingUserId);

      if (requestingUser) {
        // Send the initial code only to the requesting user
        io.to(requestingUser.socketId).emit("initial-code-received", { code });
        console.log(`Initial code sent to ${requestingUser.username} (${requestingUserId})`);

        // Update the room's stored code if this is more recent
        room.files['main'] = code;
      } else {
        console.log(`Requesting user ${requestingUserId} not found in room ${roomId}`);
      }
    } catch (error) {
      console.error(`Error handling send-initial-code for room ${roomId}:`, error);
    }
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    const roomId = socket.currentRoomId;
    if (roomId) {
      const room = getRoom(roomId);
      room.users = room.users.filter((user) => user.socketId !== socket.id);

      // Cleanup auto-save for this room if no users left
      if (room.users.length === 0) {
        autoSaveService.cleanupRoom(roomId);
        console.log(`🧹 Cleaned up auto-save for empty room ${roomId}`);
      }

      // Emit updated user list
      emitRoomUsersUpdated(io, roomId);

      // NEW: Always broadcast full room state after disconnect
      broadcastRoomState(io, roomId, 'user-disconnected');
    }
  });

  // Handle real-time annotation highlights
  socket.on("highlight-line", ({ roomId, startLine, endLine, comment }) => {
    if (!roomId || typeof startLine !== 'number' || typeof endLine !== 'number') {
      return console.error(`Invalid highlight-line payload:`, { roomId, startLine, endLine, comment });
    }
    try {
      // Broadcast to all other users in the room
      socket.to(roomId).emit("highlight-line", { startLine, endLine, comment });
      console.log(`Broadcasted highlight-line to room ${roomId}: lines ${startLine}-${endLine}${comment ? ' with comment' : ''}`);
    } catch (error) {
      console.error(`Error handling highlight-line for room ${roomId}:`, error);
    }
  });

  // Handle teacher text selection highlighting
  socket.on("teacher-selection", ({ roomId, selection }) => {
    if (!roomId || !selection) {
      return console.error(`Invalid teacher-selection payload:`, { roomId, selection });
    }

    try {
      // Get the room to verify the user is a teacher
      const room = getRoom(roomId);
      // Try to find user by socketId, fallback to userId if not found
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to send teacher selection`);
        return;
      }
      // Broadcast teacher selection to all students in the room
      socket.to(roomId).emit("teacher-selection", {
        selection,
        teacherName: user.username,
        teacherId: user.userId
      });
      console.log(`Teacher ${user.username} highlighted selection in room ${roomId}:`, selection);
    } catch (error) {
      console.error(`Error handling teacher-selection for room ${roomId}:`, error);
    }
  });

  // Handle clearing teacher selection
  socket.on("clear-teacher-selection", ({ roomId }) => {
    if (!roomId) {
      return console.error(`Invalid clear-teacher-selection payload:`, { roomId });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to clear teacher selection`);
        return;
      }
      socket.to(roomId).emit("clear-teacher-selection", {
        teacherName: user.username,
        teacherId: user.userId
      });
      console.log(`Teacher ${user.username} cleared selection in room ${roomId}`);
    } catch (error) {
      console.error(`Error handling clear-teacher-selection for room ${roomId}:`, error);
    }
  });

  // Handle teacher cursor position updates
  socket.on("teacher-cursor-position", ({ roomId, position }) => {
    if (!roomId || !position) {
      return console.error(`Invalid teacher-cursor-position payload:`, { roomId, position });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to send teacher cursor position`);
        return;
      }
      socket.to(roomId).emit("teacher-cursor-position", {
        position,
        teacherName: user.username,
        teacherId: user.userId
      });
    } catch (error) {
      console.error(`Error handling teacher-cursor-position for room ${roomId}:`, error);
    }
  });

  // Handle teacher text selection highlighting (enhanced version)
  socket.on("teacher-text-highlight", ({ roomId, selection }) => {
    if (!roomId || !selection) {
      return console.error(`Invalid teacher-text-highlight payload:`, { roomId, selection });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to send teacher text highlight`);
        return;
      }
      socket.to(roomId).emit("teacher-text-highlight", {
        selection,
        teacherName: user.username,
        teacherId: user.userId
      });
      console.log(`Teacher ${user.username} highlighted text in room ${roomId}:`, selection);
    } catch (error) {
      console.error(`Error handling teacher-text-highlight for room ${roomId}:`, error);
    }
  });

  // Handle clearing teacher text highlight
  socket.on("clear-teacher-text-highlight", ({ roomId }) => {
    if (!roomId) {
      return console.error(`Invalid clear-teacher-text-highlight payload:`, { roomId });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to clear teacher text highlight`);
        return;
      }
      socket.to(roomId).emit("clear-teacher-text-highlight", {
        teacherName: user.username,
        teacherId: user.userId
      });
      console.log(`Teacher ${user.username} cleared text highlight in room ${roomId}`);
    } catch (error) {
      console.error(`Error handling clear-teacher-text-highlight for room ${roomId}:`, error);
    }
  });

  // Enhanced teacher request for student list with cleanup
  socket.on("request-student-list", ({ roomId }) => {
    if (!roomId) {
      return console.error(`Invalid request-student-list payload:`, { roomId });
    }

    try {
      // Get the room and verify the user is a teacher
      const room = getRoom(roomId);
      if (!room) {
        console.error(`❌ [REQUEST_STUDENTS] Room ${roomId} not found`);
        return;
      }

      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`❌ [REQUEST_STUDENTS] Non-teacher user ${user?.username || 'unknown'} attempted to request student list`);
        return;
      }

      console.log(`📥 [REQUEST_STUDENTS] Teacher ${user.username} requesting student list for room ${roomId}`);

      // Clean up any disconnected users before sending the list
      const connectedSockets = Array.from(io.sockets.sockets.keys());
      const originalUserCount = room.users.length;

      room.users = room.users.filter(u => {
        const isConnected = connectedSockets.includes(u.socketId);
        if (!isConnected) {
          console.log(`🧹 [REQUEST_STUDENTS] Removing disconnected user: ${u.username} (${u.socketId})`);
        }
        return isConnected;
      });

      const cleanedUserCount = room.users.length;
      if (originalUserCount !== cleanedUserCount) {
        console.log(`🧹 [REQUEST_STUDENTS] Cleaned up ${originalUserCount - cleanedUserCount} disconnected users`);
      }

      // Send current student list to the requesting teacher
      const studentList = getStudentList(roomId);
      socket.emit('update-student-list', { students: studentList });

      // Also send updated user list to all users in room
      const allUsers = room.users.map(u => ({
        socketId: u.socketId,
        username: u.username,
        userId: u.userId,
        role: u.role,
        canEdit: getEditPermission(roomId, u.socketId),
        lastUpdated: new Date().toISOString()
      }));

      io.to(roomId).emit('update-user-list', {
        users: allUsers,
        timestamp: new Date().toISOString(),
        triggeredBy: 'student-list-request'
      });

      console.log(`✅ [REQUEST_STUDENTS] Sent student list to teacher ${user.username}: ${studentList.length} students, ${allUsers.length} total users`);
    } catch (error) {
      console.error(`💥 [REQUEST_STUDENTS] Error handling request-student-list for room ${roomId}:`, error);
    }
  });

  // Handle syncing current code to a specific user
  socket.on("sync-code", ({ roomId, code, targetSocketId }) => {
    if (!roomId || code === undefined || !targetSocketId) {
      return console.error(`Invalid sync-code payload:`, { roomId, code, targetSocketId });
    }
    try {
      console.log(`Syncing code to user ${targetSocketId} in room ${roomId}, code length: ${code.length}`);
      // Send code directly to the target socket
      io.to(targetSocketId).emit("sync-code", { code });
    } catch (error) {
      console.error(`Error handling sync-code for room ${roomId}:`, error);
    }
  });

  // Handle syncing current teacher selection to a specific user
  socket.on("sync-teacher-selection", ({ roomId, selection, targetSocketId }) => {
    if (!roomId || !selection || !targetSocketId) {
      return console.error(`Invalid sync-teacher-selection payload:`, { roomId, selection, targetSocketId });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to sync teacher selection`);
        return;
      }
      console.log(`Syncing teacher selection to user ${targetSocketId} in room ${roomId}`);
      // Send selection directly to the target socket
      io.to(targetSocketId).emit("sync-teacher-selection", {
        selection,
        teacherName: user.username,
        teacherId: user.userId
      });
    } catch (error) {
      console.error(`Error handling sync-teacher-selection for room ${roomId}:`, error);
    }
  });

  // Handle syncing current teacher cursor to a specific user
  socket.on("sync-teacher-cursor", ({ roomId, position, targetSocketId }) => {
    if (!roomId || !position || !targetSocketId) {
      return console.error(`Invalid sync-teacher-cursor payload:`, { roomId, position, targetSocketId });
    }
    try {
      const room = getRoom(roomId);
      let user = room.users.find(u => u.socketId === socket.id);
      if (!user && socket.userId) {
        user = room.users.find(u => u.userId === socket.userId);
      }
      if (!user || user.role !== 'teacher') {
        console.log(`Non-teacher user ${user?.username || 'unknown'} attempted to sync teacher cursor`);
        return;
      }
      console.log(`Syncing teacher cursor to user ${targetSocketId} in room ${roomId}`);
      // Send cursor position directly to the target socket
      io.to(targetSocketId).emit("sync-teacher-cursor", {
        position,
        teacherName: user.username,
        teacherId: user.userId
      });
    } catch (error) {
      console.error(`Error handling sync-teacher-cursor for room ${roomId}:`, error);
    }
  });

  // Handle typing notifications - single handler only
  socket.on("typing", ({ roomId, userId }) => {
    if (!roomId) return;

    try {
      const room = rooms[roomId];
      if (!room) return;

      // Get username by userId lookup for consistency
      let username = socket.username || socket.id;
      
      if (userId) {
        const user = room.users.find(u => u.userId === userId);
        if (user) {
          username = user.username;
        }
      } else if (socket.userId) {
        const user = room.users.find(u => u.userId === socket.userId);
        if (user) {
          username = user.username;
        }
      } else {
        const user = room.users.find(u => u.socketId === socket.id);
        if (user) {
          username = user.username;
        }
      }

      // Broadcast single typing event to other clients
      socket.to(roomId).emit("user-typing", { username });
    } catch (error) {
      console.error(`Error handling typing notification:`, error);
    }
  })

  // Cursor/caret presence feature removed intentionally

  // Handle user leaving a room
  socket.on("leave-room", (roomId) => {
    if (!roomId) return;

    try {
      // Get the room
      const room = rooms[roomId];
      if (!room) return;

      // Find the user by userId if available, otherwise by socketId
      let userIndex = -1;
      if (socket.userId) {
        userIndex = room.users.findIndex(u => u.userId === socket.userId);
      }

      // Fallback to socketId if userId not found
      if (userIndex === -1) {
        userIndex = room.users.findIndex(u => u.socketId === socket.id);
      }

      if (userIndex === -1) return;

      const user = room.users[userIndex];
      console.log(`${user.username} (${user.userId}) leaving room ${roomId}`);

      // Remove the user from the room
      room.users.splice(userIndex, 1);

      // Leave the socket.io room
      socket.leave(roomId);

      // Clear room info from socket
      if (socket.currentRoomId === roomId) {
        socket.currentRoomId = null;
      }

      // Notify remaining users
      io.to(roomId).emit("user-left", room.users);

      // Emit the updated list of users
      emitRoomUsersUpdated(io, roomId);

      // NEW: Always broadcast full room state after leave
      broadcastRoomState(io, roomId, 'user-left');

      // Clean up empty rooms
      if (room.users.length === 0) {
        console.log(`Room ${roomId} is now empty, cleaning up`);
        delete rooms[roomId];
      }

      logRoomsState();
    } catch (error) {
      console.error(`Error leaving room:`, error);
    }
  })

  // Handle room state requests for synchronization
  socket.on("request-room-state", ({ roomId }, callback) => {
    // console.log(`📥 [ROOM_STATE] State requested for room ${roomId} by ${socket.id}`);

    try {
      const state = getRoomState(roomId);

      if (state) {
        // console.log(`✅ [ROOM_STATE] Sending state for room ${roomId}`);
        if (callback) {
          callback({
            success: true,
            state,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.warn(`⚠️ [ROOM_STATE] Room ${roomId} not found`);
        if (callback) {
          callback({
            success: false,
            error: `Room ${roomId} not found`,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error(`💥 [ROOM_STATE] Error getting state for room ${roomId}:`, error);
      if (callback) {
        callback({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    const userId = socket.userId;
    const username = socket.username;
    console.log(`User disconnected: ${username || 'Unknown'} (${userId || socket.id})`);

    try {
      // Find all rooms the user was in
      Object.keys(rooms).forEach(roomId => {
        const room = rooms[roomId];

        // Find user by userId if available, otherwise by socketId
        let userIndex = -1;
        if (userId) {
          userIndex = room.users.findIndex(u => u.userId === userId);
        }

        // Fallback to socketId if userId not found
        if (userIndex === -1) {
          userIndex = room.users.findIndex(u => u.socketId === socket.id);
        }

        if (userIndex !== -1) {
          const user = room.users[userIndex];
          console.log(`${user.username} (${user.userId}) removed from room ${roomId} due to disconnect`);

          // Remove the user from the room
          room.users.splice(userIndex, 1);

          // RBAC: No individual permissions to remove

          // Notify remaining users
          io.to(roomId).emit("user-left", room.users);

          // Emit the updated list of users
          emitRoomUsersUpdated(io, roomId);

          // Broadcast updated room state
          broadcastRoomState(io, roomId, 'user-left');

          // Clean up empty rooms
          if (room.users.length === 0) {
            console.log(`Room ${roomId} is now empty, cleaning up`);
            delete rooms[roomId];
          }
        }
      });

      logRoomsState();
    } catch (error) {
      console.error("Error in disconnect handler:", error);
    }
  })
}

