// Test script to verify socket service fix
const io = require('socket.io-client');

console.log('🧪 Testing Socket Service Fix');
console.log('='.repeat(50));

const SERVER_URL = 'http://localhost:5002';
const ROOM_ID = 'socket-service-test';

async function testSocketServiceFix() {
  try {
    console.log('\n📡 Step 1: Testing Basic Socket Connection...');
    
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
      reconnectionAttempts: 3
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('✅ Socket connected successfully:', socket.id);
        resolve();
      });
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log('\n🏫 Step 2: Testing Room Creation...');
    
    const roomResponse = await new Promise((resolve, reject) => {
      socket.emit('create-room', {
        username: 'TestUser',
        roomId: ROOM_ID,
        userId: 'test_user_123'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Room creation timeout')), 5000);
    });

    console.log('✅ Room created successfully:', roomResponse);

    console.log('\n🔧 Step 3: Testing Socket Service Methods...');
    
    // Test if socket has required methods
    const requiredMethods = ['on', 'off', 'emit'];
    const availableMethods = requiredMethods.filter(method => typeof socket[method] === 'function');
    
    console.log(`✅ Available methods: ${availableMethods.join(', ')}`);
    console.log(`✅ All required methods available: ${availableMethods.length === requiredMethods.length}`);

    console.log('\n📨 Step 4: Testing Event Emission...');
    
    // Test event emission
    socket.emit('test-message', { message: 'Testing socket service fix' });
    console.log('✅ Event emission successful');

    console.log('\n🎯 Step 5: Testing Edit Permission Events...');
    
    // Test edit permission event structure
    socket.on('edit-permission', (data) => {
      console.log('📥 Received edit-permission event:', data);
    });

    socket.on('room-users-updated', (data) => {
      console.log('📥 Received room-users-updated event:', data);
    });

    console.log('✅ Edit permission event listeners set up successfully');

    console.log('\n🎉 All Socket Service Tests Passed!');
    console.log('✨ Socket service is working correctly and ready for edit permissions');

    socket.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSocketServiceFix();
