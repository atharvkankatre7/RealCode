// socket.d.ts

import { Server, Socket } from "socket.io"

// Extend the Socket types for custom events
declare module "socket.io" {
  interface ClientToServerEvents {
    "code-change": (data: { roomId: string; code: string }) => void
    "create-room": (data: { username: string }, callback: (res: { roomId: string }) => void) => void
    "join-room": (data: { roomId: string; username: string }, callback: (res: { error?: string }) => void) => void
    "typing": (data: { roomId: string; username: string }) => void
    "leave-room": (roomId: string) => void
    "highlight-line": (data: { roomId: string; startLine: number; endLine: number; comment?: string }) => void;
    "set-edit-permission": (data: { roomId: string; targetSocketId: string; canEdit: boolean }) => void;
    "grant-edit-permission": (data: { roomId: string; targetSocketId: string }) => void;
    "revoke-edit-permission": (data: { roomId: string; targetSocketId: string }) => void;
    "teacher-selection": (data: { roomId: string; selection: any }) => void;
    "clear-teacher-selection": (data: { roomId: string }) => void;
    "teacher-cursor-position": (data: { roomId: string; position: { lineNumber: number; column: number } }) => void;
    "teacher-text-highlight": (data: { roomId: string; selection: any }) => void;
    "clear-teacher-text-highlight": (data: { roomId: string }) => void;
    "sync-code": (data: { roomId: string; code: string; targetSocketId: string }) => void;
    "sync-teacher-selection": (data: { roomId: string; selection: any; targetSocketId: string }) => void;
    "sync-teacher-cursor": (data: { roomId: string; position: { lineNumber: number; column: number }; targetSocketId: string }) => void;
    "cursor-move": (data: { roomId: string; userId: string; position: { x: number; y: number } }) => void;
    "validate-room": (data: { roomId: string }, callback: (res: { exists: boolean }) => void) => void;
    "request-student-list": (data: { roomId: string }) => void;
    "change-permission": (data: { roomId: string; targetUserId?: string; targetSocketId?: string; canEdit: boolean; requestId?: string }, callback?: (response: { success: boolean; error?: string; targetUser?: any; requestId?: string }) => void) => void;
  }

  interface ServerToClientEvents {
    "code-update": (code: string) => void
    "user-typing": (data: { username: string }) => void
    "highlight-line": (data: { startLine: number; endLine: number; comment?: string }) => void;
    "edit-permission": (data: { canEdit: boolean }) => void;
    "permission-updated": (data: { canEdit: boolean }) => void;
    "update-student-list": (data: { students: Array<{ socketId: string; username: string; userId: string; email?: string; canEdit: boolean; joinedAt: string; lastActivity: string }> }) => void;
    "room-users-updated": (data: { users: Array<{ username: string; role: string; socketId: string; userId: string; canEdit: boolean }>; count: number }) => void;
    "teacher-selection": (data: { selection: any; teacherName: string; teacherId: string }) => void;
    "clear-teacher-selection": (data: { teacherName: string; teacherId: string }) => void;
    "teacher-cursor-position": (data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => void;
    "teacher-text-highlight": (data: { selection: any; teacherName: string; teacherId: string }) => void;
    "clear-teacher-text-highlight": (data: { teacherName: string; teacherId: string }) => void;
    "sync-code": (data: { code: string }) => void;
    "sync-teacher-selection": (data: { selection: any; teacherName: string; teacherId: string }) => void;
    "sync-teacher-cursor": (data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => void;
    "user-joined": (data: { newUserSocketId: string; newUserName: string; newUserId: string; newUserRole: string; allUsers: any[] }) => void;
    "user-left": (users: any[]) => void;
    "cursor-move": (data: { userId: string; position: { x: number; y: number } }) => void;
    "initial-code-received": (data: { code: string }) => void;
    "permission-changed": (data: { canEdit: boolean; userId: string; socketId: string; username?: string; changedBy?: string; timestamp?: string; requestId?: string }) => void;
    "update-user-list": (data: { users: Array<{ socketId: string; username: string; userId: string; role: string; canEdit: boolean }> }) => void;
    // Permission-related events
    'permission-changed': (data: { socketId: string; canEdit: boolean }) => void;
    'room-users-updated': (data: { users: User[]; count: number }) => void;
  }
}
