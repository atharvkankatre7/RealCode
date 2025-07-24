// Simple test script to verify socket connection and user management
const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';

// Test function to simulate a user joining a room
function testUserConnection(username, roomId) {
  console.log(`\n=== Testing connection for ${username} ===`);
  
  const socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    autoConnect: true,
    forceNew: true,
  });

  socket.on('connect', () => {
    console.log(`✅ ${username} connected with socket ID: ${socket.id}`);
    
    // Generate a unique userId
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Join the room
    socket.emit('join-room', { roomId, username, userId }, (response) => {
      if (response.error) {
        console.log(`❌ ${username} failed to join room: ${response.error}`);
      } else {
        console.log(`✅ ${username} successfully joined room ${roomId}`);
        console.log(`   Users in room: ${response.users.map(u => u.username).join(', ')}`);
      }
    });
  });

  socket.on('connect_error', (error) => {
    console.log(`❌ ${username} connection error: ${error.message}`);
  });

  socket.on('room-users-updated', (data) => {
    console.log(`📢 ${username} received user list update: ${data.users.map(u => u.username).join(', ')}`);
  });

  socket.on('user-joined', (users) => {
    console.log(`👋 ${username} saw user join. Current users: ${users.map(u => u.username).join(', ')}`);
  });

  socket.on('code-update', (code) => {
    console.log(`📝 ${username} received code update (${code.length} chars)`);
  });

  // Return socket for cleanup
  return socket;
}

// Run the test
async function runTest() {
  console.log('🚀 Starting socket connection and user management test...');
  
  const roomId = `test_room_${Date.now()}`;
  console.log(`📋 Test room ID: ${roomId}`);

  // Test with multiple users
  const user1Socket = testUserConnection('Alice', roomId);
  
  // Wait a bit before adding second user
  setTimeout(() => {
    const user2Socket = testUserConnection('Bob', roomId);
    
    // Wait a bit more before adding third user
    setTimeout(() => {
      const user3Socket = testUserConnection('Charlie', roomId);
      
      // Test code synchronization after all users join
      setTimeout(() => {
        console.log('\n📝 Testing code synchronization...');
        user1Socket.emit('code-change', { 
          roomId, 
          code: 'console.log("Hello from Alice!");' 
        });
      }, 2000);
      
      // Clean up after test
      setTimeout(() => {
        console.log('\n🧹 Cleaning up test...');
        user1Socket.disconnect();
        user2Socket.disconnect();
        user3Socket.disconnect();
        process.exit(0);
      }, 5000);
      
    }, 1500);
  }, 1000);
}

runTest().catch(console.error);
