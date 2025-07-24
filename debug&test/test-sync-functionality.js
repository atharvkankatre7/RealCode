// Test script to verify the new sync functionality for teacher highlights and cursor
const io = require('socket.io-client');

console.log('🧪 Testing Enhanced Teacher Sync Functionality');
console.log('='.repeat(60));

// Test configuration
const SERVER_URL = 'http://localhost:5002';
const ROOM_ID = 'sync-test-room';
const TEACHER_USER = {
  username: 'TestTeacher',
  userId: 'teacher_sync_test_123'
};
const STUDENT_USER = {
  username: 'TestStudent',
  userId: 'student_sync_test_456'
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

async function runTests() {
  try {
    console.log('\n📡 Step 1: Connecting Teacher Socket...');
    teacherSocket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      timeout: 5000
    });

    await new Promise((resolve, reject) => {
      teacherSocket.on('connect', () => {
        console.log('✅ Teacher socket connected:', teacherSocket.id);
        resolve();
      });
      teacherSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Teacher connection timeout')), 5000);
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

    console.log('\n📝 Step 3: Teacher Setting Up Code and State...');
    
    // Simulate teacher typing code
    const testCode = `function teacherExample() {
  console.log("This is teacher code");
  return "Hello from teacher!";
}`;
    
    teacherSocket.emit('code-change', {
      roomId: ROOM_ID,
      code: testCode
    });

    // Simulate teacher making a selection
    const teacherSelection = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 30
    };

    teacherSocket.emit('teacher-selection', {
      roomId: ROOM_ID,
      selection: teacherSelection
    });

    // Simulate teacher cursor position
    const teacherCursor = {
      lineNumber: 3,
      column: 15
    };

    teacherSocket.emit('teacher-cursor-position', {
      roomId: ROOM_ID,
      position: teacherCursor
    });

    await delay(1000); // Give time for state to be set

    console.log('\n👨‍🎓 Step 4: Student Connecting (This should trigger sync)...');
    studentSocket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      timeout: 5000
    });

    await new Promise((resolve, reject) => {
      studentSocket.on('connect', () => {
        console.log('✅ Student socket connected:', studentSocket.id);
        resolve();
      });
      studentSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student connection timeout')), 5000);
    });

    console.log('\n🎯 Step 5: Setting up Student Event Listeners...');
    
    let syncCodeReceived = false;
    let syncSelectionReceived = false;
    let syncCursorReceived = false;
    let userJoinedReceived = false;

    studentSocket.on('sync-code', (data) => {
      console.log('📥 Student received sync-code:', data.code.substring(0, 50) + '...');
      syncCodeReceived = data.code === testCode;
    });

    studentSocket.on('sync-teacher-selection', (data) => {
      console.log('📥 Student received sync-teacher-selection:', data.selection);
      syncSelectionReceived = JSON.stringify(data.selection) === JSON.stringify(teacherSelection);
    });

    studentSocket.on('sync-teacher-cursor', (data) => {
      console.log('📥 Student received sync-teacher-cursor:', data.position);
      syncCursorReceived = JSON.stringify(data.position) === JSON.stringify(teacherCursor);
    });

    studentSocket.on('user-joined', (data) => {
      console.log('📥 Student received user-joined event:', data);
      userJoinedReceived = true;
    });

    // Set up teacher to listen for user-joined events
    teacherSocket.on('user-joined', (data) => {
      console.log('📥 Teacher received user-joined event:', data);
      
      if (data.newUserSocketId) {
        console.log('🎯 Teacher triggering sync for new user:', data.newUserSocketId);
        
        // Teacher should send sync events
        teacherSocket.emit('sync-code', {
          roomId: ROOM_ID,
          code: testCode,
          targetSocketId: data.newUserSocketId
        });

        teacherSocket.emit('sync-teacher-selection', {
          roomId: ROOM_ID,
          selection: teacherSelection,
          targetSocketId: data.newUserSocketId
        });

        teacherSocket.emit('sync-teacher-cursor', {
          roomId: ROOM_ID,
          position: teacherCursor,
          targetSocketId: data.newUserSocketId
        });
      }
    });

    console.log('\n🚪 Step 6: Student Joining Room...');
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
      `Role: ${studentRoomResponse.role}, Users: ${studentRoomResponse.users?.length}`);

    console.log('\n⏳ Step 7: Waiting for Sync Events...');
    await delay(3000); // Wait for sync events to be processed

    console.log('\n📊 Step 8: Verifying Sync Results...');
    logResult('Sync Code Event', syncCodeReceived, syncCodeReceived ? 'Code synced correctly' : 'Code not synced');
    logResult('Sync Selection Event', syncSelectionReceived, syncSelectionReceived ? 'Selection synced correctly' : 'Selection not synced');
    logResult('Sync Cursor Event', syncCursorReceived, syncCursorReceived ? 'Cursor synced correctly' : 'Cursor not synced');

    console.log('\n🧪 Step 9: Testing Real-time Updates...');
    
    // Test real-time teacher selection
    let realtimeSelectionReceived = false;
    studentSocket.on('teacher-selection', (data) => {
      console.log('📥 Student received real-time teacher-selection:', data.selection);
      realtimeSelectionReceived = true;
    });

    const newSelection = {
      startLineNumber: 2,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 20
    };

    teacherSocket.emit('teacher-selection', {
      roomId: ROOM_ID,
      selection: newSelection
    });

    await delay(1000);
    logResult('Real-time Selection Update', realtimeSelectionReceived, 'New selection broadcasted correctly');

    console.log('\n📈 Final Results:');
    console.log('='.repeat(60));
    
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Sync functionality is working correctly.');
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
runTests().catch(console.error);
