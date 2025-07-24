// Debug script to test Monaco Editor text highlighting
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'debug-monaco-' + Date.now();

console.log('🔍 Debugging Monaco Editor Text Highlighting');
console.log('============================================');

async function debugMonacoHighlighting() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'DebugTeacher';
  const studentUsername = 'DebugStudent';

  console.log(`\n📝 Debug Setup:`);
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

  // Step 3: Set up detailed student listeners
  console.log(`\n👂 Step 3: Setting up detailed student event listeners...`);
  
  let textHighlightEventsReceived = 0;
  let clearHighlightEventsReceived = 0;
  
  studentSocket.on('teacher-text-highlight', (data) => {
    textHighlightEventsReceived++;
    console.log(`\n   🎨 Student received teacher text highlight #${textHighlightEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName} (${data.teacherId})`);
    console.log(`      Selection:`, JSON.stringify(data.selection, null, 8));
    
    // Validate selection data structure
    if (data.selection) {
      const { startLineNumber, startColumn, endLineNumber, endColumn } = data.selection;
      console.log(`      Validation:`);
      console.log(`        startLineNumber: ${startLineNumber} (type: ${typeof startLineNumber})`);
      console.log(`        startColumn: ${startColumn} (type: ${typeof startColumn})`);
      console.log(`        endLineNumber: ${endLineNumber} (type: ${typeof endLineNumber})`);
      console.log(`        endColumn: ${endColumn} (type: ${typeof endColumn})`);
      
      // Check if all required fields are present and valid
      const isValid = (
        typeof startLineNumber === 'number' && startLineNumber > 0 &&
        typeof startColumn === 'number' && startColumn > 0 &&
        typeof endLineNumber === 'number' && endLineNumber > 0 &&
        typeof endColumn === 'number' && endColumn > 0
      );
      
      console.log(`        Selection is valid: ${isValid ? '✅' : '❌'}`);
      
      if (isValid) {
        console.log(`        Monaco Range would be: new monaco.Range(${startLineNumber}, ${startColumn}, ${endLineNumber}, ${endColumn})`);
      }
    } else {
      console.log(`      ❌ Selection data is missing!`);
    }
  });

  studentSocket.on('clear-teacher-text-highlight', (data) => {
    clearHighlightEventsReceived++;
    console.log(`\n   🧹 Student received clear teacher text highlight #${clearHighlightEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName} (${data.teacherId})`);
  });

  console.log(`   ✅ Student event listeners set up`);

  // Step 4: Test various text selection scenarios
  console.log(`\n🎨 Step 4: Testing various text selection scenarios...`);
  
  const testSelections = [
    {
      name: "Single line selection",
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 10
      }
    },
    {
      name: "Multi-line selection",
      selection: {
        startLineNumber: 2,
        startColumn: 5,
        endLineNumber: 4,
        endColumn: 15
      }
    },
    {
      name: "Single character selection",
      selection: {
        startLineNumber: 3,
        startColumn: 8,
        endLineNumber: 3,
        endColumn: 9
      }
    },
    {
      name: "Whole line selection",
      selection: {
        startLineNumber: 5,
        startColumn: 1,
        endLineNumber: 5,
        endColumn: 100
      }
    },
    {
      name: "Large multi-line selection",
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 10,
        endColumn: 50
      }
    }
  ];

  for (let i = 0; i < testSelections.length; i++) {
    const test = testSelections[i];
    console.log(`\n   🧪 Test ${i + 1}: ${test.name}`);
    console.log(`      Sending selection:`, JSON.stringify(test.selection, null, 8));
    
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: test.selection
    });
    
    // Wait for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clear the selection
    console.log(`      Clearing selection...`);
    teacherSocket.emit('clear-teacher-text-highlight', {
      roomId: TEST_ROOM_ID
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 5: Test edge cases
  console.log(`\n🚨 Step 5: Testing edge cases...`);
  
  const edgeCases = [
    {
      name: "Invalid selection (missing fields)",
      selection: {
        startLineNumber: 1,
        startColumn: 1
        // Missing endLineNumber and endColumn
      }
    },
    {
      name: "Invalid selection (zero values)",
      selection: {
        startLineNumber: 0,
        startColumn: 0,
        endLineNumber: 0,
        endColumn: 0
      }
    },
    {
      name: "Invalid selection (negative values)",
      selection: {
        startLineNumber: -1,
        startColumn: -1,
        endLineNumber: -1,
        endColumn: -1
      }
    },
    {
      name: "Invalid selection (string values)",
      selection: {
        startLineNumber: "1",
        startColumn: "1",
        endLineNumber: "2",
        endColumn: "10"
      }
    }
  ];

  for (let i = 0; i < edgeCases.length; i++) {
    const test = edgeCases[i];
    console.log(`\n   ⚠️ Edge Case ${i + 1}: ${test.name}`);
    console.log(`      Sending selection:`, JSON.stringify(test.selection, null, 8));
    
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: test.selection
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 6: Wait and check results
  console.log(`\n⏳ Step 6: Waiting for all events to be processed...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n📊 Final Results:`);
  console.log(`   Text Highlight Events Received: ${textHighlightEventsReceived}/${testSelections.length + edgeCases.length}`);
  console.log(`   Clear Highlight Events Received: ${clearHighlightEventsReceived}/${testSelections.length}`);

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  const expectedHighlights = testSelections.length + edgeCases.length;
  const expectedClears = testSelections.length;
  
  if (textHighlightEventsReceived === expectedHighlights && clearHighlightEventsReceived === expectedClears) {
    console.log(`\n🎉 SUCCESS: All events were received correctly!`);
    console.log(`\n💡 If highlighting is not working in the UI, the issue is likely:`);
    console.log(`   1. Monaco Editor instance not available when event is received`);
    console.log(`   2. CSS class not being applied correctly`);
    console.log(`   3. Monaco Range creation failing`);
    console.log(`   4. deltaDecorations not working as expected`);
    return true;
  } else {
    console.log(`\n❌ FAILURE: Some events were not received properly.`);
    console.log(`   Expected highlights: ${expectedHighlights}, received: ${textHighlightEventsReceived}`);
    console.log(`   Expected clears: ${expectedClears}, received: ${clearHighlightEventsReceived}`);
    return false;
  }
}

// Run the debug test
debugMonacoHighlighting()
  .then((success) => {
    if (success) {
      console.log(`\n🏆 DEBUG TEST PASSED! Socket events are working correctly.`);
      console.log(`\n🔧 Next steps to debug UI issues:`);
      console.log(`   1. Check browser console for Monaco Editor errors`);
      console.log(`   2. Verify Monaco Editor instance is available`);
      console.log(`   3. Test CSS class application manually`);
      console.log(`   4. Check if deltaDecorations is working`);
      process.exit(0);
    } else {
      console.log(`\n💥 DEBUG TEST FAILED! Socket events are not working properly.`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(`\n💥 DEBUG TEST ERROR: ${error.message}`);
    process.exit(1);
  });
