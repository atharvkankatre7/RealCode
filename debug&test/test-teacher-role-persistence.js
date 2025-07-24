// Test script to verify teacher role persistence after page refresh
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'test-teacher-persistence-' + Date.now();

console.log('🧪 Testing Teacher Role Persistence');
console.log('===================================');

// Test scenario:
// 1. User creates a room (becomes teacher)
// 2. User disconnects and reconnects (simulating page refresh)
// 3. Verify user still has teacher role

async function testTeacherRolePersistence() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'TestTeacher';

  console.log(`\n📝 Test Setup:`);
  console.log(`   Room ID: ${TEST_ROOM_ID}`);
  console.log(`   Teacher User ID: ${teacherUserId}`);
  console.log(`   Teacher Username: ${teacherUsername}`);

  // Step 1: Create room as teacher
  console.log(`\n🔧 Step 1: Creating room as teacher...`);
  const teacherSocket1 = io(SOCKET_URL);

  await new Promise((resolve, reject) => {
    teacherSocket1.on('connect', () => {
      console.log(`   ✅ Teacher connected with socket ID: ${teacherSocket1.id}`);
      
      teacherSocket1.emit('create-room', {
        roomId: TEST_ROOM_ID,
        username: teacherUsername,
        userId: teacherUserId
      }, (response) => {
        if (response.error) {
          console.log(`   ❌ Failed to create room: ${response.error}`);
          reject(new Error(response.error));
        } else {
          console.log(`   ✅ Room created successfully`);
          console.log(`   📊 Teacher role: ${response.role}`);
          console.log(`   👥 Users in room: ${response.users.length}`);
          
          if (response.role === 'teacher') {
            console.log(`   ✅ Teacher role assigned correctly on room creation`);
            resolve();
          } else {
            console.log(`   ❌ Expected teacher role, got: ${response.role}`);
            reject(new Error(`Expected teacher role, got: ${response.role}`));
          }
        }
      });
    });

    teacherSocket1.on('connect_error', (error) => {
      console.log(`   ❌ Teacher connection error: ${error.message}`);
      reject(error);
    });
  });

  // Step 2: Disconnect teacher (simulating page refresh)
  console.log(`\n🔄 Step 2: Disconnecting teacher (simulating page refresh)...`);
  teacherSocket1.disconnect();
  console.log(`   ✅ Teacher disconnected`);

  // Wait a moment to simulate real-world delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 3: Reconnect teacher and verify role persistence
  console.log(`\n🔌 Step 3: Reconnecting teacher and verifying role persistence...`);
  const teacherSocket2 = io(SOCKET_URL);

  await new Promise((resolve, reject) => {
    teacherSocket2.on('connect', () => {
      console.log(`   ✅ Teacher reconnected with socket ID: ${teacherSocket2.id}`);
      
      teacherSocket2.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: teacherUsername,
        userId: teacherUserId // Same user ID as before
      }, (response) => {
        if (response.error) {
          console.log(`   ❌ Failed to rejoin room: ${response.error}`);
          reject(new Error(response.error));
        } else {
          console.log(`   ✅ Successfully rejoined room`);
          console.log(`   📊 Teacher role after reconnection: ${response.role}`);
          console.log(`   👥 Users in room: ${response.users.length}`);
          
          if (response.role === 'teacher') {
            console.log(`   ✅ Teacher role persisted correctly after reconnection!`);
            resolve();
          } else {
            console.log(`   ❌ Teacher role lost! Expected 'teacher', got: ${response.role}`);
            reject(new Error(`Teacher role lost! Expected 'teacher', got: ${response.role}`));
          }
        }
      });
    });

    teacherSocket2.on('connect_error', (error) => {
      console.log(`   ❌ Teacher reconnection error: ${error.message}`);
      reject(error);
    });
  });

  // Step 4: Test student joining
  console.log(`\n👨‍🎓 Step 4: Testing student joining the room...`);
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUsername = 'TestStudent';
  const studentSocket = io(SOCKET_URL);

  await new Promise((resolve, reject) => {
    studentSocket.on('connect', () => {
      console.log(`   ✅ Student connected with socket ID: ${studentSocket.id}`);
      
      studentSocket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: studentUsername,
        userId: studentUserId
      }, (response) => {
        if (response.error) {
          console.log(`   ❌ Failed to join room as student: ${response.error}`);
          reject(new Error(response.error));
        } else {
          console.log(`   ✅ Student joined room successfully`);
          console.log(`   📊 Student role: ${response.role}`);
          console.log(`   👥 Users in room: ${response.users.length}`);
          
          if (response.role === 'student') {
            console.log(`   ✅ Student role assigned correctly`);
            resolve();
          } else {
            console.log(`   ❌ Expected student role, got: ${response.role}`);
            reject(new Error(`Expected student role, got: ${response.role}`));
          }
        }
      });
    });

    studentSocket.on('connect_error', (error) => {
      console.log(`   ❌ Student connection error: ${error.message}`);
      reject(error);
    });
  });

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket2.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  console.log(`\n🎉 Test completed successfully!`);
  console.log(`✅ Teacher role persistence is working correctly`);
  console.log(`✅ Student role assignment is working correctly`);
}

// Run the test
testTeacherRolePersistence()
  .then(() => {
    console.log(`\n🏆 ALL TESTS PASSED! Teacher role persistence is working correctly.`);
    process.exit(0);
  })
  .catch((error) => {
    console.log(`\n💥 TEST FAILED: ${error.message}`);
    process.exit(1);
  });
