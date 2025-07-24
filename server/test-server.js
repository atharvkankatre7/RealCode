import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"

console.log('🚀 Starting test server...');

const app = express()
const httpServer = createServer(app)

console.log('🔌 Creating Socket.IO server...');
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  }
})

console.log('📦 Setting up routes...');
app.get('/', (req, res) => {
  res.json({ message: 'Test server is running!' });
});

console.log('🔌 Setting up Socket.IO...');
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id)
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id)
  })
})

const PORT = 5002
console.log(`🚀 Starting server on port ${PORT}...`);
httpServer.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`)
  console.log(`🌐 Server URL: http://localhost:${PORT}`)
})
