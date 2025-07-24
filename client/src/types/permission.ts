// Permission-related type definitions for the collaborative code editor

export interface PermissionChangeEvent {
  roomId: string;
  targetSocketId: string;
  canEdit: boolean;
  requestId?: string;
}

export interface PermissionChangedEvent {
  canEdit: boolean;
  userId: string;
  socketId: string;
  username: string;
  changedBy: string;
  timestamp: string;
  requestId?: string;
}

export interface PermissionChangeResponse {
  success: boolean;
  error?: string;
  targetUser?: {
    socketId: string;
    username: string;
    canEdit: boolean;
  };
  requestId?: string;
}

export interface UserPermissionState {
  socketId: string;
  username: string;
  userId: string;
  role: 'teacher' | 'student';
  canEdit: boolean;
  joinedAt?: string;
  lastActivity?: string;
}

export interface UpdateUserListEvent {
  users: UserPermissionState[];
  timestamp: string;
  triggeredBy: string;
}

export interface PermissionToggleState {
  [socketId: string]: boolean; // loading state for each user
}

export interface PermissionContextState {
  canEdit: boolean;
  isTeacher: boolean;
  users: UserPermissionState[];
  students: UserPermissionState[];
  loading: boolean;
  error: string | null;
}

export interface PermissionContextActions {
  setEditPermission: (targetSocketId: string, canEdit: boolean, callback?: (error?: any) => void) => void;
  grantEditPermission: (targetSocketId: string, callback?: (error?: any) => void) => void;
  revokeEditPermission: (targetSocketId: string, callback?: (error?: any) => void) => void;
  refreshPermissions: () => void;
  requestStudentList: () => void;
}

export type PermissionContext = PermissionContextState & PermissionContextActions;

// Socket event types for permissions
export interface PermissionSocketEvents {
  // Client to server
  'change-permission': (data: PermissionChangeEvent, callback?: (response: PermissionChangeResponse) => void) => void;
  'grant-edit-permission': (data: { roomId: string; targetSocketId: string }) => void;
  'revoke-edit-permission': (data: { roomId: string; targetSocketId: string }) => void;
  'request-student-list': (data: { roomId: string }) => void;

  // Server to client
  'permission-changed': (data: PermissionChangedEvent) => void;
  'update-user-list': (data: UpdateUserListEvent) => void;
  'permission-updated': (data: { canEdit: boolean }) => void;
  'edit-permission': (data: { canEdit: boolean }) => void;
}

// Monaco Editor permission update interface
export interface MonacoPermissionUpdate {
  readOnly: boolean;
  reason: 'permission-granted' | 'permission-revoked' | 'role-change';
  timestamp: string;
}

// Permission change request tracking
export interface PermissionRequest {
  id: string;
  targetSocketId: string;
  canEdit: boolean;
  timestamp: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
}
