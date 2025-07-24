// Test script for dynamic edit permissions functionality
const io = require('socket.io-client');

console.log('🧪 Testing Dynamic Edit Permissions Functionality');
console.log('='.repeat(60));

// Test configuration
const SERVER_URL = 'http://localhost:5002';
const ROOM_ID = 'edit-permissions-test';
const TEACHER_USER = {
  username: 'TestTeacher',
  userId: 'teacher_edit_test_123'
};
const STUDENT_USER = {
  username: 'TestStudent',
  userId: 'student_edit_test_456'
};

let teacherSocket, studentSocket;
let testResults = [];

function logResult(test, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const message = `${status} - ${test}${details ? ': ' + details : ''}`;
  console.log(message);
  testResults.push({ test, passed, details });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEditPermissionTests() {
  try {
    console.log('\n📡 Step 1: Connecting Teacher Socket...');
    teacherSocket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
      reconnectionAttempts: 3
    });

    await new Promise((resolve, reject) => {
      teacherSocket.on('connect', () => {
        console.log('✅ Teacher socket connected:', teacherSocket.id);
        resolve();
      });
      teacherSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Teacher connection timeout')), 10000);
    });

    console.log('\n🏫 Step 2: Teacher Creating Room...');
    const teacherRoomResponse = await new Promise((resolve, reject) => {
      teacherSocket.emit('create-room', {
        username: TEACHER_USER.username,
        roomId: ROOM_ID,
        userId: TEACHER_USER.userId
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Create room timeout')), 5000);
    });

    logResult('Teacher room creation', teacherRoomResponse.roomId === ROOM_ID, 
      `Room: ${teacherRoomResponse.roomId}, Role: ${teacherRoomResponse.role}`);

    console.log('\n👨‍🎓 Step 3: Student Connecting...');
    studentSocket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 10000,
      reconnectionAttempts: 3
    });

    await new Promise((resolve, reject) => {
      studentSocket.on('connect', () => {
        console.log('✅ Student socket connected:', studentSocket.id);
        resolve();
      });
      studentSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student connection timeout')), 10000);
    });

    console.log('\n🚪 Step 4: Student Joining Room...');
    let studentEditPermission = null;
    let roomUsersUpdated = null;

    // Listen for edit permission events
    studentSocket.on('edit-permission', (data) => {
      console.log('📥 Student received edit-permission:', data);
      studentEditPermission = data.canEdit;
    });

    // Listen for room users updates
    studentSocket.on('room-users-updated', (data) => {
      console.log('📥 Received room-users-updated:', data);
      roomUsersUpdated = data;
    });

    const studentRoomResponse = await new Promise((resolve, reject) => {
      studentSocket.emit('join-room', {
        roomId: ROOM_ID,
        username: STUDENT_USER.username,
        userId: STUDENT_USER.userId
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Join room timeout')), 5000);
    });

    logResult('Student room join', studentRoomResponse.success === true, 
      `Role: ${studentRoomResponse.role}`);

    await delay(2000); // Wait for initial permission events

    logResult('Student initial edit permission', studentEditPermission === false, 
      `Initial permission: ${studentEditPermission}`);

    console.log('\n🔧 Step 5: Teacher Setting Edit Permission to TRUE...');
    let permissionChangeReceived = false;
    let updatedUsersReceived = false;

    studentSocket.on('edit-permission', (data) => {
      if (data.canEdit === true) {
        console.log('📥 Student received edit permission GRANTED:', data);
        permissionChangeReceived = true;
      }
    });

    studentSocket.on('room-users-updated', (data) => {
      const student = data.users.find(u => u.userId === STUDENT_USER.userId);
      if (student && student.canEdit === true) {
        console.log('📥 Student found in updated users with edit permission:', student);
        updatedUsersReceived = true;
      }
    });

    // Teacher grants edit permission
    teacherSocket.emit('set-edit-permission', {
      roomId: ROOM_ID,
      targetSocketId: studentSocket.id,
      canEdit: true
    });

    await delay(2000); // Wait for permission change events

    logResult('Permission change to TRUE received', permissionChangeReceived, 
      'Student received edit permission grant');
    logResult('Room users updated with permission', updatedUsersReceived, 
      'Student appears in user list with canEdit: true');

    console.log('\n🔒 Step 6: Teacher Revoking Edit Permission...');
    let permissionRevokeReceived = false;
    let revokeUsersReceived = false;

    studentSocket.on('edit-permission', (data) => {
      if (data.canEdit === false) {
        console.log('📥 Student received edit permission REVOKED:', data);
        permissionRevokeReceived = true;
      }
    });

    studentSocket.on('room-users-updated', (data) => {
      const student = data.users.find(u => u.userId === STUDENT_USER.userId);
      if (student && student.canEdit === false) {
        console.log('📥 Student found in updated users with revoked permission:', student);
        revokeUsersReceived = true;
      }
    });

    // Teacher revokes edit permission
    teacherSocket.emit('set-edit-permission', {
      roomId: ROOM_ID,
      targetSocketId: studentSocket.id,
      canEdit: false
    });

    await delay(2000); // Wait for permission change events

    logResult('Permission change to FALSE received', permissionRevokeReceived, 
      'Student received edit permission revocation');
    logResult('Room users updated with revoked permission', revokeUsersReceived, 
      'Student appears in user list with canEdit: false');

    console.log('\n🔄 Step 7: Testing Multiple Permission Toggles...');
    let toggleCount = 0;
    const expectedToggles = 3;

    studentSocket.on('edit-permission', (data) => {
      toggleCount++;
      console.log(`📥 Toggle ${toggleCount}: canEdit = ${data.canEdit}`);
    });

    // Rapid permission toggles
    for (let i = 0; i < expectedToggles; i++) {
      const canEdit = i % 2 === 0; // Alternate true/false
      teacherSocket.emit('set-edit-permission', {
        roomId: ROOM_ID,
        targetSocketId: studentSocket.id,
        canEdit
      });
      await delay(500);
    }

    await delay(1000);

    logResult('Multiple permission toggles', toggleCount >= expectedToggles, 
      `Received ${toggleCount}/${expectedToggles} toggle events`);

    console.log('\n📊 Final Results:');
    console.log('='.repeat(60));
    
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL EDIT PERMISSION TESTS PASSED!');
      console.log('✨ Dynamic role-based editing permissions are working correctly!');
    } else {
      console.log('⚠️  Some tests failed. Check the implementation.');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`   ❌ ${r.test}: ${r.details}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    console.log('\n🧹 Cleaning up...');
    if (teacherSocket) teacherSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the tests
runEditPermissionTests().catch(console.error);
