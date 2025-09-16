'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { useSocketService } from '@/hooks/useSocketService';
import { useAuth } from '@/context/AuthContext';


interface Student {
  socketId: string;
  username: string;
  userId: string;
  email?: string;
  canEdit: boolean;
  hasIndividualPermission?: boolean;
  permissionGrantedBy?: string;
  joinedAt: string;
  lastActivity: string;
}

interface UpdateUserListData {
  users: User[];
}

interface RoomPermissionChangedData {
  canEdit?: boolean;
  state?: { canEdit?: boolean };
  [key: string]: any;
}

interface User {
  username: string;
  role: 'teacher' | 'student';
  socketId: string;
  userId: string;
  canEdit: boolean;
}

interface AuthUser {
  uid?: string;
  [key: string]: any;
}

interface EditPermissionContextType {
  canEdit: boolean;
  isTeacher: boolean;
  users: User[];
  students: Student[];
  permissionBadge: 'teacher' | 'edit-access' | 'view-only';
  // Global permission state and sync
  globalCanEdit: boolean;
  // Permission change state
  isPermissionChanging: boolean;
  // RBAC: Room-wide permission toggle
  toggleRoomPermission: (cb?: (err?: any, response?: any) => void) => void;
  // Global permission synchronization
  syncIndividualWithGlobal: (newGlobalPermission: boolean) => void;
  // Individual user permission management
  setUserPermission: (targetUserId: string, canEdit: boolean, reason?: string, cb?: (err?: any, response?: any) => void) => void;
  removeUserPermission: (targetUserId: string, cb?: (err?: any, response?: any) => void) => void;
  // Internal state management
  setUsers: (users: User[]) => void;
  setStudents: (students: Student[]) => void;
  setCanEdit: (canEdit: boolean) => void;
  setIsTeacher: (isTeacher: boolean) => void;
}

const EditPermissionContext = createContext<EditPermissionContextType | undefined>(undefined);

interface EditPermissionProviderProps {
  children: ReactNode;
}

export function EditPermissionProvider({ children }: EditPermissionProviderProps) {
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [globalCanEdit, setGlobalCanEdit] = useState<boolean>(false); // New state for global permission
  
  // Add debounce mechanism to prevent rapid permission changes
  const [isPermissionChanging, setIsPermissionChanging] = useState<boolean>(false);
  
  // Add a ref to track the last global permission update to prevent overrides
  const lastGlobalPermissionUpdate = useRef<number>(0);
  
  // Add a flag to prevent multiple simultaneous permission updates
  const isUpdatingGlobalPermission = useRef<boolean>(false);

  // Use the socket service hook
  const { socketService, isReady: socketReady, isConnected } = useSocketService();
  const { user: authUser } = useAuth ? useAuth() as { user: AuthUser | null } : { user: null };

  const isTeacherRef = useRef(isTeacher);
  useEffect(() => {
    isTeacherRef.current = isTeacher;
  }, [isTeacher]);

  // Compute permission badge based on current state
  const permissionBadge: 'teacher' | 'edit-access' | 'view-only' =
    isTeacher ? 'teacher' : (canEdit ? 'edit-access' : 'view-only');

  // RBAC: Toggle room permission for all students
  const toggleRoomPermission = (cb?: (err?: any, response?: any) => void) => {
    // Prevent rapid successive calls that cause UI flickering
    if (isPermissionChanging) {
      console.log('⏸️ [RBAC] Permission change already in progress, skipping...');
      if (cb) cb('Permission change already in progress');
      return;
    }
    
    // Prevent calling when global permission is being updated
    if (isUpdatingGlobalPermission.current) {
      console.log('⏸️ [RBAC] Global permission update in progress, skipping...');
      if (cb) cb('Global permission update in progress');
      return;
    }

    // Strict role validation
    if (!isTeacher) {
      const error = 'Only teachers can toggle room permissions';
      console.warn(`❌ [RBAC_SECURITY] ${error}. Current role: ${isTeacher ? 'teacher' : 'student'}`);
      if (cb) cb(error);
      return;
    }

    if (!socketService || !socketReady) {
      const error = 'Socket service not ready, cannot toggle room permission';
      console.warn(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    // Get room ID from URL path
    const roomId = typeof window !== 'undefined' ?
      window.location.pathname.split('/').pop() : null;

    if (!roomId) {
      const error = 'Room ID not found in URL';
      console.warn(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    // Use server authoritative toggle to avoid client/server drift
    const sock = socketService.getSocket();
    if (!sock) {
      const error = 'Socket instance not available';
      console.warn(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    // Set permission changing flag to prevent rapid calls
    setIsPermissionChanging(true);
    
    console.log(`🎯 [RBAC] Requesting server to toggle room permission for room ${roomId}`);
    
    // Don't set globalCanEdit here - let the server event handle it
    // This prevents the UI flickering issue
    sock.emit('toggle-room-permission', { roomId }, (response: any) => {
      if (response?.success) {
        console.log(`✅ [RBAC] Server toggled room permission:`, response);
        // Don't set globalCanEdit here - let room-permission-changed event handle it
        // This ensures consistency and prevents UI flickering
        if (cb) cb(undefined, response);
      } else {
        const errMsg = response?.error || 'Unknown error';
        console.error(`❌ [RBAC] Toggle failed:`, errMsg);
        if (cb) cb(errMsg, response);
      }
      
      // Reset permission changing flag after a delay to allow server events to process
      setTimeout(() => {
        setIsPermissionChanging(false);
      }, 500);
    });
  };

  // Individual user permission management
  const setUserPermission = (targetUserId: string, canEdit: boolean, reason?: string, cb?: (err?: any, response?: any) => void) => {
    // Strict role validation
    if (!isTeacher) {
      const error = 'Only teachers can set user permissions';
      console.warn(`❌ [RBAC_SECURITY] ${error}. Current role: ${isTeacher ? 'teacher' : 'student'}`);
      if (cb) cb(error);
      return;
    }

    if (!socketService || !socketReady) {
      const error = 'Socket service not ready, cannot set user permission';
      console.warn(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    console.log(`🎯 [RBAC] Setting permission for user ${targetUserId} to ${canEdit}. Reason: ${reason || 'No reason provided'}`);
    console.log(`🎯 [RBAC] Current students before setting permission:`, students.map(s => ({ 
      userId: s.userId, 
      username: s.username, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission 
    })));

    // Get current teacher's username for permission tracking
    const currentTeacher = users.find(u => u.role === 'teacher');
    const teacherUsername = currentTeacher?.username || 'Teacher';
    
    // Update the student's permission locally first (optimistic update)
    const updatedStudents = students.map(student => 
      student.userId === targetUserId 
        ? { ...student, canEdit, hasIndividualPermission: true, permissionGrantedBy: teacherUsername }
        : student
    );

    console.log(`🎯 [RBAC] Updated students after setting permission:`, updatedStudents.map(s => ({ 
      userId: s.userId, 
      username: s.username, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission 
    })));

    setStudents(updatedStudents);

    // Check if all students now have the same permission
    const allStudents = updatedStudents.filter(s => {
      const user = users.find(u => u.userId === s.userId);
      return user && user.role === 'student';
    });
    
    if (allStudents.length > 0) {
      const allHaveSamePermission = allStudents.every(s => s.canEdit === allStudents[0].canEdit);
      if (allHaveSamePermission) {
        console.log('[SYNC] All students now have same permission, updating global permission to:', allStudents[0].canEdit);
        setGlobalCanEdit(allStudents[0].canEdit);
      }
    }

    // Emit the update and wait for server confirmation
    const sock = socketService.getSocket();
    if (sock) {
      console.log(`📡 [RBAC] About to emit set-user-permission with:`, { 
        roomId: typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null,
        targetUserId,
        canEdit,
        reason: reason || 'Permission toggled by teacher'
      });
      
      // Send the permission change to the server using the correct event
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null;
      if (roomId) {
        sock.emit('set-user-permission', { roomId, targetUserId, canEdit, reason: reason || 'Permission toggled by teacher' });
        console.log(`📡 [RBAC] Emitted set-user-permission to server for user ${targetUserId}`);
        
        // Request the updated student list from server to confirm the change
        sock.emit('request-student-list', { roomId });
        console.log(`📡 [RBAC] Requested updated student list from server for room: ${roomId}`);
      }
    }

    if (cb) cb(undefined, { success: true, userId: targetUserId, canEdit });
  };

  const removeUserPermission = (targetUserId: string, cb?: (err?: any, response?: any) => void) => {
    // Strict role validation
    if (!isTeacher) {
      const error = 'Only teachers can remove user permissions';
      console.warn(`❌ [RBAC_SECURITY] ${error}. Current role: ${isTeacher ? 'teacher' : 'student'}`);
      if (cb) cb(error);
      return;
    }

    if (!socketService || !socketReady) {
      const error = 'Socket service not ready, cannot remove user permission';
      console.warn(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    console.log(`🎯 [RBAC] Removing individual permission for user ${targetUserId}`);

    // Reset the student's permission to match global permission
    const updatedStudents = students.map(student => 
      student.userId === targetUserId 
        ? { ...student, canEdit: globalCanEdit, hasIndividualPermission: false, permissionGrantedBy: undefined }
        : student
    );

    setStudents(updatedStudents);

    // Check if all students now have the same permission
    const allStudents = updatedStudents.filter(s => {
      const user = users.find(u => u.userId === s.userId);
      return user && user.role === 'student';
    });
    
    if (allStudents.length > 0) {
      const allHaveSamePermission = allStudents.every(s => s.canEdit === allStudents[0].canEdit);
      if (allHaveSamePermission) {
        console.log('[SYNC] All students now have same permission after removal, updating global permission to:', allStudents[0].canEdit);
        setGlobalCanEdit(allStudents[0].canEdit);
      }
    }

    // Emit the update and request confirmation
    const sock = socketService.getSocket();
    if (sock) {
      // Send the permission removal to the server using the correct event
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null;
      if (roomId) {
        sock.emit('remove-user-permission', { roomId, targetUserId });
        console.log(`📡 [RBAC] Emitted remove-user-permission to server for user ${targetUserId}`);
        
        // Request the updated student list from server to confirm the change
        sock.emit('request-student-list', { roomId });
        console.log(`📡 [RBAC] Requested updated student list from server for room: ${roomId}`);
      }
    }

    if (cb) cb(undefined, { success: true, userId: targetUserId });
  };

  // --- Permission event throttle ---
  let lastPermissionTimestamp = Date.now();

  // --- Room permission change handler ---
  const handleRoomPermissionChanged = (data: RoomPermissionChangedData) => {
    console.log('[PERM-FLOW] ROOM-PERMISSION-CHANGED - Received data:', data);
    
    // Extract the permission value
    const newPermission = data.canEdit ?? data.state?.canEdit ?? null;
    
    if (newPermission !== null) {
      console.log('[PERM-FLOW] ROOM-PERMISSION-CHANGED - Setting global permission to:', newPermission);
      
      // Set the updating flag to prevent other handlers from interfering
      isUpdatingGlobalPermission.current = true;
      
      // Update global permission - this is the authoritative source
      // Use functional update to ensure we're working with the latest state
      setGlobalCanEdit(prevGlobal => {
        if (prevGlobal === newPermission) {
          console.log('[PERM-FLOW] Global permission already matches, no update needed');
          return prevGlobal;
        }
        console.log('[PERM-FLOW] Updating global permission from', prevGlobal, 'to', newPermission);
        // Track when this update happened to prevent other handlers from overriding it
        lastGlobalPermissionUpdate.current = Date.now();
        return newPermission;
      });

      // Also immediately reflect for the current user when not a teacher, so UI updates without reload
      if (!isTeacher) {
        try {
          const authUserId = (authUser && 'uid' in authUser ? authUser.uid : undefined) || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);
          const hasIndividualOverride = authUserId
            ? students.some(s => s.userId === authUserId && s.hasIndividualPermission)
            : false;
          if (!hasIndividualOverride) {
            console.log('[PERM-FLOW] Applying global canEdit to current user:', newPermission);
            setCanEdit(newPermission);
          } else {
            console.log('[PERM-FLOW] Current user has individual override; skipping canEdit update from global');
          }
        } catch (error) {
          // Safe fallback: apply global to current user
          setCanEdit(newPermission);
        }
      }
      
      // CRITICAL: Don't call syncIndividualWithGlobal here as it can cause conflicts
      // The server should handle syncing individual permissions
      console.log('[PERM-FLOW] Skipping syncIndividualWithGlobal to prevent UI flickering');
      
      // Reset the updating flag after a delay to allow state to settle
      setTimeout(() => {
        isUpdatingGlobalPermission.current = false;
        console.log('[PERM-FLOW] Reset global permission updating flag');
      }, 1000);
    } else {
      console.warn('[PERM-FLOW] ROOM-PERMISSION-CHANGED - No valid permission data found:', data);
    }
  };

  // --- User list update handler ---
  const handleUpdateUserList = (data: UpdateUserListData) => {
    // Update the timestamp to track when this handler was called
    lastPermissionTimestamp = Date.now();
    
    // Check if we're currently updating global permission to prevent conflicts
    if (isUpdatingGlobalPermission.current) {
      console.log('[SKIP-UPDATE] Global permission update in progress, skipping user list update');
      return;
    }
    
    // Check if we recently updated global permission to prevent conflicts
    const timeSinceLastGlobalUpdate = Date.now() - lastGlobalPermissionUpdate.current;
    if (timeSinceLastGlobalUpdate < 1000) { // 1 second protection
      console.log('[SKIP-UPDATE] Too soon after global permission update (', timeSinceLastGlobalUpdate, 'ms ago)');
      return;
    }
    
    console.log('[PERM-FLOW] UPDATE-USER-LIST - Received users:', data.users);
    
    setUsers(data.users);
    const sock = socketService?.getSocket && socketService.getSocket();
    const mySocketId = sock?.id || null;
    const authUserId = (authUser && 'uid' in authUser ? authUser.uid : undefined) || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);
    let myUser = null;
    if (mySocketId) myUser = data.users.find((u: User) => u.socketId === mySocketId);
    if (!myUser && authUserId) myUser = data.users.find((u: User) => u.userId === authUserId);
    
    console.log('[PERM-FLOW] UPDATE-USER-LIST:', {
      myUser,
      isTeacherPrev: isTeacherRef.current,
      prevCanEdit: canEdit,
      totalUsers: data.users.length,
      teachers: data.users.filter(u => u.role === 'teacher').length,
      students: data.users.filter(u => u.role === 'student').length
    });
    
    if (myUser) {
      if (myUser.role === 'teacher') {
        setIsTeacher(true);
        setCanEdit(true);
      } else {
        setIsTeacher(false);
        // Do NOT set canEdit for students here; let room-permission-changed control it
      }
    } else {
      console.warn('[WARN][EditPermissionContext] Could not find matching user in update-user-list. Socket ID:', mySocketId, 'User ID:', authUserId);
    }
    
    // NEVER override students list from update-user-list
    // This event only contains basic user data, not detailed permission information
    // Students list should only be updated by update-student-list events
    console.log('[PERM-FLOW] SKIPPING students update from update-user-list to preserve detailed permission data');
    console.log('[PERM-FLOW] Current students with permissions:', students);
  };

  // --- Room users updated handler ---
  const handleRoomUsersUpdated = (data: UpdateUserListData) => {
    // Update the timestamp to track when this handler was called
    lastPermissionTimestamp = Date.now();
    
    // Check if we're currently updating global permission to prevent conflicts
    if (isUpdatingGlobalPermission.current) {
      console.log('[SKIP-UPDATE] Global permission update in progress, skipping room users update');
      return;
    }
    
    // Check if we recently updated global permission to prevent conflicts
    const timeSinceLastGlobalUpdate = Date.now() - lastGlobalPermissionUpdate.current;
    if (timeSinceLastGlobalUpdate < 1000) { // 1 second protection
      console.log('[SKIP-UPDATE] Too soon after global permission update (', timeSinceLastGlobalUpdate, 'ms ago)');
      return;
    }
    
    console.log('[PERM-FLOW] ROOM-USERS-UPDATED - Received users:', data.users);
    console.log('[PERM-FLOW] ROOM-USERS-UPDATED - Current students state before update:', students);
    console.log('[PERM-FLOW] ROOM-USERS-UPDATED - Current canEdit state:', canEdit);
    
    setUsers(data.users);
    const sock = socketService?.getSocket && socketService.getSocket();
    const mySocketId = sock?.id || null;
    const authUserId = (authUser && 'uid' in authUser ? authUser.uid : undefined) || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);
    let myUser = null;
    if (mySocketId) myUser = data.users.find((u: User) => u.socketId === mySocketId);
    if (!myUser && authUserId) myUser = data.users.find((u: User) => u.userId === authUserId);
    
    console.log('[PERM-FLOW] ROOM-USERS-UPDATED:', {
      myUser,
      isTeacherPrev: isTeacherRef.current,
      prevCanEdit: canEdit,
      totalUsers: data.users.length,
      teachers: data.users.filter(u => u.role === 'teacher').length,
      students: data.users.filter(u => u.role === 'student').length
    });
    
    if (myUser) {
      if (myUser.role === 'teacher') {
        setIsTeacher(true);
        setCanEdit(true);
      } else {
        setIsTeacher(false);
        // Check if this user has an individual permission override
        const hasIndividualPermission = students.some(s => s.userId === myUser.userId && s.hasIndividualPermission);
        if (hasIndividualPermission) {
          console.log('[PERM-FLOW] User has individual permission, not overriding canEdit from room-users-updated');
        } else {
          // Only set canEdit if no individual permission exists
          console.log('[PERM-FLOW] User has no individual permission, setting canEdit from room-users-updated');
          setCanEdit(!!myUser.canEdit);
        }
      }
    } else {
      console.warn('[WARN][EditPermissionContext] Could not find matching user in room-users-updated. Socket ID:', mySocketId, 'User ID:', authUserId);
    }
    
    // NEVER override students list from room-users-updated
    // This event only contains basic user data, not detailed permission information
    // Students list should only be updated by update-student-list events
    console.log('[PERM-FLOW] SKIPPING students update from room-users-updated to preserve detailed permission data');
    console.log('[PERM-FLOW] Current students with permissions:', students);
  };

  // Individual user permission event handlers
  const handleUserPermissionChanged = (data: any) => {
    console.log('[PERM-FLOW][USER-PERM CHANGE EVENT] =>', data);
    // Update local permission if this is the current user
    if (data.canEdit !== undefined) {
      setCanEdit(data.canEdit);
      console.log(`✅ [PERM-FLOW] Updated local canEdit to: ${data.canEdit}`);
    }
    
    // Also refresh the students list to show the updated permission
    // This ensures the individual permissions panel shows the current state
    if (socketService && socketReady) {
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null;
      if (roomId) {
        console.log(`🔄 [PERM-FLOW] Refreshing student list after permission change for room: ${roomId}`);
        const socket = socketService.getSocket && socketService.getSocket();
        if (socket) {
          socket.emit('request-student-list', { roomId });
        }
      }
    }
  };

  const handleUserPermissionSet = (data: any) => {
    console.log('[PERM-FLOW][USER-PERM SET EVENT] =>', data);
    // Permission was set successfully, user list will be updated via room-users-updated
  };

  const handleUserPermissionRemoved = (data: any) => {
    console.log('[PERM-FLOW][USER-PERM REMOVED EVENT] =>', data);
    // Permission was removed successfully, user list will be updated via room-users-updated
  };

  const handleUserPermissionError = (data: any) => {
    console.error('[PERM-FLOW][USER-PERM ERROR EVENT] =>', data);
    // Handle permission errors (could show toast notification)
  };

  // Handle permission denied events (when user tries to perform action without permission)
  const handlePermissionDenied = (data: any) => {
    console.error('[PERM-FLOW][PERMISSION DENIED] =>', data);
    // Show user feedback that they don't have permission
    // Try to use toast if available, otherwise fallback to alert
    try {
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast(data.message || 'Permission denied', 'error');
      } else {
        // Fallback to alert if toast is not available
        alert(data.message || 'Permission denied');
      }
    } catch (error) {
      // Final fallback to console and alert
      console.error('Error showing permission denied message:', error);
      alert(data.message || 'Permission denied');
    }
  };

  // Handle student list updates (for individual permissions)
  const handleStudentListUpdate = (data: { students: Student[] }) => {
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Received students:', data.students);
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Received students details:', data.students.map(s => ({ 
      userId: s.userId, 
      username: s.username, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission,
      permissionGrantedBy: s.permissionGrantedBy
    })));
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Current students state before update:', students.map(s => ({ 
      userId: s.userId, 
      username: s.username, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission,
      permissionGrantedBy: s.permissionGrantedBy
    })));
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Current canEdit state:', canEdit);
    
    setStudents(data.students);
    
    // Find current user in the updated student list
    const sock = socketService?.getSocket && socketService.getSocket();
    const mySocketId = sock?.id || null;
    const authUserId = (authUser && 'uid' in authUser ? authUser.uid : undefined) || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null);
    
    let myStudent = null;
    if (mySocketId) myStudent = data.students.find(s => s.socketId === mySocketId);
    if (!myStudent && authUserId) myStudent = data.students.find(s => s.userId === authUserId);
    
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Found my student record:', myStudent);
    
    if (myStudent) {
      console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Updating canEdit to:', myStudent.canEdit);
      setCanEdit(myStudent.canEdit);
      console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] canEdit state updated to:', myStudent.canEdit);
    } else {
      console.warn('[PERM-FLOW][STUDENT-LIST-UPDATE] Could not find matching student record. Socket ID:', mySocketId, 'User ID:', authUserId);
    }
    
    // Check if all students now have the same permission and update global permission
    if (isTeacher && data.students.length > 0) {
      const allStudents = data.students.filter(s => {
        const user = users.find(u => u.userId === s.userId);
        return user && user.role === 'student';
      });
      
      if (allStudents.length > 0) {
        const allHaveSamePermission = allStudents.every(s => s.canEdit === allStudents[0].canEdit);
        if (allHaveSamePermission) {
          const newGlobalPermission = allStudents[0].canEdit;
          console.log('[SYNC] All students have same permission after update, setting global to:', newGlobalPermission);
          setGlobalCanEdit(newGlobalPermission);
        }
      }
    }
    
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Final state - students:', data.students.length, 'canEdit:', myStudent?.canEdit);
    console.log('[PERM-FLOW][STUDENT-LIST-UPDATE] Final students details:', data.students.map(s => ({ 
      userId: s.userId, 
      username: s.username, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission,
      permissionGrantedBy: s.permissionGrantedBy
    })));
  };

  // RBAC: User join events handled by room-users-updated

  // Initialize students list when component first loads
  useEffect(() => {
    if (socketReady && socketService && students.length === 0) {
      console.log('[INIT] Component loaded, requesting initial student list');
      const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null;
      if (roomId) {
        const socket = socketService.getSocket && socketService.getSocket();
        if (socket) {
          socket.emit('request-student-list', { roomId });
          console.log('[INIT] Requested initial student list for room:', roomId);
        }
      }
    }
  }, [socketReady, socketService, students.length]);

  // Set up RBAC socket listeners (clean, minimal)
  useEffect(() => {
    if (!socketReady || !socketService) return;
    socketService.on('room-permission-changed', handleRoomPermissionChanged);
    socketService.on('update-user-list', handleUpdateUserList);
    socketService.on('room-users-updated', handleRoomUsersUpdated);
    // Individual user permission events
    socketService.on('user-permission-changed', handleUserPermissionChanged);
    socketService.on('user-permission-set', handleUserPermissionSet);
    socketService.on('user-permission-removed', handleUserPermissionRemoved);
    socketService.on('user-permission-error', handleUserPermissionError);
    // Handle permission denied events
    socketService.on('permission-denied', handlePermissionDenied);
    // Handle student list updates
    socketService.on('update-student-list', handleStudentListUpdate);
    console.log('[DEBUG][EditPermissionContext] Socket listeners registered');
    return () => {
      if (!socketService) return;
      socketService.off('room-permission-changed', handleRoomPermissionChanged);
      socketService.off('update-user-list', handleUpdateUserList);
      socketService.off('room-users-updated', handleRoomUsersUpdated);
      // Individual user permission events
      socketService.off('user-permission-changed', handleUserPermissionChanged);
      socketService.off('user-permission-set', handleUserPermissionSet);
      socketService.off('user-permission-removed', handleUserPermissionRemoved);
      socketService.off('user-permission-error', handleUserPermissionError);
      // Clean up permission denied listener
      socketService.off('permission-denied', handlePermissionDenied);
      // Clean up student list update listener
      socketService.off('update-student-list', handleStudentListUpdate);
      console.log('[DEBUG][EditPermissionContext] Socket listeners cleaned up');
    };
  }, [socketReady, socketService]);

  // Listen for local permission updates from CodeEditor
  const handleLocalPermissionUpdate = (event: CustomEvent) => {
    const { canEdit } = event.detail;
    console.log(`🔄 [PERMISSION_CONTEXT] Local permission update:`, { canEdit });
    setCanEdit(canEdit);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('update-local-permission', handleLocalPermissionUpdate as EventListener);
  }

  // Cleanup listeners
  useEffect(() => {
    return () => {
      try {
        if (socketService) {
          socketService.off('room-permission-changed', handleRoomPermissionChanged);
          socketService.off('update-user-list', handleUpdateUserList);
          socketService.off('room-users-updated', handleRoomUsersUpdated);
          // Individual user permission events
          socketService.off('user-permission-changed', handleUserPermissionChanged);
          socketService.off('user-permission-set', handleUserPermissionSet);
          socketService.off('user-permission-removed', handleUserPermissionRemoved);
          socketService.off('user-permission-error', handleUserPermissionError);
          // Clean up permission denied listener
          socketService.off('permission-denied', handlePermissionDenied);
          // Clean up student list update listener
          socketService.off('update-student-list', handleStudentListUpdate);
          console.log('✅ RBAC socket listeners cleaned up');
        }

        // Clean up local event listener
        if (typeof window !== 'undefined') {
          window.removeEventListener('update-local-permission', handleLocalPermissionUpdate as EventListener);
        }
      } catch (error) {
        console.error('Error cleaning up socket listeners:', error);
      }
    };
  }, [socketReady, socketService]);

  // RBAC: No need to request student lists - handled by room-users-updated events

  // Log permission changes for debugging
  useEffect(() => {
    console.log(`Edit permission state: canEdit=${canEdit}, isTeacher=${isTeacher}, socketReady=${socketReady}, isConnected=${isConnected}`);
  }, [canEdit, isTeacher, socketReady, isConnected]);

  // Debug canEdit state changes
  useEffect(() => {
    console.log('[DEBUG] canEdit state changed to:', canEdit, 'timestamp:', new Date().toISOString(), 'stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
  }, [canEdit]);

  // Debug students state changes
  useEffect(() => {
    console.log('[DEBUG] Students state changed:', {
      newLength: students.length,
      students: students.map(s => ({ username: s.username, userId: s.userId, canEdit: s.canEdit, hasIndividualPermission: s.hasIndividualPermission })),
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [students]);

  // Sync global permission with individual permissions
  useEffect(() => {
    if (isTeacher && students.length > 0) {
      // Check if all students have the same permission
      const allStudents = students.filter(s => {
        const user = users.find(u => u.userId === s.userId);
        return user && user.role === 'student';
      });
      
      if (allStudents.length > 0) {
        const allHaveSamePermission = allStudents.every(s => s.canEdit === allStudents[0].canEdit);
        const globalPermission = allHaveSamePermission ? allStudents[0].canEdit : null;
        
        console.log('[SYNC] Global permission sync check:', {
          allStudents: allStudents.length,
          allHaveSamePermission,
          globalPermission,
          individualPermissions: allStudents.map(s => ({ userId: s.userId, canEdit: s.canEdit }))
        });
        
        // Update global permission to match individual permissions
        if (globalPermission !== null && globalPermission !== globalCanEdit) {
          console.log('[SYNC] Updating global permission to match individual permissions:', globalPermission);
          setGlobalCanEdit(globalPermission);
        }
      }
    }
  }, [students, users, isTeacher, globalCanEdit]);

  // Sync individual permissions with global permission
  const syncIndividualWithGlobal = useCallback((newGlobalPermission: boolean) => {
    if (!isTeacher || students.length === 0) return;
    
    // Check if we're currently updating global permission to prevent conflicts
    if (isUpdatingGlobalPermission.current) {
      console.log('[SYNC] Global permission update in progress, skipping sync');
      return;
    }
    
    // Check if we recently updated global permission to prevent conflicts
    const timeSinceLastGlobalUpdate = Date.now() - lastGlobalPermissionUpdate.current;
    if (timeSinceLastGlobalUpdate < 1000) { // 1 second protection
      console.log('[SYNC] Skipping sync - global permission was recently updated (', timeSinceLastGlobalUpdate, 'ms ago)');
      return;
    }
    
    console.log('[SYNC] Syncing individual permissions to global permission:', newGlobalPermission);
    console.log('[SYNC] Current students before sync:', students.map(s => ({ 
      userId: s.userId, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission 
    })));
    
    // Only update students that don't have individual permissions
    const updatedStudents = students.map(student => {
      if (student.hasIndividualPermission) {
        console.log(`[SYNC] Preserving individual permission for ${student.username}: ${student.canEdit}`);
        return student; // Keep individual permission unchanged
      } else {
        console.log(`[SYNC] Syncing ${student.username} to global permission: ${newGlobalPermission}`);
        return {
          ...student,
          canEdit: newGlobalPermission,
          hasIndividualPermission: false // Already false, but explicit
        };
      }
    });
    
    setStudents(updatedStudents);
    
    // CRITICAL: Don't emit update-student-list here as it can cause infinite loops
    // The server should handle syncing individual permissions
    console.log('[SYNC] Skipping emit update-student-list to prevent infinite loops');
    
    console.log('[SYNC] Students after sync:', updatedStudents.map(s => ({ 
      userId: s.userId, 
      canEdit: s.canEdit, 
      hasIndividualPermission: s.hasIndividualPermission 
    })));
  }, [isTeacher, students, socketService]);

  // Optionally wrap context value in useMemo for reactivity
  const value = useMemo(() => ({
    canEdit,
    isTeacher,
    users,
    students,
    permissionBadge,
    toggleRoomPermission,
    setUserPermission,
    removeUserPermission,
    setUsers,
    setStudents,
    setCanEdit,
    setIsTeacher,
    globalCanEdit,
    isPermissionChanging,
    syncIndividualWithGlobal
  }), [canEdit, isTeacher, users, students, permissionBadge, toggleRoomPermission, setUserPermission, removeUserPermission, globalCanEdit, isPermissionChanging, syncIndividualWithGlobal]);

  return (
    <EditPermissionContext.Provider value={value}>
      {children}
    </EditPermissionContext.Provider>
  );
}

export function useEditPermission() {
  const context = useContext(EditPermissionContext);
  if (context === undefined) {
    throw new Error('useEditPermission must be used within an EditPermissionProvider');
  }
  return context;
}
