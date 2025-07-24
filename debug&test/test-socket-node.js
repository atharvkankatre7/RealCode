// Simple Node.js Socket.IO connection test
const io = require('socket.io-client');

console.log('🧪 Testing Socket.IO Connection from Node.js');
console.log('='.repeat(50));

const SERVER_URL = 'http://localhost:5002';

// Test 1: Polling transport
console.log('\n📡 Test 1: Polling Transport');
const pollingSocket = io(SERVER_URL, {
  transports: ['polling'],
  timeout: 10000,
  reconnectionAttempts: 2
});

pollingSocket.on('connect', () => {
  console.log('✅ Polling connection successful!');
  console.log(`   Socket ID: ${pollingSocket.id}`);
  console.log(`   Transport: ${pollingSocket.io.engine.transport.name}`);
  
  // Test message
  pollingSocket.emit('test-message', { message: 'Hello from Node.js polling!' });
  
  setTimeout(() => {
    pollingSocket.disconnect();
    testWebSocket();
  }, 2000);
});

pollingSocket.on('connect_error', (error) => {
  console.log('❌ Polling connection failed:', error.message);
  testWebSocket();
});

pollingSocket.on('test-response', (data) => {
  console.log('📨 Received test response:', data);
});

// Test 2: WebSocket transport
function testWebSocket() {
  console.log('\n🌐 Test 2: WebSocket Transport');
  
  const wsSocket = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: 10000,
    reconnectionAttempts: 2
  });

  wsSocket.on('connect', () => {
    console.log('✅ WebSocket connection successful!');
    console.log(`   Socket ID: ${wsSocket.id}`);
    console.log(`   Transport: ${wsSocket.io.engine.transport.name}`);
    
    // Test message
    wsSocket.emit('test-message', { message: 'Hello from Node.js WebSocket!' });
    
    setTimeout(() => {
      wsSocket.disconnect();
      testMixed();
    }, 2000);
  });

  wsSocket.on('connect_error', (error) => {
    console.log('❌ WebSocket connection failed:', error.message);
    testMixed();
  });

  wsSocket.on('test-response', (data) => {
    console.log('📨 Received test response:', data);
  });
}

// Test 3: Mixed transports (default)
function testMixed() {
  console.log('\n🔄 Test 3: Mixed Transports (Default)');
  
  const mixedSocket = io(SERVER_URL, {
    transports: ['polling', 'websocket'],
    timeout: 10000,
    reconnectionAttempts: 2
  });

  mixedSocket.on('connect', () => {
    console.log('✅ Mixed transport connection successful!');
    console.log(`   Socket ID: ${mixedSocket.id}`);
    console.log(`   Transport: ${mixedSocket.io.engine.transport.name}`);
    
    // Test message
    mixedSocket.emit('test-message', { message: 'Hello from Node.js mixed!' });
    
    setTimeout(() => {
      mixedSocket.disconnect();
      console.log('\n🎉 All tests completed!');
      process.exit(0);
    }, 2000);
  });

  mixedSocket.on('connect_error', (error) => {
    console.log('❌ Mixed transport connection failed:', error.message);
    console.log('\n❌ All connection tests failed!');
    process.exit(1);
  });

  mixedSocket.on('test-response', (data) => {
    console.log('📨 Received test response:', data);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

setTimeout(() => {
  console.log('\n⏰ Test timeout - exiting');
  process.exit(1);
}, 30000);
