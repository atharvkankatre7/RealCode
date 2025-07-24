// Test script to verify teacher pointer and text highlighting feature
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'test-teacher-pointer-' + Date.now();

console.log('🎯 Testing Teacher Pointer and Text Highlighting Feature');
console.log('=====================================================');

// Test scenario:
// 1. Teacher creates a room
// 2. Student joins the room
// 3. Teacher moves cursor and makes text selections
// 4. Verify student receives cursor position and text highlight events

async function testTeacherPointerAndHighlighting() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'TestTeacher';
  const studentUsername = 'TestStudent';

  console.log(`\n📝 Test Setup:`);
  console.log(`   Room ID: ${TEST_ROOM_ID}`);
  console.log(`   Teacher User ID: ${teacherUserId}`);
  console.log(`   Student User ID: ${studentUserId}`);

  // Step 1: Create room as teacher
  console.log(`\n🔧 Step 1: Creating room as teacher...`);
  const teacherSocket = io(SOCKET_URL);

  await new Promise((resolve, reject) => {
    teacherSocket.on('connect', () => {
      console.log(`   ✅ Teacher connected with socket ID: ${teacherSocket.id}`);
      
      teacherSocket.emit('create-room', {
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
          
          if (response.role === 'teacher') {
            console.log(`   ✅ Teacher role assigned correctly`);
            resolve();
          } else {
            console.log(`   ❌ Expected teacher role, got: ${response.role}`);
            reject(new Error(`Expected teacher role, got: ${response.role}`));
          }
        }
      });
    });

    teacherSocket.on('connect_error', (error) => {
      console.log(`   ❌ Teacher connection error: ${error.message}`);
      reject(error);
    });
  });

  // Step 2: Student joins the room
  console.log(`\n👨‍🎓 Step 2: Student joining the room...`);
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

  // Step 3: Test teacher cursor position broadcasting
  console.log(`\n🖱️ Step 3: Testing teacher cursor position broadcasting...`);
  
  let cursorPositionReceived = false;
  
  studentSocket.on('teacher-cursor-position', (data) => {
    console.log(`   ✅ Student received teacher cursor position:`, data);
    console.log(`      Position: Line ${data.position.lineNumber}, Column ${data.position.column}`);
    console.log(`      Teacher: ${data.teacherName}`);
    cursorPositionReceived = true;
  });

  // Teacher sends cursor position
  teacherSocket.emit('teacher-cursor-position', {
    roomId: TEST_ROOM_ID,
    position: { lineNumber: 5, column: 10 }
  });

  // Wait for student to receive cursor position
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (cursorPositionReceived) {
        clearInterval(checkInterval);
        console.log(`   ✅ Teacher cursor position successfully received by student`);
        resolve();
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!cursorPositionReceived) {
        console.log(`   ❌ Student did not receive teacher cursor position`);
      }
      resolve();
    }, 3000);
  });

  // Step 4: Test teacher text highlighting
  console.log(`\n🎨 Step 4: Testing teacher text highlighting...`);
  
  let textHighlightReceived = false;
  
  studentSocket.on('teacher-text-highlight', (data) => {
    console.log(`   ✅ Student received teacher text highlight:`, data);
    console.log(`      Selection: Line ${data.selection.startLineNumber}-${data.selection.endLineNumber}, Column ${data.selection.startColumn}-${data.selection.endColumn}`);
    console.log(`      Teacher: ${data.teacherName}`);
    textHighlightReceived = true;
  });

  // Teacher sends text highlight
  teacherSocket.emit('teacher-text-highlight', {
    roomId: TEST_ROOM_ID,
    selection: {
      startLineNumber: 3,
      startColumn: 1,
      endLineNumber: 3,
      endColumn: 15
    }
  });

  // Wait for student to receive text highlight
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (textHighlightReceived) {
        clearInterval(checkInterval);
        console.log(`   ✅ Teacher text highlight successfully received by student`);
        resolve();
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!textHighlightReceived) {
        console.log(`   ❌ Student did not receive teacher text highlight`);
      }
      resolve();
    }, 3000);
  });

  // Step 5: Test clearing teacher text highlight
  console.log(`\n🧹 Step 5: Testing clearing teacher text highlight...`);
  
  let clearHighlightReceived = false;
  
  studentSocket.on('clear-teacher-text-highlight', (data) => {
    console.log(`   ✅ Student received clear teacher text highlight:`, data);
    console.log(`      Teacher: ${data.teacherName}`);
    clearHighlightReceived = true;
  });

  // Teacher clears text highlight
  teacherSocket.emit('clear-teacher-text-highlight', {
    roomId: TEST_ROOM_ID
  });

  // Wait for student to receive clear highlight
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (clearHighlightReceived) {
        clearInterval(checkInterval);
        console.log(`   ✅ Clear teacher text highlight successfully received by student`);
        resolve();
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!clearHighlightReceived) {
        console.log(`   ❌ Student did not receive clear teacher text highlight`);
      }
      resolve();
    }, 3000);
  });

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  console.log(`\n🎉 Test completed!`);
  
  const results = {
    cursorPosition: cursorPositionReceived,
    textHighlight: textHighlightReceived,
    clearHighlight: clearHighlightReceived
  };
  
  console.log(`\n📊 Test Results:`);
  console.log(`   Cursor Position Broadcasting: ${results.cursorPosition ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Text Highlighting: ${results.textHighlight ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Clear Highlighting: ${results.clearHighlight ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  return allPassed;
}

// Run the test
testTeacherPointerAndHighlighting()
  .then((success) => {
    if (success) {
      console.log(`\n🏆 ALL TESTS PASSED! Teacher pointer and text highlighting feature is working correctly.`);
      process.exit(0);
    } else {
      console.log(`\n💥 SOME TESTS FAILED! Please check the implementation.`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(`\n💥 TEST FAILED: ${error.message}`);
    process.exit(1);
  });
