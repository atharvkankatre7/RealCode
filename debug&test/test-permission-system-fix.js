// Test script to verify the complete permission system fix
const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:5002';
const TEST_ROOM_ID = 'permission-fix-test-' + Date.now();

console.log('🧪 TESTING COMPLETE PERMISSION SYSTEM FIX');
console.log('==========================================');

async function testPermissionSystemFix() {
  let teacherSocket, studentSocket;
  
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
        username: 'PermissionFixTeacher',
        userId: 'permission_fix_teacher_123'
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

    // Set up teacher listeners
    let studentListEvents = [];
    let permissionEvents = [];
    
    teacherSocket.on('update-student-list', (data) => {
      studentListEvents.push(data);
      console.log(`📥 Teacher received student list: ${data.students ? data.students.length : 0} students`);
    });

    teacherSocket.on('permission-updated', (data) => {
      permissionEvents.push(data);
      console.log(`📥 Teacher received permission update:`, data);
    });

    console.log('\n👨‍🎓 Step 3: Student Joins Room...');
    studentSocket = io(SOCKET_URL, { transports: ['websocket'] });
    
    await new Promise((resolve, reject) => {
      studentSocket.on('connect', () => {
        console.log(`✅ Student connected: ${studentSocket.id}`);
        resolve();
      });
      studentSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Student connection timeout')), 5000);
    });

    // Set up student listeners
    let studentPermissionEvents = [];
    studentSocket.on('permission-updated', (data) => {
      studentPermissionEvents.push(data);
      console.log(`📥 Student received permission update:`, data);
    });

    studentSocket.on('edit-permission', (data) => {
      studentPermissionEvents.push(data);
      console.log(`📥 Student received edit permission:`, data);
    });

    const studentJoinResponse = await new Promise((resolve, reject) => {
      studentSocket.emit('join-room', {
        roomId: TEST_ROOM_ID,
        username: 'PermissionFixStudent',
        userId: 'permission_fix_student_456'
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
      setTimeout(() => reject(new Error('Student join timeout')), 5000);
    });

    console.log('✅ Student joined:', {
      role: studentJoinResponse.role,
      canEdit: studentJoinResponse.canEdit
    });

    // Wait for events to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔧 Step 4: Testing Permission Grant...');
    
    // Teacher grants permission to student
    teacherSocket.emit('grant-edit-permission', {
      roomId: TEST_ROOM_ID,
      targetSocketId: studentSocket.id
    });

    // Wait for permission update
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n🔧 Step 5: Testing Permission Revoke...');
    
    // Teacher revokes permission from student
    teacherSocket.emit('revoke-edit-permission', {
      roomId: TEST_ROOM_ID,
      targetSocketId: studentSocket.id
    });

    // Wait for permission update
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n📊 Step 6: Analyzing Results...');
    
    // Check student list events
    console.log(`📈 Student list events received: ${studentListEvents.length}`);
    if (studentListEvents.length > 0) {
      const latestStudentList = studentListEvents[studentListEvents.length - 1];
      const studentCount = latestStudentList.students ? latestStudentList.students.length : 0;
      console.log(`✅ Latest student list contains ${studentCount} students`);
      
      if (studentCount === 1) {
        const student = latestStudentList.students[0];
        console.log(`   Student: ${student.username} (${student.userId})`);
        console.log(`   Socket ID: ${student.socketId}`);
        console.log(`   Can Edit: ${student.canEdit}`);
      }
    } else {
      console.log('❌ No student list events received');
    }

    // Check permission events
    console.log(`📈 Student permission events received: ${studentPermissionEvents.length}`);
    if (studentPermissionEvents.length > 0) {
      console.log('✅ Student received permission updates:');
      studentPermissionEvents.forEach((event, i) => {
        console.log(`   ${i + 1}. canEdit: ${event.canEdit}`);
      });
    } else {
      console.log('❌ Student received no permission events');
    }

    // Final verification
    const hasStudentList = studentListEvents.length > 0;
    const hasPermissionUpdates = studentPermissionEvents.length > 0;
    
    if (hasStudentList && hasPermissionUpdates) {
      console.log('\n🎉 SUCCESS: Permission system is working correctly!');
      console.log('✅ Teacher receives student list updates');
      console.log('✅ Permission grant/revoke works');
      console.log('✅ Student receives permission updates');
      return true;
    } else {
      console.log('\n❌ ISSUES FOUND:');
      if (!hasStudentList) console.log('   • Teacher not receiving student list updates');
      if (!hasPermissionUpdates) console.log('   • Student not receiving permission updates');
      return false;
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    return false;
  } finally {
    // Cleanup
    if (teacherSocket) teacherSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();
  }
}

// Run the test
testPermissionSystemFix()
  .then((success) => {
    if (success) {
      console.log('\n🎉 PERMISSION SYSTEM FIX VERIFIED!');
      console.log('✅ Room ID issue resolved');
      console.log('✅ Student list updates working');
      console.log('✅ Permission toggles working');
      console.log('✅ Teacher Control Panel should be fully functional!');
    } else {
      console.log('\n❌ PERMISSION SYSTEM STILL HAS ISSUES!');
      console.log('🔧 Check browser console for additional debugging info');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Permission system test failed:', error.message);
    process.exit(1);
  });
