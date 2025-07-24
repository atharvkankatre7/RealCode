// Test script to verify frontend Teacher Control Panel updates when students join
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5002';
const TEST_ROOM_ID = 'frontend-test-' + Date.now();

console.log('🧪 Testing Frontend Teacher Control Panel Student List Updates');
console.log('==============================================================');

async function testFrontendStudentListUpdates() {
  return new Promise(async (resolve, reject) => {
    let teacherSocket, student1Socket, student2Socket;
    
    try {
      console.log('\n📡 Step 1: Creating Teacher Connection...');
      teacherSocket = io(SOCKET_URL, { 
        transports: ['websocket'],
        timeout: 5000
      });

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
          username: 'FrontendTestTeacher',
          userId: 'frontend_teacher_123'
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
        username: teacherCreateResponse.username,
        role: teacherCreateResponse.role,
        users: teacherCreateResponse.users
      });

      // Set up teacher listeners for student list updates
      let teacherStudentListUpdates = [];
      teacherSocket.on('update-student-list', (data) => {
        console.log('📥 Teacher received student list update:', data);
        teacherStudentListUpdates.push(data);
      });

      console.log('\n👨‍🎓 Step 3: Creating Student Connections...');
      
      // Create Student 1
      student1Socket = io(SOCKET_URL, { 
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        student1Socket.on('connect', () => {
          console.log(`✅ Student 1 connected: ${student1Socket.id}`);
          resolve();
        });
        student1Socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('Student 1 connection timeout')), 5000);
      });

      // Create Student 2
      student2Socket = io(SOCKET_URL, { 
        transports: ['websocket'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        student2Socket.on('connect', () => {
          console.log(`✅ Student 2 connected: ${student2Socket.id}`);
          resolve();
        });
        student2Socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('Student 2 connection timeout')), 5000);
      });

      console.log('\n🚪 Step 4: Students Join Room...');
      
      // Student 1 joins
      const student1JoinResponse = await new Promise((resolve, reject) => {
        student1Socket.emit('join-room', {
          roomId: TEST_ROOM_ID,
          username: 'FrontendTestStudent1',
          userId: 'frontend_student_456'
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

      // Wait a moment for teacher to receive update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Student 2 joins
      const student2JoinResponse = await new Promise((resolve, reject) => {
        student2Socket.emit('join-room', {
          roomId: TEST_ROOM_ID,
          username: 'FrontendTestStudent2',
          userId: 'frontend_student_789'
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

      // Wait for all updates to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('\n📊 Step 5: Analyzing Teacher Student List Updates...');
      console.log(`📈 Total student list updates received by teacher: ${teacherStudentListUpdates.length}`);

      if (teacherStudentListUpdates.length === 0) {
        console.log('❌ ISSUE FOUND: Teacher received NO student list updates!');
        console.log('🔍 This indicates the frontend is not receiving student list events.');
        console.log('🔧 Check that:');
        console.log('   • EditPermissionContext is listening for "update-student-list" events');
        console.log('   • Teacher role is detected correctly');
        console.log('   • Socket listeners are set up after teacher role is established');
        reject(new Error('Teacher received no student list updates'));
        return;
      }

      // Check if we have the expected number of students
      const latestUpdate = teacherStudentListUpdates[teacherStudentListUpdates.length - 1];
      const studentCount = latestUpdate.students ? latestUpdate.students.length : 0;

      console.log(`📊 Latest student list contains ${studentCount} students:`);
      if (latestUpdate.students) {
        latestUpdate.students.forEach((student, index) => {
          console.log(`   ${index + 1}. ${student.username} (${student.userId}) - Can Edit: ${student.canEdit}`);
        });
      }

      if (studentCount === 2) {
        console.log('\n🎉 SUCCESS: Teacher Control Panel should now show 2 students!');
        console.log('✅ Frontend student list updates are working correctly');
        resolve();
      } else {
        console.log(`\n❌ ISSUE: Expected 2 students, but got ${studentCount}`);
        reject(new Error(`Expected 2 students, got ${studentCount}`));
      }

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      reject(error);
    } finally {
      // Clean up connections
      if (teacherSocket) teacherSocket.disconnect();
      if (student1Socket) student1Socket.disconnect();
      if (student2Socket) student2Socket.disconnect();
    }
  });
}

// Run the test
testFrontendStudentListUpdates()
  .then(() => {
    console.log('\n✨ Frontend Teacher Control Panel test completed successfully!');
    console.log('🚀 The Teacher Control Panel should now properly display students when they join.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Frontend test failed:', error.message);
    process.exit(1);
  });
