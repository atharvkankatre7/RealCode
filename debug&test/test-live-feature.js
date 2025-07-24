// Test script to verify teacher pointer and text highlighting feature in real-time
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'live-test-' + Date.now();

console.log('🎯 Testing Live Teacher Pointer and Text Highlighting Feature');
console.log('===========================================================');

async function testLiveFeature() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'LiveTeacher';
  const studentUsername = 'LiveStudent';

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

  // Step 3: Set up student listeners
  console.log(`\n👂 Step 3: Setting up student event listeners...`);
  
  let cursorEventsReceived = 0;
  let textHighlightEventsReceived = 0;
  let clearHighlightEventsReceived = 0;
  
  studentSocket.on('teacher-cursor-position', (data) => {
    cursorEventsReceived++;
    console.log(`   📍 Student received teacher cursor position #${cursorEventsReceived}:`, {
      position: data.position,
      teacher: data.teacherName
    });
  });

  studentSocket.on('teacher-text-highlight', (data) => {
    textHighlightEventsReceived++;
    console.log(`   🎨 Student received teacher text highlight #${textHighlightEventsReceived}:`, {
      selection: data.selection,
      teacher: data.teacherName
    });
  });

  studentSocket.on('clear-teacher-text-highlight', (data) => {
    clearHighlightEventsReceived++;
    console.log(`   🧹 Student received clear teacher text highlight #${clearHighlightEventsReceived}:`, {
      teacher: data.teacherName
    });
  });

  console.log(`   ✅ Student event listeners set up`);

  // Step 4: Simulate teacher cursor movements
  console.log(`\n🖱️ Step 4: Simulating teacher cursor movements...`);
  
  const cursorPositions = [
    { lineNumber: 1, column: 1 },
    { lineNumber: 2, column: 5 },
    { lineNumber: 3, column: 10 },
    { lineNumber: 4, column: 15 },
    { lineNumber: 5, column: 20 }
  ];

  for (let i = 0; i < cursorPositions.length; i++) {
    const position = cursorPositions[i];
    console.log(`   📍 Teacher sending cursor position ${i + 1}: Line ${position.lineNumber}, Column ${position.column}`);
    
    teacherSocket.emit('teacher-cursor-position', {
      roomId: TEST_ROOM_ID,
      position: position
    });
    
    // Wait a bit between cursor movements
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 5: Simulate teacher text selections
  console.log(`\n🎨 Step 5: Simulating teacher text selections...`);
  
  const textSelections = [
    {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 10
    },
    {
      startLineNumber: 2,
      startColumn: 5,
      endLineNumber: 3,
      endColumn: 15
    },
    {
      startLineNumber: 4,
      startColumn: 1,
      endLineNumber: 4,
      endColumn: 25
    }
  ];

  for (let i = 0; i < textSelections.length; i++) {
    const selection = textSelections[i];
    console.log(`   🎨 Teacher sending text highlight ${i + 1}:`, selection);
    
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: selection
    });
    
    // Wait a bit between selections
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear the selection
    console.log(`   🧹 Teacher clearing text highlight ${i + 1}`);
    teacherSocket.emit('clear-teacher-text-highlight', {
      roomId: TEST_ROOM_ID
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 6: Wait and check results
  console.log(`\n⏳ Step 6: Waiting for all events to be processed...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n📊 Final Results:`);
  console.log(`   Cursor Position Events Received: ${cursorEventsReceived}/${cursorPositions.length}`);
  console.log(`   Text Highlight Events Received: ${textHighlightEventsReceived}/${textSelections.length}`);
  console.log(`   Clear Highlight Events Received: ${clearHighlightEventsReceived}/${textSelections.length}`);

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  const allEventsReceived = (
    cursorEventsReceived === cursorPositions.length &&
    textHighlightEventsReceived === textSelections.length &&
    clearHighlightEventsReceived === textSelections.length
  );

  if (allEventsReceived) {
    console.log(`\n🎉 SUCCESS: All teacher pointer and text highlighting events are working correctly!`);
    return true;
  } else {
    console.log(`\n❌ FAILURE: Some events were not received properly.`);
    return false;
  }
}

// Run the test
testLiveFeature()
  .then((success) => {
    if (success) {
      console.log(`\n🏆 LIVE TEST PASSED! Teacher pointer and text highlighting feature is working correctly.`);
      process.exit(0);
    } else {
      console.log(`\n💥 LIVE TEST FAILED! Please check the implementation.`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(`\n💥 LIVE TEST ERROR: ${error.message}`);
    process.exit(1);
  });
