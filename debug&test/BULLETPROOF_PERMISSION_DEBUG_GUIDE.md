# 🔍 **Bulletproof Permission System - Debug Guide**

## 🎯 **Event Flow Debugging**

### **📤 Teacher Permission Change Flow:**
```
1. [TEACHER_PERMISSION] Toggle initiated
2. [TEACHER_PERMISSION] Sending to server
3. [SERVER] Request received
4. [SERVER] Permission changed for StudentName
5. [SERVER] Student notification sent
6. [SERVER] Teacher confirmation sent
7. [SERVER] Room user list updated
8. [TEACHER_PERMISSION] Server confirmed
9. [TEACHER_PERMISSION] Operation successful
```

### **📨 Student Permission Update Flow:**
```
1. [PERMISSION_STUDENT] Event received
2. [PERMISSION_STUDENT] Monaco update analysis
3. [PERMISSION_STUDENT] Monaco editor updated successfully
4. [PERMISSION_STUDENT] Local state update event dispatched
5. [PERMISSION_CONTEXT] Event received
6. [PERMISSION_CONTEXT] Updating my permission state
```

## 🛠️ **Debug Console Commands**

### **Check Permission State:**
```javascript
// Run in browser console
window.debugPermissions = () => {
  const socketService = window.SocketService?.getInstance();
  const editor = window.monacoRef?.current;
  
  console.log('🔍 Permission Debug State:', {
    socketConnected: socketService?.isConnected(),
    socketId: socketService?.getSocket()?.id,
    editorReadOnly: editor?.getOptions().get(monaco.editor.EditorOption.readOnly),
    editorExists: !!editor,
    timestamp: new Date().toISOString()
  });
};

// Usage: debugPermissions()
```

### **Test Permission Change:**
```javascript
// Teacher side - test permission change
window.testPermissionChange = (studentSocketId, canEdit) => {
  const socketService = window.SocketService?.getInstance();
  const requestId = `test_${Date.now()}`;
  
  console.log('🧪 Testing permission change:', { studentSocketId, canEdit, requestId });
  
  socketService.changePermission(
    'room-id', // Replace with actual room ID
    canEdit,
    undefined,
    studentSocketId,
    (error, response) => {
      console.log('🧪 Test result:', { error, response, requestId });
    }
  );
};
```

### **Monitor Socket Events:**
```javascript
// Monitor all permission-related events
window.monitorPermissionEvents = () => {
  const socketService = window.SocketService?.getInstance();
  const socket = socketService?.getSocket();
  
  if (!socket) {
    console.error('No socket available');
    return;
  }
  
  const events = [
    'permission-changed',
    'update-user-list',
    'initial-permission-state',
    'permission-updated'
  ];
  
  events.forEach(event => {
    socket.on(event, (data) => {
      console.log(`📡 [MONITOR] ${event}:`, data);
    });
  });
  
  console.log('🔍 Monitoring events:', events);
};
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: Student Can Still Type After Revoke**
**Debug Steps:**
1. Check if `permission-changed` event was received
2. Verify Monaco editor `readOnly` state
3. Check if user role is 'teacher' (teachers always can edit)

**Console Commands:**
```javascript
// Check Monaco state
const editor = window.monacoRef?.current;
console.log('Monaco readOnly:', editor?.getOptions().get(monaco.editor.EditorOption.readOnly));

// Check user role
console.log('User role:', localStorage.getItem('userRole'));
```

### **Issue 2: UI Out of Sync**
**Debug Steps:**
1. Check if `update-user-list` event was received
2. Verify server confirmation was received
3. Check if multiple permission requests are conflicting

**Console Commands:**
```javascript
// Check recent socket events
window.monitorPermissionEvents();

// Force refresh student list
const context = window.EditPermissionContext;
if (context?.requestStudentList) {
  context.requestStudentList();
}
```

### **Issue 3: Permission Changes Don't Persist After Reload**
**Debug Steps:**
1. Check if `initial-permission-state` event is received on join
2. Verify server permission storage
3. Check room ID consistency

**Console Commands:**
```javascript
// Check initial state on page load
window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('🔍 Initial state check:', {
      canEdit: window.EditPermissionContext?.canEdit,
      userRole: localStorage.getItem('userRole'),
      roomId: window.location.pathname.split('/').pop()
    });
  }, 2000);
});
```

## 📊 **Performance Monitoring**

### **Track Permission Change Latency:**
```javascript
window.trackPermissionLatency = () => {
  const originalEmit = window.SocketService?.getInstance()?.getSocket()?.emit;
  
  if (!originalEmit) return;
  
  window.SocketService.getInstance().getSocket().emit = function(event, data, callback) {
    if (event === 'change-permission') {
      const startTime = Date.now();
      const originalCallback = callback;
      
      callback = function(response) {
        const latency = Date.now() - startTime;
        console.log(`⏱️ Permission change latency: ${latency}ms`, {
          requestId: data.requestId,
          success: response?.success
        });
        
        if (originalCallback) originalCallback(response);
      };
    }
    
    return originalEmit.call(this, event, data, callback);
  };
};
```

## 🧪 **Automated Testing**

### **Permission Sync Test:**
```javascript
window.runPermissionSyncTest = async () => {
  console.log('🧪 Starting permission sync test...');
  
  const socketService = window.SocketService?.getInstance();
  const editor = window.monacoRef?.current;
  
  if (!socketService || !editor) {
    console.error('❌ Test failed: Missing dependencies');
    return;
  }
  
  // Test 1: Grant permission
  console.log('📝 Test 1: Grant permission');
  await new Promise(resolve => {
    socketService.changePermission('room-id', true, undefined, 'student-socket-id', (err, res) => {
      console.log('Grant result:', { err, res });
      resolve();
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Revoke permission
  console.log('📝 Test 2: Revoke permission');
  await new Promise(resolve => {
    socketService.changePermission('room-id', false, undefined, 'student-socket-id', (err, res) => {
      console.log('Revoke result:', { err, res });
      resolve();
    });
  });
  
  console.log('✅ Permission sync test completed');
};
```

## 🔧 **Server-Side Debugging**

### **Enable Detailed Logging:**
Add to server environment:
```bash
DEBUG=socket.io:* node server.js
```

### **Monitor Server Permission State:**
```javascript
// Add to server/sockets/room.js
const debugPermissionState = (roomId) => {
  const room = getRoom(roomId);
  if (!room) return;
  
  console.log('🔍 [SERVER_DEBUG] Room permission state:', {
    roomId,
    users: room.users.map(u => ({
      username: u.username,
      role: u.role,
      canEdit: getEditPermission(roomId, u.socketId)
    }))
  });
};

// Call after each permission change
debugPermissionState(roomId);
```

## ✅ **Success Indicators**

### **Healthy Permission System:**
- ✅ Permission changes complete in < 500ms
- ✅ Monaco editor updates immediately
- ✅ No console errors during permission changes
- ✅ UI state matches server state
- ✅ Permissions persist after page reload
- ✅ Multiple rapid changes don't cause conflicts

### **Log Patterns to Look For:**
```
✅ [TEACHER_PERMISSION] Operation successful
✅ [PERMISSION_STUDENT] Monaco editor updated successfully
✅ [SERVER] Permission successfully changed
🔄 [PERMISSION_CONTEXT] Updating my permission state
```

## 🚨 **Red Flags:**
```
❌ Permission change failed
💥 Unexpected error
⚠️ Monaco editor not available
❌ Server rejected permission change
⚠️ Request already in progress
```

## 🎯 **Quick Health Check:**
```javascript
window.permissionHealthCheck = () => {
  const checks = {
    socketConnected: !!window.SocketService?.getInstance()?.isConnected(),
    monacoAvailable: !!window.monacoRef?.current,
    contextAvailable: !!window.EditPermissionContext,
    noConsoleErrors: !console.error.called
  };
  
  const healthy = Object.values(checks).every(Boolean);
  
  console.log('🏥 Permission System Health:', {
    ...checks,
    overall: healthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED'
  });
  
  return healthy;
};
```
