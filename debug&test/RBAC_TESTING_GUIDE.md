# 🧪 **RBAC Permission System - Testing Guide**

## 🎯 **System Overview**

The new Role-Based Access Control (RBAC) system simplifies permissions:
- **Teachers**: Can always edit + toggle room permission for all students
- **Students**: Can edit only when room permission is enabled
- **Room Permission**: Single toggle that affects ALL students simultaneously

## 🔧 **Testing Scenarios**

### **Test 1: Basic Room Permission Toggle**
1. **Setup**: Open teacher tab and 2+ student tabs
2. **Initial State**: Students should be in read-only mode (room permission disabled)
3. **Action**: Teacher clicks "Enable Editing" in Room Permission Panel
4. **Expected Results**:
   - ✅ All student Monaco editors become editable immediately
   - ✅ Students see green toast: "Room editing enabled by Teacher"
   - ✅ Teacher panel shows "Enabled" status
   - ✅ Teacher button changes to "🔒 Disable Editing"

### **Test 2: Disable Room Editing**
1. **Setup**: Room editing is enabled, students can edit
2. **Action**: Teacher clicks "🔒 Disable Editing"
3. **Expected Results**:
   - ✅ All student Monaco editors become read-only immediately
   - ✅ Students see orange toast: "Room editing disabled by Teacher"
   - ✅ Teacher panel shows "Disabled" status
   - ✅ Teacher button changes to "✏️ Enable Editing"

### **Test 3: Teacher Always Can Edit**
1. **Setup**: Room editing is disabled
2. **Action**: Teacher tries to edit code
3. **Expected Results**:
   - ✅ Teacher can always edit regardless of room permission
   - ✅ Teacher Monaco editor is never read-only

### **Test 4: New Student Joins**
1. **Setup**: Room editing is enabled/disabled
2. **Action**: New student joins the room
3. **Expected Results**:
   - ✅ New student gets correct initial permission state
   - ✅ New student Monaco editor matches room permission
   - ✅ No individual permission setup needed

### **Test 5: Page Reload Persistence**
1. **Setup**: Set room permission to enabled
2. **Action**: Student refreshes page
3. **Expected Results**:
   - ✅ Student Monaco editor remains editable after reload
   - ✅ Room permission state persists correctly

### **Test 6: Rapid Toggle Test**
1. **Setup**: Teacher and multiple students
2. **Action**: Teacher rapidly toggles Enable → Disable → Enable → Disable
3. **Expected Results**:
   - ✅ All students' editors change in sync with each toggle
   - ✅ Final state matches last toggle action
   - ✅ No stale state or UI desync

## 🔍 **Debug Console Commands**

### **Check RBAC State (All Users)**
```javascript
// Run in browser console
console.log('🔍 RBAC State:', {
  canEdit: window.EditPermissionContext?.canEdit,
  userRole: localStorage.getItem('userRole'),
  monacoReadOnly: window.monacoRef?.current?.getOptions().get(monaco.editor.EditorOption.readOnly),
  socketConnected: window.SocketService?.getInstance()?.isConnected()
});
```

### **Monitor Room Permission Events**
```javascript
// Monitor RBAC events
const socketService = window.SocketService?.getInstance();
if (socketService) {
  socketService.on('room-permission-changed', (data) => {
    console.log('📨 [TEST] room-permission-changed:', data);
  });
  
  console.log('✅ [TEST] Monitoring room-permission-changed events');
}
```

### **Test Room Permission Toggle (Teacher)**
```javascript
// Teacher side - test room permission toggle
const testRoomToggle = () => {
  const context = window.EditPermissionContext;
  if (!context?.toggleRoomPermission) {
    console.error('❌ toggleRoomPermission not available');
    return;
  }
  
  console.log('🧪 [TEST] Testing room permission toggle...');
  
  context.toggleRoomPermission((err, response) => {
    if (err) {
      console.error('❌ [TEST] Toggle failed:', err);
    } else {
      console.log('✅ [TEST] Toggle successful:', response);
    }
  });
};

// Usage: testRoomToggle()
```

## 📊 **Expected Event Flow**

### **Teacher Toggles Room Permission:**
```
1. 🖱️ [RBAC_UI] Toggling room permission
2. 📤 [RBAC_CONTEXT] Requesting room permission toggle
3. 📥 [RBAC] Room permission toggle request (server)
4. ✅ [RBAC] Room permission toggled to true/false (server)
5. 📤 [RBAC] Sent room-permission-changed to all users (server)
6. 📨 [RBAC_STUDENT] room-permission-changed received (students)
7. ✅ [RBAC_STUDENT] Monaco updated successfully (students)
8. ✅ [RBAC_UI] Room permission toggled successfully (teacher)
```

### **Student Receives Permission Change:**
```
1. 📨 [RBAC_STUDENT] room-permission-changed received
2. 📝 [RBAC_STUDENT] Monaco update: readOnly=true/false
3. ✅ [RBAC_STUDENT] Monaco updated successfully
4. 🔄 [RBAC_STUDENT] Room permission update dispatched
```

## 🚨 **Common Issues & Solutions**

### **Issue: Students don't receive permission changes**
**Debug Steps:**
```javascript
// Check if room-permission-changed events are being received
// Look for: 📨 [RBAC_STUDENT] room-permission-changed received
```

**Solution**: Ensure `room-permission-changed` event is being emitted to all room users.

### **Issue: Teacher toggle button doesn't work**
**Debug Steps:**
```javascript
// Check teacher context
const context = window.EditPermissionContext;
console.log('Teacher functions:', {
  hasToggleFunction: !!context?.toggleRoomPermission,
  isTeacher: context?.isTeacher
});
```

**Solution**: Ensure teacher role is properly set and toggleRoomPermission function exists.

### **Issue: Monaco editor doesn't update**
**Debug Steps:**
```javascript
// Check Monaco state
const editor = window.monacoRef?.current;
console.log('Monaco state:', {
  exists: !!editor,
  readOnly: editor?.getOptions().get(monaco.editor.EditorOption.readOnly)
});
```

**Solution**: Ensure Monaco editor reference is available and room-permission-changed handler is working.

## ⚡ **Performance Tests**

### **Latency Test**
```javascript
// Measure room permission toggle latency
const measureToggleLatency = () => {
  const startTime = Date.now();
  const context = window.EditPermissionContext;
  
  context.toggleRoomPermission((err, response) => {
    const latency = Date.now() - startTime;
    console.log(`⏱️ Room toggle latency: ${latency}ms`, {
      success: !err,
      newState: response?.canEdit
    });
  });
};
```

### **Multi-Student Sync Test**
```javascript
// Test synchronization across multiple students
const testMultiStudentSync = () => {
  // Run this in teacher console, observe student consoles
  console.log('🧪 Testing multi-student sync...');
  
  const context = window.EditPermissionContext;
  context.toggleRoomPermission((err, response) => {
    console.log('Toggle result:', { err, response });
    console.log('Check all student consoles for sync confirmation');
  });
};
```

## 🎯 **Success Criteria**

### **✅ Healthy RBAC System:**
- Room permission toggles complete in < 500ms
- All students' Monaco editors update simultaneously
- No console errors during permission changes
- UI state always matches room permission
- Permissions persist after page reload
- New students get correct initial state

### **✅ Expected Log Patterns:**
```
✅ [RBAC_UI] Room permission toggled successfully
✅ [RBAC_STUDENT] Monaco updated successfully
✅ [RBAC] Room permission toggled to true/false
🔄 [RBAC_CONTEXT] Updating room permission state
```

### **❌ Red Flag Patterns:**
```
❌ [RBAC_UI] Room permission toggle failed
❌ [RBAC_STUDENT] Monaco update failed
❌ [RBAC] Server rejected toggle
💥 Unexpected error in room permission
```

## 🔧 **Automated Test Suite**

### **Run RBAC Test Suite**
```javascript
const runRBACTestSuite = async () => {
  console.log('🧪 Starting RBAC Test Suite...');
  
  const context = window.EditPermissionContext;
  if (!context?.toggleRoomPermission) {
    console.error('❌ RBAC functions not available');
    return;
  }
  
  // Test 1: Enable room editing
  console.log('📝 Test 1: Enable room editing');
  await new Promise(resolve => {
    context.toggleRoomPermission((err, res) => {
      console.log('Enable result:', { err, canEdit: res?.canEdit });
      resolve();
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Disable room editing
  console.log('📝 Test 2: Disable room editing');
  await new Promise(resolve => {
    context.toggleRoomPermission((err, res) => {
      console.log('Disable result:', { err, canEdit: res?.canEdit });
      resolve();
    });
  });
  
  console.log('✅ RBAC Test Suite Completed');
};

// Run: runRBACTestSuite()
```

## 🎉 **Final Verification Checklist**

- [ ] Teacher can toggle room permission
- [ ] All students' editors change simultaneously
- [ ] Permission changes are instant (< 500ms)
- [ ] Teacher can always edit regardless of room permission
- [ ] Students get correct initial state on join
- [ ] Permissions persist after page reload
- [ ] Toast notifications appear for students
- [ ] Server ACK confirmations work
- [ ] Console shows RBAC success logs, no errors
- [ ] UI reflects correct permission state

## 🚀 **Ready for Production**

When all tests pass and the checklist is complete, your RBAC permission system is ready for production use! 🎉

**Key Benefits:**
- ✅ **Simplified Management**: One toggle for all students
- ✅ **Instant Synchronization**: All students update simultaneously  
- ✅ **Role-Based Security**: Teachers always have access
- ✅ **Bulletproof Reliability**: No individual permission conflicts
- ✅ **Better UX**: Clear, predictable behavior for all users
