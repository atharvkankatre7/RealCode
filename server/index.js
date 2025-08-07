import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
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
import User from './models/User.js';
import userRoutes from "./routes/user.js"
import codeHistoryRoutes from "./routes/codeHistory.js"

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
}).catch((error) => {
  console.error('❌ Database connection failed:', error.message);
  autoSaveService.setConnectionStatus(false);
  console.log('⚠️  Auto-save service running without database - some features will be limited');
});

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

// Test endpoint for user preferences
app.get('/api/test-preferences', (_, res) => {
  res.json({ message: 'Preferences endpoints are working!' });
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
const terminalWss = new WebSocketServer({ server: httpServer, path: "/terminal" });

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
    cmd: ['python'],
    args: [],
    runCmd: ['python'],
    runArgs: []
  },
  java: {
    ext: 'java',
    cmd: hasJavac ? [path.join(exactJavaPath, 'javac.exe')] : null,
    args: [],
    runCmd: hasJavac ? [path.join(exactJavaPath, 'java.exe')] : ['java'],
    runArgs: [],
    // Add Java-specific environment configuration
    env: {
      ...process.env,
      // Use detected Java paths or fallback to common paths
      PATH: process.env.PATH + javaPathString
    },
    // Flag to indicate if compilation is available
    canCompile: hasJavac
  },
  csharp: {
    ext: 'cs',
    cmd: ['dotnet'],
    args: ['run'],
    runCmd: ['dotnet'],
    runArgs: ['run']
  },
  cpp: {
    ext: 'cpp',
    cmd: ['g++'],
    args: ['-o', 'a.out'],
    runCmd: ['./a.out'],
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
    runArgs: ['run']
  },
  rust: {
    ext: 'rs',
    cmd: ['rustc'],
    args: ['-o', 'temp'],
    runCmd: ['./temp'],
    runArgs: []
  }
};

terminalWss.on("connection", (ws) => {
  console.log("🔌 Client connected to terminal");

  const shell = os.platform() === "win32" ? "cmd.exe" : "bash";
  let ptyProcess = null;
  let currentProcess = null; // Track the current running process
  let processTimeout = null; // Track process timeout
  
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

  ws.on("message", (msg) => {
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

            // Set process timeout (30 seconds)
            processTimeout = setTimeout(() => {
              if (currentProcess && !currentProcess.killed) {
                try {
                  currentProcess.kill('SIGTERM');
                  ws.send(JSON.stringify({ type: "output", data: "Process timed out after 30 seconds\r\n" }));
                } catch (err) {
                  console.error('Error killing timed out process:', err.message);
                }
              }
            }, 30000);

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
          
          // Debug: Log the Java code being compiled
          console.log(`🔍 Compiling Java file: ${filePath}`);
          console.log(`🔍 Java code: ${code.substring(0, 200)}...`);
          
          // Compile first, then run
          try {
            const compileOptions = {
              cwd: tempDir,
              env: config.env || process.env
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
                ws.send(JSON.stringify({ type: "output", data: 'Compilation failed\r\n' }));
                try { fs.unlinkSync(filePath); } catch {}
                return;
              }
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
              runCodeWithInput(config.runCmd[0], config.runArgs);
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
              runCodeWithInput(config.runCmd[0], config.runArgs);
            });
          } catch (err) {
            ws.send(JSON.stringify({ type: "output", data: `Error starting compilation: ${err.message}\r\n` }));
            try { fs.unlinkSync(filePath); } catch {}
          }
        } else {
          // Direct execution
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
    const user = await User.findOne({ email });
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
    
    // Merge new preferences into existing preferences
    const setObj = Object.fromEntries(
      Object.entries(preferences).map(([k, v]) => [`preferences.${k}`, v])
    );
    const user = await User.findOneAndUpdate(
      { email },
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

// Change the backend port from 5001 to 5002 to avoid EADDRINUSE error
const PORT = process.env.PORT || 5002
console.log(`🚀 Starting server on port ${PORT}...`);
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`🌐 Server URL: http://localhost:${PORT}`)
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`)
})