// Backend debugging script for student list issues
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5002';
const TEST_ROOM_ID = 'debug-student-list-' + Date.now();

console.log('🔍 DEBUGGING: Backend Student List Emission');
console.log('===========================================');

async function debugBackendStudentList() {
  let teacherSocket, student1Socket, student2Socket;
  
  try {
    // Step 1: Create teacher connection
    console.log('\n📡 Step 1: Creating Teacher Connection...');
    teacherSocket = io(SOCKET_URL, { transports: ['websocket'] });
    
    await new Promise((resolve, reject) => {
      teacherSocket.on('connect', () => {
        console.log(`✅ Teacher connected: ${teacherSocket.id}`);
        resolve();
      });
      teacherSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Teacher connection timeout')), 5000);
    });

    // Step 2: Set up comprehensive teacher listeners
    console.log('\n👂 Step 2: Setting up Teacher Event Listeners...');
    
    let eventLog = [];
    
    // Log ALL events received by teacher
    ['update-student-list', 'room-users-updated', 'user-joined', 'user-left'].forEach(eventName => {
      teacherSocket.on(eventName, (data) => {
        const logEntry = {
          timestamp: new Date().toISOString(),
          event: eventName,
          data: JSON.stringify(data, null, 2)
        };
        eventLog.push(logEntry);
        console.log(`📥 TEACHER RECEIVED [${eventName}]:`, JSON.stringify(data, null, 2));
      });
    });

    // Step 3: Teacher creates room
    console.log('\n🏫 Step 3: Teacher Creates Room...');
    const teacherCreateResponse = await new Promise((resolve, reject) => {
      teacherSocket.emit('create-room', {
        roomId: TEST_ROOM_ID,
        username: 'DebugTeacher',
        userId: 'debug_teacher_123'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Create room timeout')), 5000);
    });

    console.log('✅ Teacher created room:', {
      roomId: teacherCreateResponse.roomId,
      role: teacherCreateResponse.role,
      userCount: teacherCreateResponse.users?.length || 0
    });

    // Step 4: Create and connect students
    console.log('\n👨‍🎓 Step 4: Creating Student Connections...');
    
    // Student 1
    student1Socket = io(SOCKET_URL, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      student1Socket.on('connect', () => {
        console.log(`✅ Student 1 connected: ${student1Socket.id}`);
        resolve();
      });
      student1Socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student 1 connection timeout')), 5000);
    });

    // Student 2
    student2Socket = io(SOCKET_URL, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      student2Socket.on('connect', () => {
        console.log(`✅ Student 2 connected: ${student2Socket.id}`);
        resolve();
      });
      student2Socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student 2 connection timeout')), 5000);
    });

    // Step 5: Students join room
    console.log('\n🚪 Step 5: Students Join Room...');
    
    // Student 1 joins
    const student1JoinResponse = await new Promise((resolve, reject) => {
      student1Socket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: 'DebugStudent1',
        userId: 'debug_student_456'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Student 1 join timeout')), 5000);
    });

    console.log('✅ Student 1 joined:', {
      role: student1JoinResponse.role,
      userCount: student1JoinResponse.users?.length || 0
    });

    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Student 2 joins
    const student2JoinResponse = await new Promise((resolve, reject) => {
      student2Socket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: 'DebugStudent2',
        userId: 'debug_student_789'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Student 2 join timeout')), 5000);
    });

    console.log('✅ Student 2 joined:', {
      role: student2JoinResponse.role,
      userCount: student2JoinResponse.users?.length || 0
    });

    // Wait for all events to be received
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Manual request for student list
    console.log('\n📋 Step 6: Teacher Manually Requests Student List...');
    teacherSocket.emit('request-student-list', { roomId: TEST_ROOM_ID });
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 7: Analyze results
    console.log('\n📊 Step 7: Event Analysis...');
    console.log(`📈 Total events received by teacher: ${eventLog.length}`);
    
    if (eventLog.length === 0) {
      console.log('❌ CRITICAL ISSUE: Teacher received NO events!');
      console.log('🔧 Check:');
      console.log('   • Backend is emitting events to correct socket IDs');
      console.log('   • Teacher socket is in the correct room');
      console.log('   • Event names match exactly');
    } else {
      console.log('\n📋 Event Summary:');
      eventLog.forEach((entry, index) => {
        console.log(`   ${index + 1}. [${entry.event}] at ${entry.timestamp}`);
        
        // Analyze student list events specifically
        if (entry.event === 'update-student-list') {
          try {
            const data = JSON.parse(entry.data);
            const studentCount = data.students ? data.students.length : 0;
            console.log(`      → Contains ${studentCount} students`);
            
            if (studentCount === 0) {
              console.log('      ❌ ISSUE: Student list is empty!');
            } else {
              data.students.forEach((student, i) => {
                console.log(`      → Student ${i + 1}: ${student.username} (${student.userId})`);
              });
            }
          } catch (e) {
            console.log('      ❌ ISSUE: Invalid JSON in event data');
          }
        }
      });
    }

    // Step 8: Final verification
    const updateStudentListEvents = eventLog.filter(e => e.event === 'update-student-list');
    if (updateStudentListEvents.length === 0) {
      console.log('\n❌ BACKEND ISSUE: No update-student-list events received');
      console.log('🔧 Backend needs to emit update-student-list when students join');
    } else {
      const latestEvent = updateStudentListEvents[updateStudentListEvents.length - 1];
      const data = JSON.parse(latestEvent.data);
      const studentCount = data.students ? data.students.length : 0;
      
      if (studentCount === 2) {
        console.log('\n✅ BACKEND WORKING: Correct number of students in latest event');
      } else {
        console.log(`\n❌ BACKEND ISSUE: Expected 2 students, got ${studentCount}`);
      }
    }

  } catch (error) {
    console.error('\n💥 Debug test failed:', error.message);
  } finally {
    // Cleanup
    if (teacherSocket) teacherSocket.disconnect();
    if (student1Socket) student1Socket.disconnect();
    if (student2Socket) student2Socket.disconnect();
  }
}

// Run the debug test
debugBackendStudentList()
  .then(() => {
    console.log('\n✨ Backend debugging completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Backend debug failed:', error.message);
    process.exit(1);
  });
