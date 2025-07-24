# 🧪 **Permission Sync Testing Guide**

## 🎯 **Quick Test Scenarios**

### **Test 1: Basic Permission Toggle**
1. **Setup**: Open teacher tab and student tab
2. **Action**: Teacher clicks "Grant" for student
3. **Expected**: 
   - ✅ Student Monaco editor becomes editable immediately
   - ✅ Teacher UI shows "Revoke" button
   - ✅ Student sees green toast: "Edit access granted by Teacher"

### **Test 2: Permission Revoke**
1. **Setup**: Student has edit access
2. **Action**: Teacher clicks "Revoke" for student
3. **Expected**:
   - ✅ Student Monaco editor becomes read-only immediately
   - ✅ Teacher UI shows "Grant" button
   - ✅ Student sees orange toast: "Edit access revoked by Teacher"

### **Test 3: Page Reload Persistence**
1. **Setup**: Student has edit access
2. **Action**: Student refreshes page
3. **Expected**:
   - ✅ Student Monaco editor remains editable after reload
   - ✅ Permission state persists correctly

### **Test 4: Rapid Toggle Test**
1. **Setup**: Teacher and student tabs open
2. **Action**: Teacher rapidly clicks Grant → Revoke → Grant → Revoke
3. **Expected**:
   - ✅ Each change applies correctly without conflicts
   - ✅ Final state matches last button click
   - ✅ No stale state or UI desync

## 🔍 **Debug Console Commands**

### **Check Current State**
```javascript
// Run in browser console (both teacher and student)
console.log('🔍 Current Permission State:', {
  canEdit: window.EditPermissionContext?.canEdit,
  userRole: localStorage.getItem('userRole'),
  monacoReadOnly: window.monacoRef?.current?.getOptions().get(monaco.editor.EditorOption.readOnly),
  socketConnected: window.SocketService?.getInstance()?.isConnected(),
  socketId: window.SocketService?.getInstance()?.getSocket()?.id
});
```

### **Monitor Permission Events**
```javascript
// Student side - monitor permission updates
const socketService = window.SocketService?.getInstance();
if (socketService) {
  socketService.on('permission-updated', (data) => {
    console.log('📨 [TEST] permission-updated received:', data);
  });
  
  console.log('✅ [TEST] Monitoring permission-updated events');
}
```

### **Test Permission Change (Teacher)**
```javascript
// Teacher side - test permission change
const testPermissionChange = (studentSocketId, canEdit) => {
  const context = window.EditPermissionContext;
  if (!context) {
    console.error('❌ EditPermissionContext not available');
    return;
  }
  
  const method = canEdit ? context.grantEditPermission : context.revokeEditPermission;
  const action = canEdit ? 'grant' : 'revoke';
  
  console.log(`🧪 [TEST] Testing ${action} for ${studentSocketId}`);
  
  method(studentSocketId, (err, response) => {
    if (err) {
      console.error(`❌ [TEST] ${action} failed:`, err);
    } else {
      console.log(`✅ [TEST] ${action} successful:`, response);
    }
  });
};

// Usage: testPermissionChange('student-socket-id', true);
```

## 📊 **Event Flow Verification**

### **Expected Teacher Flow:**
```
1. 🖱️ [TEACHER_UI] Permission toggle initiated
2. 📤 [TEACHER_UI] Calling grant/revoke for StudentName
3. 📤 [CONTEXT_GRANT/REVOKE] Requesting permission
4. 📨 [CONTEXT_GRANT/REVOKE] Server response: {success: true}
5. ✅ [TEACHER_UI] Permission grant/revoke successful
6. 🔄 [TEACHER_UI] Refreshing student list
```

### **Expected Student Flow:**
```
1. 📨 [STUDENT_PERMISSION] permission-updated received
2. 📝 [STUDENT_PERMISSION] Monaco update: readOnly=false/true
3. ✅ [STUDENT_PERMISSION] Monaco updated successfully
4. 🔄 [STUDENT_PERMISSION] Context update dispatched
```

### **Expected Server Flow:**
```
1. 📥 [GRANT/REVOKE] Request received
2. 📤 [GRANT/REVOKE] Sent permission-updated to StudentName
3. ✅ [GRANT/REVOKE] Success: TeacherName → StudentName
```

## 🚨 **Common Issues & Solutions**

### **Issue: Student can still type after revoke**
**Debug Steps:**
```javascript
// Check Monaco state
const editor = window.monacoRef?.current;
console.log('Monaco readOnly:', editor?.getOptions().get(monaco.editor.EditorOption.readOnly));

// Check if permission-updated was received
// Look for: 📨 [STUDENT_PERMISSION] permission-updated received
```

**Solution**: Ensure `permission-updated` event is being sent to correct socket ID.

### **Issue: UI shows wrong button state**
**Debug Steps:**
```javascript
// Check teacher UI state
const context = window.EditPermissionContext;
console.log('Users state:', context?.users?.map(u => ({
  name: u.username,
  role: u.role,
  canEdit: u.canEdit,
  socketId: u.socketId
})));
```

**Solution**: Ensure `update-student-list` is being emitted after permission changes.

### **Issue: Permission doesn't persist after reload**
**Debug Steps:**
```javascript
// Check if initial-permission-state is received
// Look for: 🔄 [PERMISSION_CONTEXT] Initial permission state received
```

**Solution**: Ensure server sends `initial-permission-state` on user join.

## ⚡ **Performance Tests**

### **Latency Test**
```javascript
// Measure permission change latency
const measureLatency = (studentSocketId, canEdit) => {
  const startTime = Date.now();
  const context = window.EditPermissionContext;
  const method = canEdit ? context.grantEditPermission : context.revokeEditPermission;
  
  method(studentSocketId, (err, response) => {
    const latency = Date.now() - startTime;
    console.log(`⏱️ Permission change latency: ${latency}ms`, {
      success: !err,
      error: err,
      response
    });
  });
};
```

### **Stress Test**
```javascript
// Test rapid permission changes
const stressTest = async (studentSocketId) => {
  const context = window.EditPermissionContext;
  const changes = [true, false, true, false, true];
  
  for (let i = 0; i < changes.length; i++) {
    const canEdit = changes[i];
    const method = canEdit ? context.grantEditPermission : context.revokeEditPermission;
    
    await new Promise(resolve => {
      method(studentSocketId, (err, response) => {
        console.log(`🧪 Stress test ${i + 1}/${changes.length}:`, {
          canEdit,
          success: !err,
          error: err
        });
        resolve();
      });
    });
    
    // Small delay between changes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('✅ Stress test completed');
};
```

## 🎯 **Success Criteria**

### **✅ Healthy System Indicators:**
- Permission changes complete in < 500ms
- Monaco editor updates immediately (< 100ms)
- No console errors during permission changes
- UI state always matches server state
- Permissions persist after page reload
- Multiple rapid changes don't cause conflicts

### **✅ Expected Log Patterns:**
```
✅ [TEACHER_UI] Permission grant/revoke successful
✅ [STUDENT_PERMISSION] Monaco updated successfully
✅ [GRANT/REVOKE] Success: TeacherName → StudentName
🔄 [PERMISSION_CONTEXT] Updating my permission state
```

### **❌ Red Flag Patterns:**
```
❌ [TEACHER_UI] Permission toggle failed
❌ [STUDENT_PERMISSION] Monaco update failed
❌ [GRANT/REVOKE] Server rejected
💥 [TEACHER_UI] Permission toggle failed
⚠️ Monaco editor not available
```

## 🔧 **Automated Test Suite**

### **Run Full Test Suite**
```javascript
const runPermissionTestSuite = async () => {
  console.log('🧪 Starting Permission Test Suite...');
  
  // Test 1: Basic functionality
  console.log('📝 Test 1: Basic Grant/Revoke');
  // Implementation depends on your specific setup
  
  // Test 2: Persistence
  console.log('📝 Test 2: Page Reload Persistence');
  // Implementation depends on your specific setup
  
  // Test 3: Performance
  console.log('📝 Test 3: Performance Test');
  // Implementation depends on your specific setup
  
  console.log('✅ Permission Test Suite Completed');
};

// Run: runPermissionTestSuite()
```

## 🎉 **Final Verification Checklist**

- [ ] Teacher can grant permission → Student editor becomes editable
- [ ] Teacher can revoke permission → Student editor becomes read-only
- [ ] Permission changes are instant (< 500ms)
- [ ] UI buttons reflect correct state
- [ ] Permissions persist after page reload
- [ ] Multiple rapid changes work correctly
- [ ] Console shows success logs, no errors
- [ ] Toast notifications appear for students
- [ ] Server ACK confirmations work
- [ ] No memory leaks or event listener issues

## 🚀 **Ready for Production**

When all tests pass and the checklist is complete, your permission system is bulletproof and ready for production use! 🎉
