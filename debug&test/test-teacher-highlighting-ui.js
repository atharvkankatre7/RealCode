// Test script to verify teacher text highlighting in the UI
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5001';
const TEST_ROOM_ID = 'ui-test-' + Date.now();

console.log('🎨 Testing Teacher Text Highlighting in UI');
console.log('==========================================');

async function testTeacherHighlightingUI() {
  const teacherUserId = `teacher_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const studentUserId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const teacherUsername = 'UITeacher';
  const studentUsername = 'UIStudent';

  console.log(`\n📝 UI Test Setup:`);
  console.log(`   Room ID: ${TEST_ROOM_ID}`);
  console.log(`   Teacher User ID: ${teacherUserId}`);
  console.log(`   Student User ID: ${studentUserId}`);
  console.log(`\n🌐 Open these URLs in your browser to test manually:`);
  console.log(`   Teacher: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${teacherUsername}&userId=${teacherUserId}`);
  console.log(`   Student: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${studentUsername}&userId=${studentUserId}`);

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

  // Step 3: Set up student listeners with detailed logging
  console.log(`\n👂 Step 3: Setting up student event listeners...`);
  
  let highlightEventsReceived = 0;
  let clearEventsReceived = 0;
  
  studentSocket.on('teacher-text-highlight', (data) => {
    highlightEventsReceived++;
    console.log(`\n   🎨 Student received teacher text highlight #${highlightEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName}`);
    console.log(`      Selection: Line ${data.selection.startLineNumber}-${data.selection.endLineNumber}, Column ${data.selection.startColumn}-${data.selection.endColumn}`);
    console.log(`      📍 This should create a blue highlight in the student's Monaco Editor!`);
  });

  studentSocket.on('clear-teacher-text-highlight', (data) => {
    clearEventsReceived++;
    console.log(`\n   🧹 Student received clear teacher text highlight #${clearEventsReceived}:`);
    console.log(`      Teacher: ${data.teacherName}`);
    console.log(`      📍 This should remove the blue highlight from the student's Monaco Editor!`);
  });

  console.log(`   ✅ Student event listeners set up`);

  // Step 4: Simulate realistic teacher text selections
  console.log(`\n🎨 Step 4: Simulating realistic teacher text selections...`);
  console.log(`\n   📋 Instructions for manual testing:`);
  console.log(`   1. Open the teacher URL in one browser tab`);
  console.log(`   2. Open the student URL in another browser tab`);
  console.log(`   3. In the teacher tab, select some text in the Monaco Editor`);
  console.log(`   4. Watch the student tab - you should see blue highlighting appear`);
  console.log(`   5. Deselect the text in the teacher tab`);
  console.log(`   6. Watch the student tab - the highlighting should disappear`);
  
  const testSelections = [
    {
      name: "Function definition highlight",
      selection: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 20
      },
      description: "Highlighting a function definition"
    },
    {
      name: "Multi-line code block",
      selection: {
        startLineNumber: 3,
        startColumn: 1,
        endLineNumber: 6,
        endColumn: 10
      },
      description: "Highlighting a multi-line code block"
    },
    {
      name: "Variable declaration",
      selection: {
        startLineNumber: 8,
        startColumn: 5,
        endLineNumber: 8,
        endColumn: 25
      },
      description: "Highlighting a variable declaration"
    },
    {
      name: "Comment section",
      selection: {
        startLineNumber: 10,
        startColumn: 1,
        endLineNumber: 12,
        endColumn: 30
      },
      description: "Highlighting a comment section"
    }
  ];

  for (let i = 0; i < testSelections.length; i++) {
    const test = testSelections[i];
    console.log(`\n   🧪 Automated Test ${i + 1}: ${test.name}`);
    console.log(`      Description: ${test.description}`);
    console.log(`      Selection: Line ${test.selection.startLineNumber}-${test.selection.endLineNumber}, Column ${test.selection.startColumn}-${test.selection.endColumn}`);
    
    // Send the highlight
    teacherSocket.emit('teacher-text-highlight', {
      roomId: TEST_ROOM_ID,
      selection: test.selection
    });
    
    console.log(`      📤 Sent highlight event - check student browser for blue highlighting!`);
    
    // Wait for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Clear the selection
    console.log(`      🧹 Clearing highlight...`);
    teacherSocket.emit('clear-teacher-text-highlight', {
      roomId: TEST_ROOM_ID
    });
    
    console.log(`      📤 Sent clear event - check student browser for highlight removal!`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Step 5: Keep the connection alive for manual testing
  console.log(`\n⏳ Step 5: Keeping connections alive for manual testing...`);
  console.log(`\n   🔄 The room is now ready for manual testing!`);
  console.log(`   📋 Manual Test Checklist:`);
  console.log(`   ✅ 1. Teacher can create text selections`);
  console.log(`   ✅ 2. Student receives highlight events`);
  console.log(`   ✅ 3. Student sees blue highlighting in Monaco Editor`);
  console.log(`   ✅ 4. Highlighting disappears when teacher deselects`);
  console.log(`   ✅ 5. Multiple selections work correctly`);
  console.log(`   ✅ 6. Cursor position updates work`);
  
  console.log(`\n   🌐 URLs for manual testing:`);
  console.log(`   Teacher: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${teacherUsername}&userId=${teacherUserId}`);
  console.log(`   Student: http://localhost:3001/editor/${TEST_ROOM_ID}?username=${studentUsername}&userId=${studentUserId}`);
  
  console.log(`\n   ⏰ Keeping connections alive for 5 minutes for manual testing...`);
  console.log(`   💡 Press Ctrl+C to stop the test early`);

  // Keep alive for 5 minutes
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  // Final results
  console.log(`\n📊 Final Automated Test Results:`);
  console.log(`   Highlight Events Received: ${highlightEventsReceived}/${testSelections.length}`);
  console.log(`   Clear Events Received: ${clearEventsReceived}/${testSelections.length}`);

  // Cleanup
  console.log(`\n🧹 Cleanup: Disconnecting all sockets...`);
  teacherSocket.disconnect();
  studentSocket.disconnect();
  console.log(`   ✅ All sockets disconnected`);

  const automatedTestsPassed = (
    highlightEventsReceived === testSelections.length &&
    clearEventsReceived === testSelections.length
  );

  if (automatedTestsPassed) {
    console.log(`\n🎉 AUTOMATED TESTS PASSED! Socket events are working correctly.`);
    console.log(`\n💡 If highlighting is not visible in the browser:`);
    console.log(`   1. Check browser console for Monaco Editor errors`);
    console.log(`   2. Verify CSS classes are being applied`);
    console.log(`   3. Check if Monaco Editor instance is available`);
    console.log(`   4. Ensure deltaDecorations is working`);
    return true;
  } else {
    console.log(`\n❌ AUTOMATED TESTS FAILED! Socket events are not working properly.`);
    return false;
  }
}

// Run the UI test
testTeacherHighlightingUI()
  .then((success) => {
    if (success) {
      console.log(`\n🏆 UI TEST COMPLETED! Check the browser for visual confirmation.`);
      process.exit(0);
    } else {
      console.log(`\n💥 UI TEST FAILED! Please check the implementation.`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.log(`\n💥 UI TEST ERROR: ${error.message}`);
    process.exit(1);
  });
