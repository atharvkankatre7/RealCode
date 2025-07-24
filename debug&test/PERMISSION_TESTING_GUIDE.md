# 🧪 Permission Synchronization Testing Guide

## 🎯 **Test Scenarios**

### **Test 1: Basic Permission Toggle**
1. **Setup**: Teacher and Student in same room
2. **Initial State**: Student has no edit access (read-only)
3. **Action**: Teacher clicks "Grant" for student
4. **Expected Results**:
   - ✅ Teacher button changes from "Grant" to "Revoke"
   - ✅ Student Monaco editor becomes editable immediately
   - ✅ Student can type in the editor
   - ✅ Console shows permission-changed event received
   - ✅ No page reload required

### **Test 2: Permission Revocation**
1. **Setup**: Student currently has edit access
2. **Action**: Teacher clicks "Revoke" for student
3. **Expected Results**:
   - ✅ Teacher button changes from "Revoke" to "Grant"
   - ✅ Student Monaco editor becomes read-only immediately
   - ✅ Student cannot type in the editor
   - ✅ Student sees cursor but typing is disabled
   - ✅ Console shows permission-changed event received

### **Test 3: Rapid Permission Toggles**
1. **Setup**: Teacher and Student in same room
2. **Action**: Teacher rapidly clicks Grant → Revoke → Grant → Revoke
3. **Expected Results**:
   - ✅ Each click shows loading state
   - ✅ Buttons update only after server confirmation
   - ✅ Student editor state matches final permission
   - ✅ No race conditions or desync issues
   - ✅ All requests complete successfully

### **Test 4: Multiple Students**
1. **Setup**: Teacher with 3 students (A, B, C)
2. **Action**: Grant permission to Student A only
3. **Expected Results**:
   - ✅ Only Student A can edit
   - ✅ Students B and C remain read-only
   - ✅ Teacher sees correct button states for all students
   - ✅ Permission changes are isolated per student

### **Test 5: Error Handling**
1. **Setup**: Disconnect student's internet briefly
2. **Action**: Teacher tries to change student's permission
3. **Expected Results**:
   - ✅ Teacher sees error message
   - ✅ Button returns to original state
   - ✅ No phantom permission changes
   - ✅ System recovers when connection restored

### **Test 6: Page Refresh Persistence**
1. **Setup**: Student has edit access
2. **Action**: Student refreshes page
3. **Expected Results**:
   - ✅ Student retains edit access after refresh
   - ✅ Monaco editor is in correct state
   - ✅ Teacher panel shows correct permission state
   - ✅ No permission reset

### **Test 7: Teacher Reconnection**
1. **Setup**: Teacher disconnects and reconnects
2. **Action**: Teacher tries to change permissions
3. **Expected Results**:
   - ✅ Permission changes work normally
   - ✅ Student list is up to date
   - ✅ All students show correct permission states
   - ✅ No stale data issues

## 🔍 **Debug Console Logs to Watch For**

### **Teacher Side Logs**:
```
🔄 [TEACHER] Permission toggle initiated: { socketId, username, currentPermission, newPermission, requestId }
📤 [TEACHER] Sending permission change to server: { socketId, canEdit, requestId }
✅ [TEACHER] Permission change confirmed by server: { response }
🔄 [TEACHER] Refreshing student list after permission change
```

### **Student Side Logs**:
```
📨 [STUDENT] Received permission-changed event: { canEdit, userId, socketId, changedBy, timestamp }
📝 [STUDENT] Monaco editor state change: { canEdit, shouldBeReadOnly, currentReadOnly, willChange }
✅ [STUDENT] Monaco editor updated: { readOnly, reason, timestamp }
🎉 [STUDENT] Edit access granted by teacher!
```

### **Server Side Logs**:
```
📥 [SERVER] Received change-permission: { roomId, targetSocketId, canEdit, requestId }
🔄 [SERVER] Changing permission for StudentName: { from, to, teacher }
📤 [SERVER] Sent permission-changed to StudentName (socketId): true/false
✅ [SERVER] Permission successfully changed: { teacher, student, permission, requestId }
```

## 🚨 **Common Issues to Check**

### **Issue 1: Button Updates But Editor Doesn't**
- **Check**: Student receiving `permission-changed` event
- **Check**: Monaco editor `readOnly` option being updated
- **Check**: Student role (teachers should never be read-only)

### **Issue 2: Editor Updates But Button Doesn't**
- **Check**: Teacher receiving `update-user-list` event
- **Check**: Student list state being updated
- **Check**: Button using correct permission source

### **Issue 3: Rapid Clicks Cause Desync**
- **Check**: Loading states preventing multiple requests
- **Check**: Server confirmation before UI updates
- **Check**: Request IDs for tracking

### **Issue 4: Permissions Reset After Refresh**
- **Check**: Server storing permissions correctly
- **Check**: Initial permission sync on join
- **Check**: Context state initialization

## 🛠️ **Manual Testing Commands**

### **Test Permission Change in Browser Console**:
```javascript
// On teacher side - force permission change
window.testPermissionChange = (socketId, canEdit) => {
  const socketService = window.SocketService?.getInstance();
  if (socketService) {
    socketService.changePermission('room-id', canEdit, undefined, socketId, (err, response) => {
      console.log('Test result:', { err, response });
    });
  }
};

// Usage: testPermissionChange('student-socket-id', true)
```

### **Test Monaco Editor State**:
```javascript
// On student side - check editor state
window.checkEditorState = () => {
  const editor = window.monacoRef?.current;
  if (editor) {
    console.log('Editor state:', {
      readOnly: editor.getOptions().get(monaco.editor.EditorOption.readOnly),
      canEdit: editor.getOptions().get(monaco.editor.EditorOption.readOnly) === false
    });
  }
};
```

### **Test Socket Connection**:
```javascript
// Check socket connection and events
window.testSocket = () => {
  const socketService = window.SocketService?.getInstance();
  console.log('Socket state:', {
    connected: socketService?.isConnected(),
    socket: !!socketService?.getSocket(),
    events: Object.keys(socketService?.eventHandlers || {})
  });
};
```

## ✅ **Success Criteria**

All tests should pass with:
- ✅ **Immediate Updates**: Permission changes reflect instantly
- ✅ **No Page Reloads**: Everything works in real-time
- ✅ **Consistent State**: UI and editor always match server state
- ✅ **Error Recovery**: System handles failures gracefully
- ✅ **Multi-User Support**: Isolated permission changes per student
- ✅ **Persistence**: Permissions survive page refreshes and reconnections

## 🎉 **Expected Final Behavior**

When working correctly:
1. **Teacher clicks "Revoke"** → Student **immediately** cannot type
2. **Teacher clicks "Grant"** → Student **immediately** can type
3. **Multiple students** → Only targeted student affected
4. **Page refresh** → Permissions maintained
5. **Network issues** → Graceful error handling and recovery
