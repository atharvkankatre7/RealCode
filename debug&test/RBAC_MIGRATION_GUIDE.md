# 🚀 **RBAC Migration Guide**

## 🎯 **What Changed**

Your collaborative code editor now uses a **simple Role-Based Access Control (RBAC) system** instead of complex per-student permissions.

### **Before (Complex):**
- ❌ Individual permission toggles for each student
- ❌ Complex permission state management
- ❌ Multiple socket events for individual permissions
- ❌ UI clutter with per-student controls

### **After (Simple RBAC):**
- ✅ **Two roles only**: Teacher (always can edit) + Student (room-dependent)
- ✅ **One toggle**: Room is editable (yes/no)
- ✅ **One event**: `room-permission-changed` for all students
- ✅ **Clean UI**: Single room control panel

---

## 🔧 **How to Update Your Code**

### **1. Replace Old Permission Components**

**❌ Remove these imports:**
```tsx
import EditPermissionPanel from '@/components/EditPermissionPanel';
import TeacherControlPanel from '@/components/TeacherControlPanel';
```

**✅ Use this instead:**
```tsx
import SimpleRoomControl from '@/components/SimpleRoomControl';
```

### **2. Update Your Main Editor Component**

**❌ Old way:**
```tsx
// Remove these
<EditPermissionPanel />
<TeacherControlPanel />

// Remove these context calls
const { grantEditPermission, revokeEditPermission, setEditPermission } = useEditPermission();
```

**✅ New way:**
```tsx
// Add this
<SimpleRoomControl />

// Use this context call
const { toggleRoomPermission, canEdit, isTeacher } = useEditPermission();
```

### **3. Update Permission Logic**

**❌ Old individual permissions:**
```tsx
// Don't use these anymore
grantEditPermission(studentId);
revokeEditPermission(studentId);
setEditPermission(studentId, true);
```

**✅ New room-wide permission:**
```tsx
// Use this for room-wide control
toggleRoomPermission((err, response) => {
  if (!err) {
    console.log('Room permission:', response.canEdit);
  }
});
```

---

## 🎯 **RBAC System Logic**

### **Permission Rules:**
```javascript
// Teachers: Always can edit
if (userRole === 'teacher') {
  canEdit = true;
}

// Students: Based on room permission
if (userRole === 'student') {
  canEdit = roomPermission; // true or false
}
```

### **Room Permission Toggle:**
```javascript
// Teacher clicks toggle
toggleRoomPermission() 
  → Server toggles room.canEdit
  → Emits 'room-permission-changed' to ALL users
  → All student editors update instantly
```

---

## 🧪 **Testing Your Migration**

### **Test 1: Basic Toggle**
1. **Teacher**: Open room, see `SimpleRoomControl` panel
2. **Students**: Join room (should be read-only by default)
3. **Teacher**: Click "Enable Student Editing"
4. **Expected**: All students can edit immediately

### **Test 2: Disable Toggle**
1. **Teacher**: Click "Disable Student Editing"
2. **Expected**: All students become read-only immediately

### **Test 3: Teacher Always Edits**
1. **Teacher**: Try editing when room is disabled
2. **Expected**: Teacher can always edit regardless

### **Test 4: New Student Joins**
1. **Setup**: Room editing disabled
2. **Action**: New student joins
3. **Expected**: New student is read-only (matches room state)

---

## 🔍 **Debug Console Commands**

### **Check RBAC State:**
```javascript
// Run in browser console
const context = window.EditPermissionContext;
console.log('RBAC State:', {
  canEdit: context?.canEdit,
  isTeacher: context?.isTeacher,
  userRole: localStorage.getItem('userRole'),
  students: context?.students?.length
});
```

### **Test Room Toggle (Teacher):**
```javascript
// Teacher console only
const context = window.EditPermissionContext;
context?.toggleRoomPermission((err, res) => {
  console.log('Toggle result:', { err, canEdit: res?.canEdit });
});
```

---

## 🎉 **Expected Behavior**

### **✅ Healthy RBAC System:**
- Room toggle completes in < 500ms
- All students update simultaneously
- Clean console logs with `[RBAC]` prefix
- No permission conflicts or errors
- Simple, predictable UI behavior

### **✅ Success Logs:**
```
✅ [RBAC] Room permission changed: { canEdit: true }
✅ [RBAC] Editor updated successfully
✅ [RBAC] Toggle successful
```

### **❌ Red Flags:**
```
❌ [RBAC] Toggle failed
❌ [RBAC] Editor update failed
❌ grantEditPermission is not a function
```

---

## 🚨 **Common Migration Issues**

### **Issue: "grantEditPermission is not a function"**
**Cause**: Old components still trying to use individual permissions
**Fix**: Replace with `SimpleRoomControl` and use `toggleRoomPermission`

### **Issue: Students don't update**
**Cause**: Not listening to `room-permission-changed` event
**Fix**: Ensure `CodeEditor` has RBAC event listener

### **Issue: UI shows old permission panels**
**Cause**: Old components still imported
**Fix**: Remove all old permission component imports

---

## 🎯 **Final Checklist**

- [ ] Removed `EditPermissionPanel` imports
- [ ] Removed `TeacherControlPanel` complex logic
- [ ] Added `SimpleRoomControl` component
- [ ] Updated context calls to use `toggleRoomPermission`
- [ ] Tested room toggle with multiple students
- [ ] Verified teachers can always edit
- [ ] Confirmed students sync instantly
- [ ] No console errors related to permissions

---

## 🚀 **You're Done!**

Your collaborative code editor now has:
- ✅ **Simple RBAC**: Two roles, one toggle
- ✅ **Instant Sync**: All students update together
- ✅ **Clean UI**: No complex permission panels
- ✅ **Bulletproof**: No individual permission conflicts
- ✅ **Better UX**: Predictable, easy-to-understand behavior

**The system is production-ready!** 🎉

---

## 📞 **Need Help?**

If you encounter issues:
1. Check browser console for `[RBAC]` logs
2. Verify `SimpleRoomControl` is imported correctly
3. Ensure old permission components are removed
4. Test with teacher + student in separate tabs

The RBAC system is much simpler and more reliable than the old individual permission system!
