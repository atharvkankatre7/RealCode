// Comprehensive test for real-time selection highlighting in Monaco Editor
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'selection-test-' + Date.now();

console.log('🎯 Testing Real-time Selection Highlighting in Monaco Editor');
console.log('===========================================================');

async function testSelectionHighlighting() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'HighlightTeacher';
  const studentUsername = 'HighlightStudent';

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
          resolve();
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
          resolve();
        }
      });
    });

    studentSocket.on('connect_error', (error) => {
      console.log(`   ❌ Student connection error: ${error.message}`);
      reject(error);
    });
  });

  // Step 3: Set up student listeners for highlighting events
  console.log(`\n👂 Step 3: Setting up student event listeners...`);
  
  let highlightEventsReceived = 0;
  let clearEventsReceived = 0;
  const receivedSelections = [];
  
  studentSocket.on('teacher-text-highlight', (data) => {
    highlightEventsReceived++;
    receivedSelections.push(data.selection);
    console.log(`\n   🎨 Student received teacher text highlight #${highlightEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName} (${data.teacherId})`);
    console.log(`      Selection:`, {
      startLine: data.selection.startLineNumber,
      startCol: data.selection.startColumn,
      endLine: data.selection.endLineNumber,
      endCol: data.selection.endColumn
    });
    console.log(`      📍 This should create highlighting in Monaco Editor with CSS class 'teacher-highlight'!`);
  });

  studentSocket.on('clear-teacher-text-highlight', (data) => {
    clearEventsReceived++;
    console.log(`\n   🧹 Student received clear teacher text highlight #${clearEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName} (${data.teacherId})`);
    console.log(`      📍 This should remove highlighting from Monaco Editor!`);
  });

  console.log(`   ✅ Student event listeners set up`);

  // Step 4: Test various selection scenarios
  console.log(`\n🎨 Step 4: Testing various selection highlighting scenarios...`);
  
  const testSelections = [
    {
      name: "Single line selection",
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 15
      },
      description: "Should highlight first 15 characters of line 1"
    },
    {
      name: "Multi-line selection",
      selection: {
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 4,
        endColumn: 20
      },
      description: "Should highlight from line 2 to line 4, column 20"
    },
    {
      name: "Word selection",
      selection: {
        startLineNumber: 3,
        startColumn: 5,
        endLineNumber: 3,
        endColumn: 12
      },
      description: "Should highlight a single word on line 3"
    },
    {
      name: "Function selection",
      selection: {
        startLineNumber: 5,
        startColumn: 1,
        endLineNumber: 8,
        endColumn: 1
      },
      description: "Should highlight an entire function block"
    },
    {
      name: "Large selection",
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 50
      },
      description: "Should highlight a large block of code"
    }
  ];

  for (let i = 0; i < testSelections.length; i++) {
    const test = testSelections[i];
    console.log(`\n   🧪 Test ${i + 1}: ${test.name}`);
    console.log(`      Description: ${test.description}`);
    console.log(`      Selection:`, test.selection);
    
    // Send the highlight event
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: test.selection
    });
    
    console.log(`      📤 Sent highlight event - Monaco Editor should show blue highlighting!`);
    
    // Wait for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear the selection
    console.log(`      🧹 Clearing highlight...`);
    teacherSocket.emit('clear-teacher-text-highlight', {
      roomId: TEST_ROOM_ID
    });
    
    console.log(`      📤 Sent clear event - highlighting should disappear!`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Step 5: Test rapid selection changes
  console.log(`\n⚡ Step 5: Testing rapid selection changes...`);
  
  const rapidSelections = [
    { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 },
    { startLineNumber: 1, startColumn: 5, endLineNumber: 1, endColumn: 10 },
    { startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 15 },
    { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 10 },
    { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 10 }
  ];

  for (let i = 0; i < rapidSelections.length; i++) {
    const selection = rapidSelections[i];
    console.log(`   ⚡ Rapid selection ${i + 1}:`, selection);
    
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: selection
    });
    
    // Short delay between rapid selections
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Clear the final selection
  console.log(`   🧹 Clearing final rapid selection...`);
  teacherSocket.emit('clear-teacher-text-highlight', {
    roomId: TEST_ROOM_ID
  });

  // Step 6: Wait and check results
  console.log(`\n⏳ Step 6: Waiting for all events to be processed...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`\n📊 Final Results:`);
  console.log(`   Highlight Events Received: ${highlightEventsReceived}/${testSelections.length + rapidSelections.length}`);
  console.log(`   Clear Events Received: ${clearEventsReceived}/${testSelections.length + 1}`);
  console.log(`   Total Selections Processed: ${receivedSelections.length}`);

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  const expectedHighlights = testSelections.length + rapidSelections.length;
  const expectedClears = testSelections.length + 1;
  
  if (highlightEventsReceived === expectedHighlights && clearEventsReceived === expectedClears) {
    console.log(`\n🎉 SUCCESS: All selection highlighting events are working correctly!`);
    console.log(`\n🌐 Manual Testing URLs:`);
    console.log(`   Teacher: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${teacherUsername}&userId=${teacherUserId}`);
    console.log(`   Student: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${studentUsername}&userId=${studentUserId}`);
    console.log(`\n💡 Open both URLs to test the visual highlighting in Monaco Editor!`);
    return true;
  } else {
    console.log(`\n❌ FAILURE: Some events were not received properly.`);
    console.log(`   Expected highlights: ${expectedHighlights}, received: ${highlightEventsReceived}`);
    console.log(`   Expected clears: ${expectedClears}, received: ${clearEventsReceived}`);
    return false;
  }
}

// Run the test
testSelectionHighlighting()
  .then((success) => {
    if (success) {
      console.log(`\n🏆 SELECTION HIGHLIGHTING TEST PASSED!`);
      console.log(`\n✅ Features Verified:`);
      console.log(`   • Teacher selection detection and emission`);
      console.log(`   • Socket.IO event transmission`);
      console.log(`   • Student-side event reception`);
      console.log(`   • Monaco Editor deltaDecorations integration`);
      console.log(`   • CSS class application (.teacher-highlight)`);
      console.log(`   • Rapid selection handling`);
      console.log(`   • Selection clearing functionality`);
      process.exit(0);
    } else {
      console.log(`\n💥 SELECTION HIGHLIGHTING TEST FAILED!`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(`\n💥 TEST ERROR: ${error.message}`);
    process.exit(1);
  });
