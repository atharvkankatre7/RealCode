import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import { registerRoomHandlers, getRoom } from "./sockets/room.js"
import authRoutes from "./routes/auth.js"
import dotenv from "dotenv"
import registerWhiteboardHandlers from "./sockets/whiteboard.js"

// Load environment variables
dotenv.config()

console.log('🚀 Starting server...');

console.log('📦 Creating Express app...');
const app = express()
console.log('🌐 Creating HTTP server...');
const httpServer = createServer(app)

// Move io definition here so it is available to all routes below
console.log('🔌 Creating Socket.IO server...');
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "*"], // Allow localhost and all origins
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    credentials: false, // Set to false to avoid CORS issues
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  },
  transports: ['polling', 'websocket'], // Try polling first, then websocket
  pingTimeout: 30000,
  pingInterval: 10000,
  cookie: false,
  serveClient: true, // Enable serving client files
  allowEIO3: true,
  connectTimeout: 20000,
  allowRequest: (req, callback) => {
    // Log all connection attempts
    console.log(`🔍 Connection attempt from: ${req.headers.origin || 'unknown'}`);
    console.log(`🔍 User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
    callback(null, true); // Allow all connections
  }
})

app.use(
  cors({
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    credentials: false, // Set to false to avoid CORS issues
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  })
)

// Add body parser middleware
app.use(express.json())

// Add health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5002,
    socketIO: 'enabled'
  });
});

// Add Socket.IO info endpoint
app.get('/socket.io/info', (_, res) => {
  res.json({
    status: 'Socket.IO server running',
    transports: ['polling', 'websocket'],
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"]
    }
  });
});

// Import the getRoom function from room.js
// (already imported above)

// Use authentication routes
app.use('/api/auth', authRoutes)

// Add HTTP fallback endpoint for joining rooms
app.post('/api/join-room', (req, res) => {
  try {
    const { roomId, username, userId } = req.body

    if (!roomId || !username || !userId) {
      return res.status(400).json({ error: "Missing required parameters" })
    }

    console.log(`HTTP fallback: ${username} (${userId}) joining room: ${roomId}`)

    // Get or create the room
    const room = getRoom(roomId)

    // Set the teacher ID if not already set (first user becomes the permanent teacher)
    if (!room.teacherId && room.users.length === 0) {
      room.teacherId = userId;
      console.log(`HTTP fallback: Set teacherId to ${userId} for room ${roomId}`);
    }

    // Check if user already exists in the room
    const existingUserIndex = room.users.findIndex(u => u.userId === userId)
    let userRole;

    // Determine role based on whether this user is the teacher
    const isTeacher = room.teacherId === userId;

    if (existingUserIndex !== -1) {
      // Update the existing user and assign role based on teacher ID
      room.users[existingUserIndex].username = username
      room.users[existingUserIndex].socketId = `http-${userId}`
      userRole = isTeacher ? "teacher" : "student";
      room.users[existingUserIndex].role = userRole; // Update role to ensure consistency
      console.log(`HTTP fallback: Existing user ${username} (${userId}) reconnected as ${userRole} in room ${roomId}`);
    } else {
      // Add new user to room - assign role based on teacher ID
      userRole = isTeacher ? "teacher" : "student";
      room.users.push({
        socketId: `http-${userId}`,
        username: username,
        userId: userId,
        role: userRole
      })
      console.log(`HTTP fallback: New user ${username} (${userId}) joined as ${userRole} in room ${roomId}`);
    }

    console.log(`HTTP fallback: Current users in room ${roomId}:`, JSON.stringify(room.users))

    // Return success response
    res.json({
      success: true,
      roomId,
      username,
      role: userRole,
      users: room.users,
      code: room.code
    })
  } catch (error) {
    console.error(`HTTP fallback error:`, error)
    res.status(500).json({ error: `Server error: ${error.message}` })
  }
})

// Add HTTP fallback endpoint for code changes
app.post('/api/code-change', (req, res) => {
  try {
    const { roomId, code, userId } = req.body

    if (!roomId || code === undefined) {
      return res.status(400).json({ error: "Missing required parameters" })
    }

    console.log(`HTTP fallback: Code update in room ${roomId}, length: ${code.length}`)

    // Get the room
    const room = getRoom(roomId)

    // Update the code in the room
    room.code = code

    // Find the user if userId is provided
    let username = "Unknown"
    if (userId) {
      const user = room.users.find(u => u.userId === userId)
      if (user) {
        username = user.username
      }
    }

    console.log(`HTTP fallback: Code updated by ${username} in room ${roomId}`)

    // Broadcast to all connected sockets in the room
    // This ensures that users connected via WebSocket still get updates
    io.to(roomId).emit('code-update', code)

    // Return success response
    res.json({
      success: true,
      roomId,
      codeLength: code.length
    })
  } catch (error) {
    console.error(`HTTP fallback error:`, error)
    res.status(500).json({ error: `Server error: ${error.message}` })
  }
})

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id)
  console.log(`🔌 Transport: ${socket.conn.transport.name}`)
  console.log(`🌐 Client IP: ${socket.handshake.address}`)

  // Log all rooms this socket is in
  console.log(`🏠 Socket ${socket.id} rooms:`, Array.from(socket.rooms))

  // Log all events for debugging
  // const originalEmit = socket.emit;
  // socket.emit = function() {
  //   console.log(`EMIT: Socket ${socket.id} emitting event:`, arguments[0]);
  //   return originalEmit.apply(this, arguments);
  // };

  // socket.onAny((event, ...args) => {
  //   console.log(`RECEIVED: Socket ${socket.id} received event ${event}:`, args);
  // });

  // Add test message handler for debugging
  socket.on('test-message', (data) => {
    console.log('📨 Test message received from', socket.id, ':', data);
    socket.emit('test-response', {
      message: 'Test message received successfully!',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
  });

  registerRoomHandlers(io, socket)

  // Register whiteboard handlers
  registerWhiteboardHandlers(io, socket)

  socket.on("disconnect", (reason) => {
    console.log("❌ Client disconnected:", socket.id, "Reason:", reason)
  })

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("🚨 Socket error for", socket.id, ":", error)
  })
})

// Change the backend port from 5001 to 5002 to avoid EADDRINUSE error
const PORT = process.env.PORT || 5002
console.log(`🚀 Starting server on port ${PORT}...`);
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌐 Server URL: http://localhost:${PORT}`)
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`)
})