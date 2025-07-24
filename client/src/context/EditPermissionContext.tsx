'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo } from 'react';
import { useSocketService } from '@/hooks/useSocketService';
import { useAuth } from '@/context/AuthContext';


interface Student {
  socketId: string;
  username: string;
  userId: string;
  email?: string;
  canEdit: boolean;
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
  // RBAC: Room-wide permission toggle only
  toggleRoomPermission: (cb?: (err?: any, response?: any) => void) => void;
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
      const error = 'No room ID found in URL path';
      console.error(`❌ [RBAC_CONTEXT] ${error}`);
      if (cb) cb(error);
      return;
    }

    console.log(`🎯 [RBAC_CONTEXT] Teacher toggling room permission for room ${roomId}`);

    try {
      // Use the socket directly for RBAC events
      const sock = socketService.getSocket && socketService.getSocket();
      if (sock && typeof sock.emit === 'function') {
        (sock.emit as any)('toggle-room-permission', { roomId }, (response: any) => {
          console.log(`📨 [RBAC_CONTEXT] Server response:`, response);

          if (response && response.success) {
            console.log(`✅ [RBAC_CONTEXT] Room permission toggled successfully: ${response.canEdit}`);
            if (cb) cb(null, response);
          } else {
            const error = response?.error || 'Unknown server error';
            console.error(`❌ [RBAC_CONTEXT] Room permission toggle failed:`, error);
            if (cb) cb(error, response);
          }
        });
      } else {
        const error = 'Socket instance not available';
        console.error(`❌ [RBAC_CONTEXT] ${error}`);
        if (cb) cb(error);
      }
    } catch (error) {
      console.error(`💥 [RBAC_CONTEXT] Error toggling room permission:`, error);
      if (cb) cb(error);
    }
  };

  // --- Permission event throttle ---
  let lastPermissionTimestamp = Date.now();

  // --- Room permission change handler ---
  const handleRoomPermissionChanged = (data: RoomPermissionChangedData) => {
    console.log('[PERM-FLOW][ROOM-PERM CHANGE EVENT] =>', data);
    // Support both direct and nested canEdit
    const canEditValue = typeof data.canEdit === 'boolean'
      ? data.canEdit
      : (data.state && typeof data.state.canEdit === 'boolean' ? data.state.canEdit : undefined);

    if (typeof canEditValue === 'boolean') {
      setCanEdit(canEditValue); // ✅ always set
    } else {
      console.warn('⚠️ Invalid canEdit value:', data.canEdit, data.state?.canEdit);
    }
  };

  // --- User list update handler ---
  const handleUpdateUserList = (data: UpdateUserListData) => {
    if (Date.now() - lastPermissionTimestamp < 200) {
      console.log('[SKIP-UPDATE] Too soon after permission event');
      return;
    }
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
      prevCanEdit: canEdit
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
    // Update students for teachers
    if (myUser && myUser.role === 'teacher') {
      const studentsFromUsers = data.users.filter((u: User) => u.role === 'student').map((u: User) => ({
        socketId: u.socketId,
        username: u.username,
        userId: u.userId,
        canEdit: !!u.canEdit,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }));
      setStudents(studentsFromUsers);
    }
  };

  // --- Room users updated handler ---
  const handleRoomUsersUpdated = (data: UpdateUserListData) => {
    if (Date.now() - lastPermissionTimestamp < 200) {
      console.log('[SKIP-UPDATE] Too soon after permission event');
      return;
    }
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
      prevCanEdit: canEdit
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
      console.warn('[WARN][EditPermissionContext] Could not find matching user in room-users-updated. Socket ID:', mySocketId, 'User ID:', authUserId);
    }
    // Update students for teachers
    if (myUser && myUser.role === 'teacher') {
      const studentsFromUsers = data.users.filter((u: User) => u.role === 'student').map((u: User) => ({
        socketId: u.socketId,
        username: u.username,
        userId: u.userId,
        canEdit: !!u.canEdit,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }));
      setStudents(studentsFromUsers);
    }
  };

  // RBAC: User join events handled by room-users-updated

  // Set up RBAC socket listeners (clean, minimal)
  useEffect(() => {
    if (!socketReady || !socketService) return;
    socketService.on('room-permission-changed', handleRoomPermissionChanged);
    socketService.on('update-user-list', handleUpdateUserList);
    socketService.on('room-users-updated', handleRoomUsersUpdated);
    console.log('[DEBUG][EditPermissionContext] Socket listeners registered');
    return () => {
      if (!socketService) return;
      socketService.off('room-permission-changed', handleRoomPermissionChanged);
      socketService.off('update-user-list', handleUpdateUserList);
      socketService.off('room-users-updated', handleRoomUsersUpdated);
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

  // Add deep logging for canEdit
  useEffect(() => {
    console.log('[RBAC_CONTEXT] Updated canEdit =', canEdit);
  }, [canEdit]);

  // Optionally wrap context value in useMemo for reactivity
  const value = useMemo(() => ({
    canEdit,
    isTeacher,
    users,
    students,
    permissionBadge,
    toggleRoomPermission,
    setUsers,
    setStudents,
    setCanEdit,
    setIsTeacher
  }), [canEdit, isTeacher, users, students, permissionBadge, toggleRoomPermission]);

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
