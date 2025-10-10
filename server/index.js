import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import rateLimit from "express-rate-limit"
import { registerRoomHandlers, getRoom } from "./sockets/room.js"
import authRoutes from "./routes/auth.js"
import dotenv from "dotenv"
import registerWhiteboardHandlers from "./sockets/whiteboard.js"
import { WebSocketServer } from "ws";
import pty from "node-pty";
import os from "os";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import connectDB from "./config/database.js";
import autoSaveService from "./services/autoSaveService.js";
import roomCleanupService from "./services/roomCleanupService.js";
import User from './models/User.js';
import userRoutes from "./routes/user.js"
import codeHistoryRoutes from "./routes/codeHistory.js"
import commentRoutes from "./routes/comments.js"
import adminRoutes from "./routes/admin.js"
import roomManagementRoutes from "./routes/roomManagement.js"

// Performance optimizations
const EXECUTION_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Process pools for keeping runtimes alive
const PROCESS_POOLS = {
  java: new Map(), // Map of className -> { process, lastUsed }
  python: null, // Single Python REPL process
  node: null    // Single Node.js REPL process
};

const POOL_TTL = 10 * 60 * 1000; // Keep processes alive for 10 minutes
const MAX_POOL_SIZE = 3; // Maximum number of pooled processes per language

// Process warm-up - periodically run lightweight commands to keep runtimes warm
function warmUpRuntimes() {
  const warmUpCommands = [
    { cmd: 'python3', args: ['-c', 'print("ready")'], name: 'Python' },
    { cmd: 'java', args: ['-version'], name: 'Java' },
    { cmd: 'node', args: ['-v'], name: 'Node.js' }
  ];

  warmUpCommands.forEach(({ cmd, args, name }) => {
    try {
      const process = spawn(cmd, args, { stdio: 'ignore' });
      process.on('close', () => {
        console.log(`🔥 ${name} runtime warmed up`);
      });
      process.on('error', () => {
        // Silently ignore warm-up errors
      });
    } catch (err) {
      // Silently ignore warm-up errors
    }
  });
}

// Warm up runtimes every 2 minutes
setInterval(warmUpRuntimes, 2 * 60 * 1000);
// Initial warm-up
setTimeout(warmUpRuntimes, 5000); // Wait 5 seconds after server start

// Simple code pattern detection
function isSimpleProgram(code, language) {
  const codeLines = code.trim().split('\n').filter(line => line.trim() && !line.trim().startsWith('//'))
  
  if (language === 'java') {
    // Detect simple Hello World or single method programs
    const hasOnlyPrintStatements = codeLines.every(line => 
      line.includes('System.out.print') || 
      line.includes('public class') || 
      line.includes('public static void main') || 
      line.trim() === '{' || 
      line.trim() === '}'
    )
    return hasOnlyPrintStatements && codeLines.length <= 10
  }
  
  if (language === 'python') {
    // Detect simple Python programs
    const hasOnlySimpleStatements = codeLines.every(line => 
      line.includes('print(') || 
      line.startsWith('import ') || 
      line.includes('input(') ||
      /^[a-zA-Z_]\w*\s*=/.test(line.trim()) // Simple variable assignments
    )
    return hasOnlySimpleStatements && codeLines.length <= 15
  }
  
  return false
}

// External code execution API for ultra-fast performance
async function executeWithAPI(code, language, ws) {
  try {
    // Clean API execution - no progress message
    
    // Using Judge0 API (free tier) - much faster than local execution
    const languageMap = {
      'java': 62,
      'python': 71,
      'javascript': 63,
      'cpp': 54,
      'c': 50,
      'go': 60,
      'rust': 73
    };
    
    if (!languageMap[language]) {
      return false; // Fallback to local execution
    }
    
    const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY || 'demo-key',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
      },
      body: JSON.stringify({
        source_code: Buffer.from(code).toString('base64'),
        language_id: languageMap[language]
      })
    });
    
    const result = await response.json();
    
    if (result.stdout) {
      ws.send(JSON.stringify({ 
        type: "output", 
        data: Buffer.from(result.stdout, 'base64').toString() + "\r\n" 
      }));
    }
    
    if (result.stderr) {
      ws.send(JSON.stringify({ 
        type: "output", 
        data: Buffer.from(result.stderr, 'base64').toString() + "\r\n" 
      }));
    }
    
    return true;
  } catch (error) {
    console.error('API execution failed:', error.message);
    return false; // Fallback to local execution
  }
}

// Client-side execution for simple programs
function canExecuteClientSide(code, language) {
  if (language === 'javascript') {
    // Always allow client-side JS execution
    return !code.includes('require(') && !code.includes('import ') && !code.includes('fs.') && !code.includes('process.')
  }
  
  if (language === 'python') {
    // Simple Python programs that can be "simulated"
    const lines = code.trim().split('\n')
    return lines.length <= 5 && lines.every(line => 
      line.includes('print(') && !line.includes('input(')
    )
  }
  
  return false
}

// Load environment variables
dotenv.config()

// Global error handlers to prevent crashes
process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', function (reason, promise) {
  console.error('Unhandled Rejection:', reason);
});

console.log('🚀 Starting server...');

// Connect to database
connectDB().then(() => {
  console.log('✅ Database connected successfully');
  autoSaveService.setConnectionStatus(true);
  console.log('✅ Auto-save service initialized with database connection');
  
  // Start room cleanup service after database is connected
  roomCleanupService.start();
  console.log('✅ Room cleanup service initialized');
}).catch((error) => {
  console.error('❌ Database connection failed:', error.message);
  autoSaveService.setConnectionStatus(false);
  console.log('⚠️  Auto-save service running without database - some features will be limited');
  console.log('⚠️  Room cleanup service disabled due to database connection failure');
});

console.log('📦 Creating Express app...');
const app = express()
console.log('🌐 Creating HTTP server...');
const httpServer = createServer(app)

// Configurable CORS via env var ALLOWED_ORIGINS (comma-separated)
const isDev = process.env.NODE_ENV !== 'production';
const parsedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const defaultOrigin = process.env.CLIENT_URL || 'http://localhost:3000';
// In development, allow all origins if ALLOWED_ORIGINS is not provided
const corsOrigins = parsedOrigins.length > 0 ? parsedOrigins : (isDev ? [] : [defaultOrigin]);
// Socket.IO CORS origin: use '*' in dev when no explicit list provided to ensure preflight succeeds
const socketCorsOrigin = (isDev && parsedOrigins.length === 0) ? '*' : corsOrigins;

// Security and performance middlewares
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Move io definition here so it is available to all routes below
console.log('🔌 Creating Socket.IO server...');
const io = new Server(httpServer, {
  cors: {
    origin: socketCorsOrigin,
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "x-user-email"]
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 30000,
  pingInterval: 10000,
  cookie: false,
  serveClient: false,
  allowEIO3: true,
  connectTimeout: 20000,
  allowRequest: (req, callback) => {
    const origin = req.headers.origin || '';
    if (!origin) {
      return callback(null, true);
    }
    if (isDev && parsedOrigins.length === 0) {
      // In dev with no explicit ALLOWED_ORIGINS, allow all
      return callback(null, true);
    }
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`🚫 Blocked Socket.IO connection from origin: ${origin}`);
    return callback(null, false);
  }
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin)
      if (!origin) return callback(null, true);
      // In development with no explicit ALLOWED_ORIGINS, allow all
      if (isDev && parsedOrigins.length === 0) return callback(null, true);
      // Otherwise restrict to configured origins
      if (corsOrigins.includes(origin)) return callback(null, true);
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "x-user-email"]
  })
)

// Add body parser middleware with sane limit
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }))

// Basic API rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Add health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5002,
    socketIO: 'enabled',
    totalRooms: Object.keys(rooms).length,
    totalConnections: io.engine.clientsCount || 0,
    uptime: process.uptime()
  });
});

// Test endpoint for user preferences
app.get('/api/test-preferences', (_, res) => {
  res.json({ message: 'Preferences endpoints are working!' });
});

// Test endpoint for connection diagnostics
app.get('/api/test-connection', (_, res) => {
  res.json({ 
    message: 'API connection is working!',
    timestamp: new Date().toISOString(),
    server: 'RealCode Backend',
    status: 'healthy'
  });
});

// Add database health check endpoint
app.get('/health/db', async (_, res) => {
  try {
    const mongoose = await import('mongoose');
    const isConnected = mongoose.default.connection.readyState === 1;
    
    res.json({
      status: isConnected ? 'connected' : 'disconnected',
      readyState: mongoose.default.connection.readyState,
      database: mongoose.default.connection.name,
      host: mongoose.default.connection.host,
      port: mongoose.default.connection.port,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
app.use('/api/users', userRoutes)
app.use('/api/code-history', codeHistoryRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/room-management', roomManagementRoutes)

// Add HTTP fallback endpoint for creating rooms
app.post('/api/create-room', async (req, res) => {
  try {
    const { username, roomId: customRoomId, userId } = req.body;

    if (!username || !userId) {
      return res.status(400).json({ error: "Username and userId are required" });
    }

    console.log(`HTTP fallback: ${username} (${userId}) creating room`);

    // Use exactly the username provided by the user
    const validUsername = username;
    const validUserId = userId;

    // Always use the provided room ID (which should be randomly generated on the client)
    const roomId = customRoomId || `${Math.random().toString(36).substring(2, 11)}`;
    
    console.log(`HTTP fallback: Creating room ${roomId} for ${validUsername} (${validUserId})`);

    // Get or create the room
    const room = getRoom(roomId);

    // Set the teacher ID if not already set (room creator becomes the permanent teacher)
    if (!room.teacherId) {
      room.teacherId = validUserId;
      console.log(`HTTP fallback: Set teacherId to ${validUserId} for room ${roomId}`);
    }

    // Check if user already exists in the room
    const existingUserIndex = room.users.findIndex(u => u.userId === validUserId);
    let role = "teacher"; // Room creator is always teacher

    if (existingUserIndex === -1) {
      // Add new user to room
      room.users.push({
        socketId: `http-${validUserId}`,
        username: validUsername,
        userId: validUserId,
        role: role
      });
      console.log(`HTTP fallback: Added new user ${validUsername} (${validUserId}) as ${role} in room ${roomId}`);
    } else {
      // Update existing user
      room.users[existingUserIndex].socketId = `http-${validUserId}`;
      room.users[existingUserIndex].role = role;
      console.log(`HTTP fallback: Updated existing user ${validUsername} (${validUserId}) as ${role} in room ${roomId}`);
    }

    // Try to create room in database
    try {
      let dbRoom = await Room.findOne({ roomId });
      if (!dbRoom) {
        dbRoom = new Room({
          roomId,
          createdBy: validUserId,
          currentCode: {
            content: '// Start coding here...',
            language: 'javascript',
            lastSaved: new Date(),
            lastSavedBy: validUserId
          }
        });
        await dbRoom.save();
        await dbRoom.addParticipant(validUserId, 'teacher');
        console.log(`HTTP fallback: Created room ${roomId} in database`);
      } else {
        await dbRoom.updateActivity();
        await dbRoom.cancelCleanup();
        console.log(`HTTP fallback: Updated existing room ${roomId} in database`);
      }
    } catch (dbError) {
      console.error(`HTTP fallback: Database error for room ${roomId}:`, dbError);
      // Don't fail the request if DB operation fails
    }

    console.log(`HTTP fallback: Room ${roomId} created successfully by ${validUsername} (${validUserId})`);

    // Return success response
    res.json({
      success: true,
      roomId,
      username: validUsername,
      role,
      users: room.users
    });
  } catch (error) {
    console.error(`HTTP fallback create-room error:`, error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

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

// --- Terminal WebSocket Server Integration ---
// Gate the terminal/code-execution feature for production safety
const ENABLE_TERMINAL = process.env.ENABLE_TERMINAL ? (process.env.ENABLE_TERMINAL === 'true') : isDev;
let terminalWss;
if (ENABLE_TERMINAL) {
  terminalWss = new WebSocketServer({ server: httpServer, path: "/terminal" });

// Function to detect Java installations
function detectJavaInstallations() {
  const possiblePaths = [
    // Oracle JDK paths
    'C:\\Program Files\\Java\\jdk-21\\bin',
    'C:\\Program Files\\Java\\jdk-17\\bin', 
    'C:\\Program Files\\Java\\jdk-11\\bin',
    'C:\\Program Files\\Java\\jdk-19\\bin',
    'C:\\Program Files\\Java\\jdk-18\\bin',
    'C:\\Program Files\\Java\\jdk-16\\bin',
    'C:\\Program Files\\Java\\jdk-15\\bin',
    'C:\\Program Files\\Java\\jdk-14\\bin',
    'C:\\Program Files\\Java\\jdk-13\\bin',
    'C:\\Program Files\\Java\\jdk-12\\bin',
    'C:\\Program Files\\Java\\jdk-10\\bin',
    'C:\\Program Files\\Java\\jdk-9\\bin',
    'C:\\Program Files\\Java\\jdk-8\\bin',
    'C:\\Program Files\\Java\\jdk-7\\bin',
    'C:\\Program Files\\Java\\jdk-6\\bin',
    'C:\\Program Files\\Java\\jdk-5\\bin',
    'C:\\Program Files\\Java\\jdk-1.8\\bin',
    'C:\\Program Files\\Java\\jdk-1.7\\bin',
    'C:\\Program Files\\Java\\jdk-1.6\\bin',
    'C:\\Program Files\\Java\\jdk-1.5\\bin',
    // Oracle javapath (where javac is actually found)
    'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath',
    // Eclipse Adoptium JDK paths
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.9.9-hotspot\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.21.9-hotspot\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.7.6-hotspot\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.7.6-hotspot\\bin',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-11.0.7.6-hotspot\\bin',
    // OpenJDK paths
    'C:\\Program Files\\OpenJDK\\jdk-21\\bin',
    'C:\\Program Files\\OpenJDK\\jdk-17\\bin',
    'C:\\Program Files\\OpenJDK\\jdk-11\\bin',
    // User-specific paths
    'C:\\Users\\kanka\\AppData\\Local\\Programs\\Eclipse Adoptium\\jdk-21.0.7.6-hotspot\\bin',
    'C:\\Users\\kanka\\AppData\\Local\\Programs\\Eclipse Adoptium\\jdk-17.0.7.6-hotspot\\bin',
    'C:\\Users\\kanka\\AppData\\Local\\Programs\\Eclipse Adoptium\\jdk-11.0.7.6-hotspot\\bin'
  ];
  
  const foundPaths = [];
  for (const javaPath of possiblePaths) {
    try {
      if (fs.existsSync(path.join(javaPath, 'javac.exe'))) {
        foundPaths.push(javaPath);
        console.log(`✅ Found Java JDK installation: ${javaPath}`);
      }
    } catch (err) {
      // Ignore errors when checking paths
    }
  }
  
  return foundPaths;
}

// Detect Java installations on startup
const javaPaths = detectJavaInstallations();
const javaPathString = javaPaths.length > 0 ? ';' + javaPaths.join(';') : '';

console.log(`🔍 Java detection: Found ${javaPaths.length} JDK installation(s)`);
console.log(`🔍 Java paths: ${javaPathString}`);

// Debug: Log the actual PATH that Node.js is using
console.log(`🔍 Node.js PATH: ${process.env.PATH}`);

// Get the first found Java installation for absolute paths
const firstJavaPath = javaPaths.length > 0 ? javaPaths[0] : null;
console.log(`🔍 First Java path: ${firstJavaPath}`);

// Check if we have javac available
let hasJavac = javaPaths.length > 0;
if (!hasJavac) {
  console.log(`⚠️  No JDK found - Java compilation will not work. Only JRE available.`);
}

// Fallback: If no JDK detected but we know Oracle Java exists, use absolute paths
const oracleJavaPath = 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath';
const hasOracleJava = fs.existsSync(path.join(oracleJavaPath, 'javac.exe'));
if (!hasJavac && hasOracleJava) {
  console.log(`✅ Found Oracle Java at: ${oracleJavaPath}`);
  javaPaths.push(oracleJavaPath);
  hasJavac = true;
}

// Use the exact path the user confirmed
const exactJavaPath = 'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath';
const hasExactJava = fs.existsSync(path.join(exactJavaPath, 'javac.exe'));
if (hasExactJava) {
  console.log(`✅ Using exact Java path: ${exactJavaPath}`);
  if (!javaPaths.includes(exactJavaPath)) {
    javaPaths.push(exactJavaPath);
  }
  hasJavac = true;
}

// Language execution configuration with spawn support
// Auto-detect OS and use appropriate commands
const isWindows = os.platform() === 'win32';
const languageConfig = {
  javascript: {
    ext: 'js',
    cmd: ['node'],
    args: [],
    runCmd: ['node'],
    runArgs: []
  },
  typescript: {
    ext: 'ts',
    cmd: ['npx', 'ts-node'],
    args: [],
    runCmd: ['npx', 'ts-node'],
    runArgs: []
  },
  python: {
    ext: 'py',
    cmd: ['python3'],
    args: ['-u'], // Unbuffered output for faster response
    runCmd: ['python3'],
    runArgs: ['-u'], // Unbuffered output
    fallbackCmd: ['python'], // Fallback for systems where python3 is not available
    fastExec: true // Enable fast execution mode
  },
  java: {
    ext: 'java',
    cmd: isWindows ? (hasJavac ? [path.join(exactJavaPath, 'javac.exe')] : ['javac']) : ['javac'],
    args: ['-J-Xms32m', '-J-Xmx128m'], // Optimize JVM memory for faster startup
    runCmd: isWindows ? (hasJavac ? [path.join(exactJavaPath, 'java.exe')] : ['java']) : ['java'],
    runArgs: ['-Xms16m', '-Xmx64m', '-XX:+UseSerialGC', '-Xint', '-XX:TieredStopAtLevel=1', '-XX:-UsePerfData'], // Ultra-fast JVM startup
    env: {
      ...process.env,
      // Set JAVA_HOME if available
      ...(process.env.JAVA_HOME ? {} : { JAVA_HOME: '/usr/lib/jvm/java-17-openjdk-amd64' }),
      PATH: process.env.PATH + (isWindows ? javaPathString : '')
    },
    canCompile: isWindows ? hasJavac : true, // Assume javac is available on Linux
    fastExec: true // Enable fast execution optimizations
  },
  csharp: {
    ext: 'cs',
    cmd: ['dotnet', 'new', 'console', '--force', '--name', 'TempApp'],
    args: [],
    runCmd: ['dotnet'],
    runArgs: ['run'],
    requiresProject: true, // C# needs a project structure
    needsProjectSetup: true // Special handling for project-based languages
  },
  cpp: {
    ext: 'cpp',
    cmd: ['g++'],
    args: ['-o', isWindows ? 'a.exe' : 'a.out'],
    runCmd: [isWindows ? './a.exe' : './a.out'],
    runArgs: []
  },
  ruby: {
    ext: 'rb',
    cmd: ['ruby'],
    args: [],
    runCmd: ['ruby'],
    runArgs: []
  },
  go: {
    ext: 'go',
    cmd: ['go'],
    args: ['run'],
    runCmd: ['go'],
    runArgs: ['run'],
    directExecution: true // Go runs directly without compilation step
  },
  rust: {
    ext: 'rs',
    cmd: ['rustc'],
    args: ['-o', isWindows ? 'temp.exe' : 'temp'],
    runCmd: [isWindows ? path.join('.', 'temp.exe') : './temp'],
    runArgs: [],
    needsCompilation: true // Rust needs compilation step
  }
};

// Runtime checking temporarily removed for deployment stability

terminalWss.on("connection", (ws) => {
  console.log("🔌 Client connected to terminal");

  const shell = os.platform() === "win32" ? "cmd.exe" : "bash";
  let ptyProcess = null;
  let currentProcess = null; // Track the current running process
  let processTimeout = null; // Track process timeout
  let keepAliveInterval = null; // Track keep-alive interval
  
  try {
    ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.env.USERPROFILE,
      env: process.env,
    });
  } catch (err) {
    console.error('Failed to spawn PTY process:', err);
    ws.close();
    return;
  }

  // Add comprehensive error handlers to prevent crashes
  ptyProcess.on('error', (err) => {
    console.error('PTY error:', err.message);
    // Don't crash the server, just log the error
  });

  // Handle PTY process exit with .once() to prevent multiple listeners
  ptyProcess.once('exit', (code, signal) => {
    console.log(`PTY process exited with code ${code} and signal ${signal}`);
  });

  // Set up keep-alive ping to prevent connection timeout
  keepAliveInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 30000); // Send ping every 30 seconds

  // Handle pong response
  ws.on('pong', () => {
    console.log('🏓 Terminal WebSocket pong received');
  });

  ptyProcess.on("data", (data) => {
    try { 
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "output", data: data }));
        
        // Detect prompts for different languages
        const promptPatterns = [
          /input\(/i,           // Python input()
          /readline/i,           // JavaScript readline
          /printf.*\?/i,         // C++ printf with question
          /scanf/i,              // C++ scanf
          /read -p/i,            // Bash read -p
          /Enter your/i,         // Generic "Enter your"
          /What is/i,            // Generic "What is"
          /Please enter/i,       // Generic "Please enter"
          /: $/m,                // Colon followed by space and end of line
          /\? $/m,               // Question mark followed by space and end of line
        ];
        
        const hasPrompt = promptPatterns.some(pattern => pattern.test(data));
        if (hasPrompt) {
          ws.send(JSON.stringify({ type: "prompt-waiting", data: true }));
        }
      }
    } catch (err) {
      console.error('Error sending data to client:', err.message);
    }
  });

  ws.on("message", async (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch {
      // Not JSON, treat as raw input to shell
      try {
        if (ptyProcess && typeof ptyProcess.write === 'function' && !ptyProcess.killed) {
          ptyProcess.write(msg);
        }
      } catch (err) {
        console.error('Error writing to PTY:', err.message);
      }
      return;
    }

    // Handle send-input (real-time input to running process)
    if (parsed && parsed.type === "send-input" && typeof parsed.data === "string") {
      try {
        if (currentProcess && currentProcess.stdin && !currentProcess.killed) {
          currentProcess.stdin.write(parsed.data + '\n');
        } else if (ptyProcess && typeof ptyProcess.write === 'function' && !ptyProcess.killed) {
          ptyProcess.write(parsed.data + '\n');
        }
      } catch (err) {
        console.error('Error writing input to process:', err);
      }
      return;
    }

    // Handle run_code message
    if (parsed && parsed.type === "run_code" && typeof parsed.data === "string") {
      const language = parsed.language || 'javascript';
      const code = parsed.data;
      const userInput = parsed.input || '';
      
      const config = languageConfig[language];
      if (!config) {
        ws.send(JSON.stringify({ type: "output", data: `Error: Unsupported language '${language}'\r\n` }));
        return;
      }
      
      // Note: Runtime checking temporarily disabled for deployment stability
      // Languages will show appropriate error messages when runtimes are missing

      const tempDir = os.tmpdir();
      const filename = `temp_${Date.now()}.${config.ext}`;
      let filePath = path.join(tempDir, filename);
      
      try {
        fs.writeFileSync(filePath, code);
        
        // Debug: Verify file was created correctly
        console.log(`🔍 Created file: ${filePath}`);
        console.log(`🔍 File content length: ${code.length} characters`);
        console.log(`🔍 File exists: ${fs.existsSync(filePath)}`);
        
        // For Java, verify the class name matches the file name
        if (language === 'java') {
          const classMatch = code.match(/public\s+class\s+(\w+)/);
          if (classMatch) {
            const className = classMatch[1];
            const expectedFileName = className + '.java';
            console.log(`🔍 Found class: ${className}`);
            console.log(`🔍 Expected file: ${expectedFileName}`);
            console.log(`🔍 Actual file: ${filename}`);
            
            if (filename !== expectedFileName) {
              console.log(`⚠️  Class name doesn't match file name!`);
              // Rename the file to match the class name
              const correctFilePath = path.join(tempDir, expectedFileName);
              fs.renameSync(filePath, correctFilePath);
              console.log(`🔍 Renamed file to: ${correctFilePath}`);
              filePath = correctFilePath;
            }
          }
        }
        
        const runCodeWithInput = (execCmd, execArgs) => {
          try {
            // Use custom environment if available for this language
            const spawnOptions = {
              cwd: tempDir,
              stdio: ['pipe', 'pipe', 'pipe'],
              env: config.env || process.env
            };
            
            // Debug logging for Java
            if (language === 'java') {
              console.log(`🔍 Java execution: cmd=${execCmd}, args=${execArgs}, env.PATH=${spawnOptions.env.PATH}`);
            }
            
            currentProcess = spawn(execCmd, [...execArgs, filePath], spawnOptions);

            // Add error handler for the spawned process
            currentProcess.on('error', (err) => {
              console.error('Spawned process error:', err.message);
              console.error('Command that failed:', execCmd, [...execArgs, filePath]);
              if (processTimeout) {
                clearTimeout(processTimeout);
                processTimeout = null;
              }
              currentProcess = null;
              ws.send(JSON.stringify({ type: "output", data: `Process error: ${err.message}\r\n` }));
            });

            // Set process timeout - shorter for simple programs
            const timeoutDuration = isSimple ? 10000 : 30000; // 10s for simple, 30s for complex
            processTimeout = setTimeout(() => {
              if (currentProcess && !currentProcess.killed) {
                try {
                  currentProcess.kill('SIGTERM');
                  ws.send(JSON.stringify({ type: "output", data: `Process timed out after ${timeoutDuration/1000} seconds\r\n` }));
                } catch (err) {
                  console.error('Error killing timed out process:', err.message);
                }
              }
            }, timeoutDuration);

            // Write initial user input to stdin if provided
            if (userInput) {
              try {
                currentProcess.stdin.write(userInput);
              } catch (err) {
                console.error('Error writing initial input:', err.message);
              }
            }

            let output = '';
            let errorOutput = '';

            currentProcess.stdout.on('data', (data) => {
              try {
                const dataStr = data.toString();
                output += dataStr;
                ws.send(JSON.stringify({ type: "output", data: dataStr }));
                
                // Detect prompts in real-time
                const promptPatterns = [
                  /input\(/i, /readline/i, /printf.*\?/i, /scanf/i, /read -p/i,
                  /Enter your/i, /What is/i, /Please enter/i, /: $/m, /\? $/m
                ];
                
                const hasPrompt = promptPatterns.some(pattern => pattern.test(dataStr));
                if (hasPrompt) {
                  ws.send(JSON.stringify({ type: "prompt-waiting", data: true }));
                }
              } catch (err) {
                console.error('Error handling stdout:', err.message);
              }
            });

            currentProcess.stderr.on('data', (data) => {
              try {
                const dataStr = data.toString();
                errorOutput += dataStr;
                ws.send(JSON.stringify({ type: "output", data: dataStr }));
              } catch (err) {
                console.error('Error handling stderr:', err.message);
              }
            });

            // Use .once() to prevent multiple listeners
            currentProcess.once('close', (code) => {
              try {
                if (processTimeout) {
                  clearTimeout(processTimeout);
                  processTimeout = null;
                }
                currentProcess = null;
                ws.send(JSON.stringify({ type: "prompt-waiting", data: false }));
                
                // Cleanup temp files
                try {
                  fs.unlinkSync(filePath);
                  // Also clean up compiled files for C++ and Rust
                  if (language === 'cpp') {
                    const outFile = path.join(tempDir, 'a.out');
                    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
                  }
                  if (language === 'rust') {
                    const exeFile = path.join(tempDir, 'temp');
                    if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
                  }
                } catch (cleanupError) {
                  console.error('Cleanup error:', cleanupError.message);
                }
              } catch (err) {
                console.error('Error in process close handler:', err.message);
              }
            });

            currentProcess.on('error', (err) => {
              try {
                if (processTimeout) {
                  clearTimeout(processTimeout);
                  processTimeout = null;
                }
                currentProcess = null;
                ws.send(JSON.stringify({ type: "output", data: `Error: ${err.message}\r\n` }));
              } catch (sendErr) {
                console.error('Error sending error message:', sendErr.message);
              }
            });
          } catch (spawnErr) {
            console.error('Error spawning process:', spawnErr.message);
            ws.send(JSON.stringify({ type: "output", data: `Error spawning process: ${spawnErr.message}\r\n` }));
          }
        };

        // Check for ultra-fast execution paths first
        const isSimple = isSimpleProgram(code, language);
        const canClientSide = canExecuteClientSide(code, language);
        
        // Try external API execution first (fastest option)
        if (process.env.JUDGE0_API_KEY && ['java', 'python', 'cpp', 'javascript'].includes(language)) {
          const apiSuccess = await executeWithAPI(code, language, ws);
          if (apiSuccess) {
            try { fs.unlinkSync(filePath); } catch {}
            return;
          }
        }
        
        if (canClientSide) {
          // Ultra-fast client-side execution - no progress message
          
          if (language === 'javascript') {
            // Safe client-side JavaScript execution with console.log support
            try {
              // Capture console.log output
              let output = '';
              const originalConsoleLog = console.log;
              console.log = (...args) => {
                output += args.map(arg => String(arg)).join(' ') + '\r\n';
              };
              
              // Execute the code
              const result = eval(code);
              
              // Restore console.log
              console.log = originalConsoleLog;
              
              // Send captured output or result
              if (output) {
                ws.send(JSON.stringify({ type: "output", data: output }));
              } else if (result !== undefined) {
                ws.send(JSON.stringify({ type: "output", data: String(result) + "\r\n" }));
              }
            } catch (err) {
              ws.send(JSON.stringify({ type: "output", data: `Error: ${err.message}\r\n` }));
            }
          } else if (language === 'python') {
            // Simulate simple Python print statements
            try {
              const printRegex = /print\(([^)]*)\)/g;
              let match;
              while ((match = printRegex.exec(code)) !== null) {
                const printContent = match[1].replace(/[\'\"]/g, '');
                ws.send(JSON.stringify({ type: "output", data: printContent + "\r\n" }));
              }
            } catch (err) {
              ws.send(JSON.stringify({ type: "output", data: `Error: ${err.message}\r\n` }));
            }
          }
          
          // Cleanup and return
          try { fs.unlinkSync(filePath); } catch {}
          return;
        }
        
        // Simple program optimization - no message
        
        // Handle different language execution patterns
        if (language === 'java') {
          // Check if we have javac available
          if (!config.canCompile) {
            ws.send(JSON.stringify({ 
              type: "output", 
              data: "❌ Java compilation not available. You have JRE installed but not JDK.\r\n" +
                    "To compile Java code, you need to install a JDK (Java Development Kit).\r\n" +
                    "You can download it from: https://adoptium.net/\r\n" +
                    "Current Java runtime: " + (firstJavaPath ? firstJavaPath : "Not found") + "\r\n"
            }));
            try { fs.unlinkSync(filePath); } catch {}
            return;
          }
          
          // Clean compilation - no progress message
          
          // Debug: Log the Java code being compiled
          console.log(`🔍 Compiling Java file: ${filePath}`);
          console.log(`🔍 Java code: ${code.substring(0, 200)}...`);
          
          // Compile first, then run
          try {
            const compileOptions = {
              cwd: tempDir,
              env: config.env || process.env,
              stdio: ['pipe', 'pipe', 'pipe'] // Optimize stdio for faster compilation
            };
            
            console.log(`🔍 Using javac: ${config.cmd[0]}`);
            console.log(`🔍 Compile args: ${config.args.join(' ')} ${filePath}`);
            
            const compileProcess = spawn(config.cmd[0], [...config.args, filePath], compileOptions);
            
            // Add error handler for compilation
            compileProcess.on('error', (err) => {
              console.error('Compilation error:', err.message);
              ws.send(JSON.stringify({ type: "output", data: `Compilation error: ${err.message}\r\n` }));
              try { fs.unlinkSync(filePath); } catch {}
            });
            
            // Capture compilation error output
            compileProcess.stderr.on('data', (data) => {
              const errorData = data.toString();
              console.error('Java compilation stderr:', errorData);
              ws.send(JSON.stringify({ type: "output", data: errorData }));
            });
            
            // Capture compilation stdout
            compileProcess.stdout.on('data', (data) => {
              const outputData = data.toString();
              console.log('Java compilation stdout:', outputData);
              ws.send(JSON.stringify({ type: "output", data: outputData }));
            });
            
            compileProcess.once('close', (code) => {
              if (code !== 0) {
                ws.send(JSON.stringify({ type: "output", data: '❌ Compilation failed\r\n' }));
                try { fs.unlinkSync(filePath); } catch {}
                return;
              }
              // Compilation successful - no message
              runCodeWithInput(config.runCmd[0], config.runArgs);
            });
          } catch (err) {
            ws.send(JSON.stringify({ type: "output", data: `Error starting compilation: ${err.message}\r\n` }));
            try { fs.unlinkSync(filePath); } catch {}
          }
        } else if (language === 'cpp') {
          // Compile first, then run
          try {
            const compileOptions = {
              cwd: tempDir,
              env: config.env || process.env
            };
            
            const compileProcess = spawn(config.cmd[0], [...config.args, filePath], compileOptions);
            
            // Add error handler for compilation
            compileProcess.on('error', (err) => {
              console.error('Compilation error:', err.message);
              ws.send(JSON.stringify({ type: "output", data: `Compilation error: ${err.message}\r\n` }));
              try { fs.unlinkSync(filePath); } catch {}
            });
            
            compileProcess.once('close', (code) => {
              if (code !== 0) {
                ws.send(JSON.stringify({ type: "output", data: 'Compilation failed\r\n' }));
                try { fs.unlinkSync(filePath); } catch {}
                return;
              }
              // For C++, run the compiled executable directly (without appending filePath)
              const executablePath = path.join(tempDir, isWindows ? 'a.exe' : 'a.out');
              
              try {
                const spawnOptions = {
                  cwd: tempDir,
                  stdio: ['pipe', 'pipe', 'pipe'],
                  env: config.env || process.env
                };
                
                currentProcess = spawn(executablePath, [], spawnOptions);
                
                currentProcess.on('error', (err) => {
                  console.error('C++ executable error:', err.message);
                  currentProcess = null;
                  ws.send(JSON.stringify({ type: "output", data: `Execution error: ${err.message}\r\n` }));
                });
                
                currentProcess.stdout.on('data', (data) => {
                  ws.send(JSON.stringify({ type: "output", data: data.toString() }));
                });
                
                currentProcess.stderr.on('data', (data) => {
                  ws.send(JSON.stringify({ type: "output", data: data.toString() }));
                });
                
                currentProcess.once('close', (code) => {
                  currentProcess = null;
                  // Clean up files
                  try {
                    fs.unlinkSync(filePath);
                    fs.unlinkSync(executablePath);
                  } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError.message);
                  }
                });
              } catch (err) {
                ws.send(JSON.stringify({ type: "output", data: `Error running C++ executable: ${err.message}\r\n` }));
              }
            });
          } catch (err) {
            ws.send(JSON.stringify({ type: "output", data: `Error starting compilation: ${err.message}\r\n` }));
            try { fs.unlinkSync(filePath); } catch {}
          }
        } else if (language === 'rust') {
          // Compile first, then run
          try {
            const compileOptions = {
              cwd: tempDir,
              env: config.env || process.env
            };
            
            const compileProcess = spawn(config.cmd[0], [...config.args, filePath], compileOptions);
            
            // Add error handler for compilation
            compileProcess.on('error', (err) => {
              console.error('Compilation error:', err.message);
              ws.send(JSON.stringify({ type: "output", data: `Compilation error: ${err.message}\r\n` }));
              try { fs.unlinkSync(filePath); } catch {}
            });
            
            compileProcess.once('close', (code) => {
              if (code !== 0) {
                ws.send(JSON.stringify({ type: "output", data: 'Compilation failed\r\n' }));
                try { fs.unlinkSync(filePath); } catch {}
                return;
              }
              // For Rust, run the compiled executable directly (without appending filePath)
              const executablePath = path.join(tempDir, isWindows ? 'temp.exe' : 'temp');
              
              try {
                const spawnOptions = {
                  cwd: tempDir,
                  stdio: ['pipe', 'pipe', 'pipe'],
                  env: config.env || process.env
                };
                
                currentProcess = spawn(executablePath, [], spawnOptions);
                
                currentProcess.on('error', (err) => {
                  console.error('Rust executable error:', err.message);
                  currentProcess = null;
                  ws.send(JSON.stringify({ type: "output", data: `Execution error: ${err.message}\r\n` }));
                });
                
                currentProcess.stdout.on('data', (data) => {
                  ws.send(JSON.stringify({ type: "output", data: data.toString() }));
                });
                
                currentProcess.stderr.on('data', (data) => {
                  ws.send(JSON.stringify({ type: "output", data: data.toString() }));
                });
                
                currentProcess.once('close', (code) => {
                  currentProcess = null;
                  // Clean up files
                  try {
                    fs.unlinkSync(filePath);
                    fs.unlinkSync(executablePath);
                  } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError.message);
                  }
                });
              } catch (err) {
                ws.send(JSON.stringify({ type: "output", data: `Error running Rust executable: ${err.message}\r\n` }));
              }
            });
          } catch (err) {
            ws.send(JSON.stringify({ type: "output", data: `Error starting compilation: ${err.message}\r\n` }));
            try { fs.unlinkSync(filePath); } catch {}
          }
        } else if (language === 'csharp') {
          // C# requires special project setup
          try {
            const projectDir = path.join(tempDir, `temp_csharp_${Date.now()}`);
            fs.mkdirSync(projectDir, { recursive: true });
            
            // Create new console project
            const createProcess = spawn('dotnet', ['new', 'console', '--force', '--name', 'TempApp'], {
              cwd: projectDir,
              stdio: ['pipe', 'pipe', 'pipe']
            });
            
            createProcess.once('close', (createCode) => {
              if (createCode !== 0) {
                ws.send(JSON.stringify({ type: "output", data: 'Failed to create C# project\r\n' }));
                try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
                return;
              }
              
              // Replace Program.cs with user code
              const programFile = path.join(projectDir, 'TempApp', 'Program.cs');
              try {
                fs.writeFileSync(programFile, code);
              } catch (writeErr) {
                ws.send(JSON.stringify({ type: "output", data: `Error writing C# code: ${writeErr.message}\r\n` }));
                try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
                return;
              }
              
              // Run the project
              const runProcess = spawn('dotnet', ['run'], {
                cwd: path.join(projectDir, 'TempApp'),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1' }
              });
              
              currentProcess = runProcess;
              
              // Handle process output
              runProcess.stdout.on('data', (data) => {
                const dataStr = data.toString();
                // Filter out .NET system messages but preserve all program output
                const lines = dataStr.split('\n');
                const filteredLines = lines.filter(line => {
                  const trimmedLine = line.trim();
                  // Skip empty lines
                  if (!trimmedLine) return false;
                  
                  // Filter out .NET system messages only
                  const systemMessages = [
                    'Welcome to .NET',
                    'SDK Version',
                    'Telemetry',
                    'Learn about',
                    'Find out what',
                    'Explore documentation',
                    'Report issues',
                    'dotnet --help'
                  ];
                  
                  // Keep the line if it doesn't contain any system messages
                  return !systemMessages.some(msg => trimmedLine.includes(msg));
                });
                
                if (filteredLines.length > 0) {
                  ws.send(JSON.stringify({ type: "output", data: filteredLines.join('\n') + '\n' }));
                }
              });
              
              runProcess.stderr.on('data', (data) => {
                ws.send(JSON.stringify({ type: "output", data: data.toString() }));
              });
              
              runProcess.once('close', (runCode) => {
                currentProcess = null;
                try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
              });
              
              runProcess.on('error', (err) => {
                currentProcess = null;
                ws.send(JSON.stringify({ type: "output", data: `C# execution error: ${err.message}\r\n` }));
                try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
              });
            });
            
          } catch (err) {
            ws.send(JSON.stringify({ type: "output", data: `C# setup error: ${err.message}\r\n` }));
          }
        } else {
          // Direct execution - clean
          runCodeWithInput(config.cmd[0], config.args);
        }
        
      } catch (writeError) {
        ws.send(JSON.stringify({ type: "output", data: `Error writing file: ${writeError.message}\r\n` }));
      }
      return;
    }

    // Default: treat as terminal input
    if (parsed && parsed.type === "input" && typeof parsed.data === "string") {
      try {
        if (ptyProcess && typeof ptyProcess.write === 'function' && !ptyProcess.killed) {
          ptyProcess.write(parsed.data);
        }
      } catch (err) {
        console.error('Error writing to PTY:', err.message);
      }
      return;
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected from terminal");
    try {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (processTimeout) {
        clearTimeout(processTimeout);
        processTimeout = null;
      }
      if (currentProcess && !currentProcess.killed) {
        try {
          currentProcess.kill('SIGTERM');
        } catch (err) {
          console.error('Error killing current process:', err.message);
        }
        currentProcess = null;
      }
      if (ptyProcess && !ptyProcess.killed) {
        try {
          ptyProcess.kill();
        } catch (err) {
          console.error('Error killing PTY process:', err.message);
        }
      }
    } catch (err) {
      console.error('Error in disconnect cleanup:', err.message);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    try {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      if (processTimeout) {
        clearTimeout(processTimeout);
        processTimeout = null;
      }
      if (currentProcess && !currentProcess.killed) {
        try {
          currentProcess.kill('SIGTERM');
        } catch (killErr) {
          console.error('Error killing current process:', killErr.message);
        }
        currentProcess = null;
      }
      if (ptyProcess && !ptyProcess.killed) {
        try {
          ptyProcess.kill();
        } catch (killErr) {
          console.error('Error killing PTY process:', killErr.message);
        }
      }
    } catch (cleanupErr) {
      console.error('Error in WebSocket error cleanup:', cleanupErr.message);
    }
});
});
}

// TEST ROUTE: Create a Room document
app.post('/api/test-create-room', async (req, res) => {
  try {
    const { roomId, userId, code, language } = req.body;
    if (!roomId || !userId || !code || !language) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const Room = (await import('./models/Room.js')).default;
    let room = await Room.findOne({ roomId });
    if (!room) {
      room = new Room({
        roomId,
        createdBy: userId,
        currentCode: {
          content: code,
          language,
          lastSaved: new Date(),
          lastSavedBy: userId
        }
      });
      await room.save();
    }
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TEST ROUTE: Fetch all Room documents
app.get('/api/test-get-rooms', async (req, res) => {
  try {
    const Room = (await import('./models/Room.js')).default;
    const rooms = await Room.find({});
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get user preferences
app.get('/api/user/preferences', async (req, res) => {
  try {
    const { email } = req.query;
    console.log('📥 Getting preferences for email:', email);
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ error: 'User not found' });
    console.log('✅ Found user preferences:', user.preferences);
    res.json({ preferences: user.preferences || {} });
  } catch (error) {
    console.error('❌ Error getting preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Update user preferences
app.post('/api/user/preferences', async (req, res) => {
  try {
    const { email, preferences } = req.body;
    console.log('📝 Updating preferences for email:', email, 'preferences:', preferences);
    console.log('📊 Full request body:', req.body);
    
    if (!email || !preferences) return res.status(400).json({ error: 'Missing email or preferences' });
    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Merge new preferences into existing preferences
    const setObj = Object.fromEntries(
      Object.entries(preferences).map(([k, v]) => [`preferences.${k}`, v])
    );
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: setObj },
      { new: true, upsert: false }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    console.log('✅ Preferences updated successfully for user:', user.email);
    console.log('📋 Updated user preferences:', user.preferences);
    console.log('📋 Full user document:', JSON.stringify(user, null, 2));
    
    res.json({ success: true, preferences: user.preferences });
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Validate if room exists
app.get('/api/validate-room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }
    
    // Check if room exists in memory or database
    const { getRoom } = await import('./sockets/room.js');
    const inMemoryRoom = getRoom(roomId);
    const hasUsers = inMemoryRoom && inMemoryRoom.users && inMemoryRoom.users.length > 0;
    
    // Also check database
    let dbRoomExists = false;
    try {
      const dbRoom = await Room.findOne({ roomId });
      dbRoomExists = !!dbRoom;
    } catch (dbError) {
      console.error('Database check failed in room validation:', dbError);
    }
    
    const exists = hasUsers || dbRoomExists;
    console.log(`🔍 Room validation for ${roomId}: exists=${exists} (inMemory=${hasUsers}, database=${dbRoomExists})`);
    
    res.json({ exists, roomId });
  } catch (error) {
    console.error('Error validating room:', error);
    res.status(500).json({ error: 'Failed to validate room' });
  }
});

// Change the backend port from 5001 to 5002 to avoid EADDRINUSE error
const PORT = process.env.PORT || 5002
console.log(`🚀 Starting server on port ${PORT}...`);
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌐 Server URL: http://localhost:${PORT}`)
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`)
});
