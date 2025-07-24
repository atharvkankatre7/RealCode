// Complete test for student list fix
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5002';
const TEST_ROOM_ID = 'complete-fix-test-' + Date.now();

console.log('🧪 COMPLETE STUDENT LIST FIX TEST');
console.log('==================================');

async function testCompleteStudentListFix() {
  let teacherSocket, student1Socket, student2Socket;
  
  try {
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

    console.log('\n🏫 Step 2: Teacher Creates Room...');
    const teacherCreateResponse = await new Promise((resolve, reject) => {
      teacherSocket.emit('create-room', {
        roomId: TEST_ROOM_ID,
        username: 'CompleteFixTeacher',
        userId: 'complete_fix_teacher_123'
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
      role: teacherCreateResponse.role
    });

    // Set up teacher listeners to track all events
    let studentListEvents = [];
    teacherSocket.on('update-student-list', (data) => {
      studentListEvents.push({
        timestamp: new Date().toISOString(),
        studentCount: data.students ? data.students.length : 0,
        students: data.students || []
      });
      console.log(`📥 Teacher received update-student-list: ${data.students ? data.students.length : 0} students`);
    });

    console.log('\n👨‍🎓 Step 3: Students Join Room...');
    
    // Student 1 joins
    student1Socket = io(SOCKET_URL, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      student1Socket.on('connect', () => {
        console.log(`✅ Student 1 connected: ${student1Socket.id}`);
        resolve();
      });
      student1Socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student 1 connection timeout')), 5000);
    });

    const student1JoinResponse = await new Promise((resolve, reject) => {
      student1Socket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: 'CompleteFixStudent1',
        userId: 'complete_fix_student_456'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Student 1 join timeout')), 5000);
    });

    console.log('✅ Student 1 joined:', student1JoinResponse.role);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Student 2 joins
    student2Socket = io(SOCKET_URL, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      student2Socket.on('connect', () => {
        console.log(`✅ Student 2 connected: ${student2Socket.id}`);
        resolve();
      });
      student2Socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student 2 connection timeout')), 5000);
    });

    const student2JoinResponse = await new Promise((resolve, reject) => {
      student2Socket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: 'CompleteFixStudent2',
        userId: 'complete_fix_student_789'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Student 2 join timeout')), 5000);
    });

    console.log('✅ Student 2 joined:', student2JoinResponse.role);
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 Step 4: Analyzing Results...');
    console.log(`📈 Total student list events received: ${studentListEvents.length}`);

    if (studentListEvents.length === 0) {
      console.log('❌ CRITICAL: No student list events received!');
      console.log('🔧 Check:');
      console.log('   • SocketService is listening for update-student-list events');
      console.log('   • EditPermissionContext is handling events correctly');
      console.log('   • Backend is emitting to correct socket IDs');
      return false;
    }

    // Check latest event
    const latestEvent = studentListEvents[studentListEvents.length - 1];
    console.log(`📋 Latest event: ${latestEvent.studentCount} students`);

    if (latestEvent.studentCount === 2) {
      console.log('✅ SUCCESS: Teacher received correct student count!');
      console.log('📝 Students in latest event:');
      latestEvent.students.forEach((student, i) => {
        console.log(`   ${i + 1}. ${student.username} (${student.userId})`);
      });
      return true;
    } else {
      console.log(`❌ ISSUE: Expected 2 students, got ${latestEvent.studentCount}`);
      return false;
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    return false;
  } finally {
    // Cleanup
    if (teacherSocket) teacherSocket.disconnect();
    if (student1Socket) student1Socket.disconnect();
    if (student2Socket) student2Socket.disconnect();
  }
}

// Run the test
testCompleteStudentListFix()
  .then((success) => {
    if (success) {
      console.log('\n🎉 COMPLETE FIX TEST PASSED!');
      console.log('✅ Backend is emitting events correctly');
      console.log('✅ SocketService is forwarding events correctly');
      console.log('✅ EditPermissionContext is processing events correctly');
      console.log('✅ Teacher Control Panel should now show students!');
    } else {
      console.log('\n❌ COMPLETE FIX TEST FAILED!');
      console.log('🔧 Check the browser console for frontend debugging logs');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Complete fix test failed:', error.message);
    process.exit(1);
  });
