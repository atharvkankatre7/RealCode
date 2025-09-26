// client/src/services/socketService.ts
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Update event types to match backend payloads
// Add userId and username everywhere needed

type ServerToClientEvents = {
  'code-update': (payload: { code: string; fileId?: string }) => void;
  'user-typing': (data: { username: string; userId?: string }) => void;
  'user-joined': (users: Array<{ socketId: string; username: string; userId?: string; role: string }>) => void;
  'user-left': (users: Array<{ socketId: string; username: string; userId?: string }>) => void;
  'highlight-line': (data: { roomId: string; startLine: number; endLine: number; comment?: string }) => void;
  'cursor-move': (data: { userId: string; position: { x: number; y: number } }) => void; // Mouse cursor (screen) movement
  'caret-move': (data: { userId: string; position: { lineNumber: number; column: number } }) => void; // Text caret movement
  'room-users-updated': (data: { users: Array<any>, count?: number }) => void; // Add 'room-users-updated' to ServerToClientEvents
  'get-initial-code': (data: { requestingUserId: string; requestingUsername: string }) => void; // Request for initial code
  'initial-code-received': (data: { code: string }) => void; // Receive initial code
  'teacher-selection': (data: { selection: any; teacherName: string; teacherId: string }) => void; // Teacher text selection
  'clear-teacher-selection': (data: { teacherName: string; teacherId: string }) => void; // Clear teacher selection
  'teacher-cursor-position': (data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => void; // Teacher cursor position
  'teacher-text-highlight': (data: { selection: any; teacherName: string; teacherId: string }) => void; // Teacher text highlight
  'clear-teacher-text-highlight': (data: { teacherName: string; teacherId: string }) => void; // Clear teacher text highlight
  'sync-code': (data: { code: string }) => void; // Sync current code to new user
  'sync-teacher-selection': (data: { selection: any; teacherName: string; teacherId: string }) => void; // Sync current teacher selection to new user
  'sync-teacher-cursor': (data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => void; // Sync current teacher cursor to new user
  'code-change': (payload: { code: string; fileId?: string; userId: string; username: string; roomId: string; timestamp: number }) => void;
};

type ClientToServerEvents = {
  'create-room': (
    data: { username: string; roomId?: string; userId?: string },
    callback: (res: { roomId: string; username?: string; role?: string; users?: Array<{ socketId: string; username: string; userId?: string; role: string }>; error?: string }) => void
  ) => void;
  'join-room': (
    data: { roomId: string; username: string; userId?: string },
    callback: (res: {
      error?: string;
      success?: boolean;
      users?: Array<{ socketId: string; username: string; userId?: string; role: string }>;
      username?: string;
      role?: string;
    }) => void,
  ) => void,
  'code-change': (data: { roomId: string; code: string }) => void;
  'typing': (data: { roomId: string; username: string; userId?: string }) => void;
  'leave-room': (roomId: string) => void;
  'highlight-line': (data: { roomId: string; startLine: number; endLine: number; comment?: string }) => void;
  'cursor-move': (data: { roomId: string; userId: string; position: { x: number; y: number } }) => void;
  'caret-move': (data: { roomId: string; userId: string; position: { lineNumber: number; column: number } }) => void;
  'send-initial-code': (data: { roomId: string; code: string; requestingUserId: string }) => void;
  'teacher-selection': (data: { roomId: string; selection: any; teacherName?: string; teacherId?: string }) => void;
  'clear-teacher-selection': (data: { roomId: string }) => void;
  'teacher-cursor-position': (data: { roomId: string; position: { lineNumber: number; column: number }; teacherName?: string; teacherId?: string }) => void;
  'teacher-text-highlight': (data: { roomId: string; selection: any; teacherName?: string; teacherId?: string }) => void;
  'clear-teacher-text-highlight': (data: { roomId: string }) => void;
  'sync-code': (data: { roomId: string; code: string; targetSocketId: string }) => void; // Send current code to specific user
  'sync-teacher-selection': (data: { roomId: string; selection: any; targetSocketId: string }) => void; // Send current teacher selection to specific user
  'sync-teacher-cursor': (data: { roomId: string; position: { lineNumber: number; column: number }; targetSocketId: string }) => void; // Send current teacher cursor to specific user
  'validate-room': (
    data: { roomId: string },
    callback: (response: { exists: boolean }) => void
  ) => void;
  'set-edit-permission': (data: { roomId: string; targetSocketId: string; canEdit: boolean }) => void;
  'request-student-list': (data: { roomId: string }) => void;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// Create a singleton socket instance
class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private _isConnected: boolean = false;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this._isConnected && !!this.socket?.connected;
  }

  connect(): Socket {
    if (!this.socket) {
      console.log('🔌 Creating new socket connection...');
      this.socket = io(SOCKET_URL, {
        // Try polling first, then upgrade to WebSocket (more robust in diverse dev environments)
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        autoConnect: true,
        forceNew: true,
        upgrade: true, // Allow upgrading to websocket after initial connection
        // Better reconnection settings
        reconnection: true,
        maxReconnectionAttempts: 10,
        reconnectionDelayMax: 5000
      } as any); // Type assertion to allow custom Socket.IO options

      this.setupSocketEventHandlers();
    } else if (!this.socket.connected) {
      console.log('Socket exists but not connected, attempting to reconnect...');
      try {
        this.socket.connect();
      } catch (error) {
        console.error('Error reconnecting socket:', error);
        // Create a new socket instance if reconnection fails
        this.socket.close();
        this.socket = null;
        return this.connect();
      }
    }

    if (!this.socket) {
      throw new Error('Failed to initialize socket');
    }

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      try {
        // Clean up keepalive interval if it exists
        if ((this.socket as any).keepaliveInterval) {
          clearInterval((this.socket as any).keepaliveInterval);
        }
        // Clean up health check interval if it exists
        if ((this.socket as any).healthCheckInterval) {
          clearInterval((this.socket as any).healthCheckInterval);
        }
        this.socket.disconnect();
      } catch (error) {
        console.error('Error disconnecting socket:', error);
      }
      this.socket = null;
      this._isConnected = false;
    }
  }

  // Keepalive mechanism to prevent connection timeouts
  private startKeepalive(): void {
    if (!this.socket) return;
    
    const keepaliveInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        // Send a ping event to keep the connection alive
        this.socket.emit('ping');
        console.log('💓 [KEEPALIVE] Sent ping to server');
      } else {
        clearInterval(keepaliveInterval);
      }
    }, 25000); // Send ping every 25 seconds (before server's 30-second timeout)
    
    // Store the interval ID for cleanup
    (this.socket as any).keepaliveInterval = keepaliveInterval;
  }

  // Check connection health and reconnect if needed
  private checkConnectionHealth(): void {
    if (!this.socket) return;
    
    const healthCheckInterval = setInterval(() => {
      if (this.socket && !this.socket.connected) {
        console.log('⚠️ [HEALTH] Socket disconnected, attempting to reconnect...');
        clearInterval(healthCheckInterval);
        this.connect();
      }
    }, 5000); // Check every 5 seconds
    
    // Store the interval ID for cleanup
    (this.socket as any).healthCheckInterval = healthCheckInterval;
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this._isConnected = true;
      this.emitEvent('connect', undefined);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this._isConnected = false;
      this.emitEvent('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this._isConnected = false;
      this.emitEvent('connect_error', error);

      // If WebSocket fails, try falling back to polling
      if (this.socket?.io?.engine?.transport?.name === 'websocket') {
        console.log('⚠️ WebSocket failed, falling back to polling...');
        this.socket.io.opts.transports = ['polling'];
        this.socket.connect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.emitEvent('error', error);
    });

    // Add keepalive mechanism to prevent timeouts
    this.socket.on('connect', () => {
      // Start keepalive ping every 25 seconds (before server's 30-second timeout)
      this.startKeepalive();
      // Start connection health monitoring
      this.checkConnectionHealth();
    });

    // Handle pong response from server
    this.socket.on('pong', () => {
      console.log('💓 [KEEPALIVE] Received pong from server');
    });

    // Set up all the socket event listeners for real-time features
    this.socket.on('code-update', (code: string) => {
      this.emitEvent('code-update', code);
    });

    this.socket.on('user-typing', (data: { username: string; userId?: string }) => {
      this.emitEvent('user-typing', data);
    });

    this.socket.on('user-joined', (data: any) => {
      this.emitEvent('user-joined', data);
    });

    this.socket.on('user-left', (data: any) => {
      this.emitEvent('user-left', data);
    });

    this.socket.on('room-users-updated', (data: any) => {
      this.emitEvent('room-users-updated', data);
    });

    this.socket.on('get-initial-code', (data: any) => {
      this.emitEvent('get-initial-code', data);
    });

    this.socket.on('initial-code-received', (data: { code: string }) => {
      this.emitEvent('initial-code-received', data);
    });

    this.socket.on('teacher-selection', (data: any) => {
      this.emitEvent('teacher-selection', data);
    });

    this.socket.on('clear-teacher-selection', (data: any) => {
      this.emitEvent('clear-teacher-selection', data);
    });

    this.socket.on('teacher-cursor-position', (data: any) => {
      this.emitEvent('teacher-cursor-position', data);
    });

    this.socket.on('teacher-text-highlight', (data: any) => {
      this.emitEvent('teacher-text-highlight', data);
    });

    this.socket.on('clear-teacher-text-highlight', (data: any) => {
      this.emitEvent('clear-teacher-text-highlight', data);
    });

    this.socket.on('sync-code', (data: any) => {
      this.emitEvent('sync-code', data);
    });

    this.socket.on('sync-teacher-selection', (data: any) => {
      this.emitEvent('sync-teacher-selection', data);
    });

    this.socket.on('sync-teacher-cursor', (data: any) => {
      this.emitEvent('sync-teacher-cursor', data);
    });

    this.socket.on('cursor-move', (data: any) => {
      this.emitEvent('cursor-move', data);
    });

    this.socket.on('caret-move', (data: any) => {
      console.log('📥 [CARET] Socket service received caret-move:', data);
      this.emitEvent('caret-move', data);
    });

    // Permission-related events
    this.socket.on('permission-changed', (data: any) => {
      console.log('🎯 SocketService received permission-changed:', data);
      this.emitEvent('permission-changed', data);
    });

    this.socket.on('update-user-list', (data: any) => {
      console.log('🎯 SocketService received update-user-list:', data);
      this.emitEvent('update-user-list', data);
    });

    this.socket.on('permission-updated', (data: { canEdit: boolean }) => {
      console.log('🎯 SocketService received permission-updated:', data);
      this.emitEvent('permission-updated', data);
    });

    this.socket.on('edit-permission', (data: { canEdit: boolean }) => {
      console.log('🎯 SocketService received edit-permission:', data);
      this.emitEvent('edit-permission', data);
    });

    this.socket.on('update-student-list', (data: any) => {
      console.log('🎯 SocketService received update-student-list:', data);
      this.emitEvent('update-student-list', data);
    });

    // Initial permission state on join/reload
    this.socket.on('initial-permission-state', (data: any) => {
      console.log('🎯 SocketService received initial-permission-state:', data);
      this.emitEvent('initial-permission-state', data);
    });

    // RBAC: Room permission changed event
    this.socket.on('room-permission-changed', (data: any) => {
      console.log('🎯 [RBAC] Room permission changed:', data);
      this.emitEvent('room-permission-changed', data);
    });

    // Real-time code change event (works in view-only mode)
    this.socket.on('code-change', (data: any) => {
      console.log('🔄 [SYNC] Real-time code change received:', data);
      this.emitEvent('code-change', data);
    });

    // User count update event for real-time sync
    this.socket.on('user-count-update', (data: any) => {
      console.log('👥 [USER_COUNT] User count update received:', data);
      this.emitEvent('user-count-update', data);
    });
  }

  // Add event listener
  public on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  // Remove event listener
  public off(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  // Emit event to listeners
  private emitEvent(event: string, data: any) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      if (typeof callback === 'function') {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    });
  }

  // Try alternative transport method if WebSocket fails
  private tryAlternativeTransport(): void {
    try {
      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
      }

      // Create new socket with both transports but prioritize polling
      this.socket = io(SOCKET_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['polling', 'websocket'], // Try polling first, then websocket
        autoConnect: true,
        forceNew: true,
        upgrade: true, // Allow upgrading to websocket after initial connection
      });

      this.setupSocketEventHandlers();
    } catch (error) {
      console.error('Error setting up alternative transport:', error);
    }
  }

  // Create a new room
  public createRoom(username: string, roomId?: string): Promise<{ roomId: string, username: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        return reject(new Error('Socket not connected'));
      }

      // Generate a unique userId if not already stored
      let userId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') : null;
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('userId', userId);
        }
      }

      this.socket.emit('create-room', { username, roomId, userId }, (response: { roomId: string; username?: string; role?: string; users?: Array<{ socketId: string; username: string; userId?: string; role: string }>; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          // If the server validated and possibly changed the username, update it locally
          if (response.username && response.username !== username) {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('username', response.username);
            }
          }

          resolve({
            roomId: response.roomId,
            username: response.username || username
          });
        }
      });
    });
  }

  // Join an existing room with fallback to HTTP if socket fails
  public joinRoom(roomId: string, username: string, providedUserId?: string): Promise<{ users: Array<{ userId: string, username: string, isCurrentUser: boolean }>, username: string, role?: string }> {
    return new Promise(async (resolve, reject) => {
      // Use provided userId or generate/retrieve from localStorage
      let userId: string = providedUserId || '';
      if (!userId) {
        const storedUserId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') : null;
        if (storedUserId) {
          userId = storedUserId;
        } else {
          userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('userId', userId);
          }
        }
      } else {
        // Store provided userId in localStorage for persistence
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('userId', userId);
        }
      }

      // Check if we have a socket connection
      if (!this.socket || !this.isConnected()) {
        // Try to connect
        this.connect();

        // Wait a bit to see if connection succeeds
        await new Promise(r => setTimeout(r, 2000));

        // If still not connected, use HTTP fallback
        if (!this.isConnected()) {
          return this.joinRoomViaHttp(roomId, username, userId, resolve, reject);
        }
      }

      // If we reach here, we have a socket connection, so use it
      try {
        if (!this.socket) {
          throw new Error('Socket is null');
        }
        // Emit join-room with userId, username, and roomId
        this.socket.emit('join-room', { roomId, username, userId }, (response: {
          error?: string;
          success?: boolean;
          users?: Array<{ socketId: string; username: string; userId?: string; role: string }>;
          username?: string;
          role?: string;
        }) => {
          if (response.error) {
          // If socket join fails, try HTTP fallback
          this.joinRoomViaHttp(roomId, username, userId, resolve, reject);
        } else if (response.success) {
            // If the server validated and possibly changed the username, update it locally
            if (response.username && response.username !== username) {
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('username', response.username);
              }
            }

            // Mark the current user in the users list
            const usersWithCurrentFlag = (response.users || []).map((user: { userId?: string; username: string; socketId: string }) => ({
              ...user,
              userId: user.userId || '',
              isCurrentUser: (user.userId || '') === userId
            }));

            resolve({
              users: usersWithCurrentFlag || [],
              username: response.username || username,
              role: response.role
            });
          } else {
            // If socket join fails, try HTTP fallback
            this.joinRoomViaHttp(roomId, username, userId, resolve, reject);
          }
        });

        // Set a timeout in case the callback never fires
        setTimeout(() => {
          // If we haven't resolved or rejected yet, try HTTP fallback
          this.joinRoomViaHttp(roomId, username, userId, resolve, reject);
        }, 5000);
      } catch (error) {
        // If socket join throws an exception, try HTTP fallback
        this.joinRoomViaHttp(roomId, username, userId, resolve, reject);
      }
    });
  }

  // HTTP fallback for joining a room when socket fails
  private joinRoomViaHttp(
    roomId: string,
    username: string,
    userId: string,
    resolve: (value: { users: Array<{ userId: string, username: string, isCurrentUser: boolean }>, username: string, role?: string }) => void,
    reject: (reason: Error) => void
  ) {
    // Use axios to make a direct HTTP request to the server
    const apiUrl = `${SOCKET_URL}/api/join-room`;

    axios.post(apiUrl, { roomId, username, userId })
      .then(response => {
        if (response.data.error) {
          reject(new Error(response.data.error));
        } else {
          // If the server validated and possibly changed the username, update it locally
          if (response.data.username && response.data.username !== username) {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('username', response.data.username);
            }
          }

          // Create a default user list with at least the current user
          const users = response.data.users || [{
            userId,
            username: response.data.username || username,
            socketId: 'http-fallback'
          }];

          // Fix: When mapping users, always provide a fallback for userId (empty string if undefined)
          const usersWithCurrentFlag = users.map((user: { userId?: string; username: string; socketId: string }) => ({
            ...user,
            userId: user.userId || '',
            isCurrentUser: (user.userId || '') === userId
          }));

          resolve({
            users: usersWithCurrentFlag,
            username: response.data.username || username,
            role: response.data.role
          });

          // Try to reconnect socket after successful HTTP fallback
          setTimeout(() => this.connect(), 1000);
        }
      })
      .catch(error => {
        // If HTTP fallback also fails, create a minimal response with just the current user
        const fallbackUser = {
          userId,
          username,
          isCurrentUser: true
        };

        // Resolve with just the current user to allow the UI to function
        resolve({
          users: [fallbackUser],
          username,
          role: 'student' // Default role for fallback
        });

        // Try to reconnect socket after error
        setTimeout(() => this.connect(), 2000);
      });
  }

  // Send code changes to the server with HTTP fallback
  public sendCodeChange(roomId: string, fileId: string, code: string) {
    if (this.socket && this.isConnected()) {
      try {
        this.socket.volatile.emit('code-change', { roomId, fileId, code });
        return true;
      } catch (error) {}
    } else {
      console.warn('Socket not connected, falling back to HTTP for code change.');
    }
    this.sendCodeChangeViaHttp(roomId, code); // Fallback does not support fileId yet
    return true;
  }

  // Send initial code to a requesting user
  public sendInitialCode(roomId: string, code: string, requestingUserId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot send initial code');
      return false;
    }

    try {
      this.socket.emit('send-initial-code', { roomId, code, requestingUserId });
      console.log(`Sent initial code to user ${requestingUserId} in room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error sending initial code:', error);
      return false;
    }
  }

  // Send teacher text selection to students
  public sendTeacherSelection(roomId: string, selection: any) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot send teacher selection');
      return false;
    }

    try {
      // Get teacherName and teacherId from localStorage
      const teacherName = typeof window !== 'undefined' ? window.localStorage.getItem('username') || 'Unknown' : 'Unknown';
      const teacherId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || this.socket?.id || 'unknown' : this.socket?.id || 'unknown';
      this.socket.emit('teacher-selection', { roomId, selection, teacherName, teacherId });
      console.log(`Sent teacher selection to room ${roomId}:`, selection);
      return true;
    } catch (error) {
      console.error('Error sending teacher selection:', error);
      return false;
    }
  }

  // Send teacher cursor position to students
  public sendTeacherCursorPosition(roomId: string, position: { lineNumber: number; column: number }) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot send teacher cursor position');
      return false;
    }

    try {
      const teacherName = typeof window !== 'undefined' ? window.localStorage.getItem('username') || 'Unknown' : 'Unknown';
      const teacherId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || this.socket?.id || 'unknown' : this.socket?.id || 'unknown';
      this.socket.emit('teacher-cursor-position', { roomId, position, teacherName, teacherId });
      return true;
    } catch (error) {
      console.error('Error sending teacher cursor position:', error);
      return false;
    }
  }

  // Send teacher text highlight to students
  public sendTeacherTextHighlight(roomId: string, selection: any) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot send teacher text highlight');
      return false;
    }

    try {
      const teacherName = typeof window !== 'undefined' ? window.localStorage.getItem('username') || 'Unknown' : 'Unknown';
      const teacherId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || this.socket?.id || 'unknown' : this.socket?.id || 'unknown';
      this.socket.emit('teacher-text-highlight', { roomId, selection, teacherName, teacherId });
      return true;
    } catch (error) {
      console.error('Error sending teacher text highlight:', error);
      return false;
    }
  }

  // Clear teacher text selection
  public clearTeacherSelection(roomId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot clear teacher selection');
      return false;
    }

    try {
      this.socket.emit('clear-teacher-selection', { roomId });
      console.log(`Cleared teacher selection in room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error clearing teacher selection:', error);
      return false;
    }
  }

  // Clear teacher text highlight
  public clearTeacherTextHighlight(roomId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot clear teacher text highlight');
      return false;
    }

    try {
      this.socket.emit('clear-teacher-text-highlight', { roomId });
      return true;
    } catch (error) {
      console.error('Error clearing teacher text highlight:', error);
      return false;
    }
  }

  // Sync current code to a specific user
  public syncCodeToUser(roomId: string, code: string, targetSocketId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot sync code to user');
      return false;
    }

    try {
      this.socket.emit('sync-code', { roomId, code, targetSocketId });
      console.log(`Synced code to user ${targetSocketId} in room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error syncing code to user:', error);
      return false;
    }
  }

  // Sync current teacher selection to a specific user
  public syncTeacherSelectionToUser(roomId: string, selection: any, targetSocketId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot sync teacher selection to user');
      return false;
    }

    try {
      this.socket.emit('sync-teacher-selection', { roomId, selection, targetSocketId });
      console.log(`Synced teacher selection to user ${targetSocketId} in room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error syncing teacher selection to user:', error);
      return false;
    }
  }

  // Sync current teacher cursor to a specific user
  public syncTeacherCursorToUser(roomId: string, position: { lineNumber: number; column: number }, targetSocketId: string) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot sync teacher cursor to user');
      return false;
    }

    try {
      this.socket.emit('sync-teacher-cursor', { roomId, position, targetSocketId });
      console.log(`Synced teacher cursor to user ${targetSocketId} in room ${roomId}`);
      return true;
    } catch (error) {
      console.error('Error syncing teacher cursor to user:', error);
      return false;
    }
  }

  // Set edit permission for a user (teacher only)
  public setEditPermission(roomId: string, targetSocketId: string, canEdit: boolean) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot set edit permission');
      return false;
    }

    try {
      this.socket.emit('set-edit-permission', { roomId, targetSocketId, canEdit });
      console.log(`Set edit permission for ${targetSocketId} in room ${roomId}: ${canEdit}`);
      return true;
    } catch (error) {
      console.error('Error setting edit permission:', error);
      return false;
    }
  }

  // Grant edit permission with ACK callback
  public grantEditPermission(roomId: string, targetSocketId: string, callback?: (response: any) => void) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot grant edit permission');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return false;
    }

    try {
      console.log(`📤 [SOCKET_GRANT] Emitting grant-edit-permission:`, { roomId, targetSocketId });

      this.socket.emit('grant-edit-permission', { roomId, targetSocketId }, (response: any) => {
        console.log(`📨 [SOCKET_GRANT] Server response:`, response);
        if (callback) callback(response);
      });

      return true;
    } catch (error) {
      console.error('❌ [SOCKET_GRANT] Error granting edit permission:', error);
      if (callback) callback({ success: false, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Revoke edit permission with ACK callback
  public revokeEditPermission(roomId: string, targetSocketId: string, callback?: (response: any) => void) {
    if (!this.socket || !this.isConnected()) {
      console.warn('Socket not connected, cannot revoke edit permission');
      if (callback) callback({ success: false, error: 'Socket not connected' });
      return false;
    }

    try {
      console.log(`📤 [SOCKET_REVOKE] Emitting revoke-edit-permission:`, { roomId, targetSocketId });

      this.socket.emit('revoke-edit-permission', { roomId, targetSocketId }, (response: any) => {
        console.log(`📨 [SOCKET_REVOKE] Server response:`, response);
        if (callback) callback(response);
      });

      return true;
    } catch (error) {
      console.error('❌ [SOCKET_REVOKE] Error revoking edit permission:', error);
      if (callback) callback({ success: false, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Enhanced change permission with server confirmation
  public changePermission(
    roomId: string,
    canEdit: boolean,
    targetUserId?: string,
    targetSocketId?: string,
    callback?: (error?: any, response?: any) => void
  ) {
    if (!this.socket || !this.isConnected()) {
      const error = 'Socket not connected, cannot change permission';
      console.warn(`❌ [SOCKET] ${error}`);
      if (callback) callback(error);
      return false;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      roomId,
      targetUserId,
      targetSocketId,
      canEdit,
      requestId
    };

    try {
      console.log(`📤 [SOCKET] Emitting change-permission with confirmation:`, payload);

      // Use emit with acknowledgment callback for server confirmation
      (this.socket as any).emit('change-permission', payload, (response: any) => {
        console.log(`📨 [SOCKET] Received change-permission response:`, response);

        if (response && response.success) {
          console.log(`✅ [SOCKET] Permission change confirmed:`, {
            targetUser: response.targetUser,
            requestId: response.requestId
          });
          if (callback) callback(null, response);
        } else {
          const error = response?.error || 'Unknown server error';
          console.error(`❌ [SOCKET] Permission change failed:`, error);
          if (callback) callback(error, response);
        }
      });

      return true;
    } catch (error) {
      console.error('❌ [SOCKET] Error emitting change-permission:', error);
      if (callback) callback(error);
      return false;
    }
  }

  setupPermissionHandlers() {
    if (!this.socket) return;

    this.socket.on('permission-changed', (data) => {
      console.log('📥 [SOCKET] Permission changed event received:', data);
      // Event will be handled by EditPermissionContext
    });

    this.socket.on('room-users-updated', (data) => {
      console.log('📥 [SOCKET] Room users updated:', data);
      // Event will be handled by EditPermissionContext
    });
  }

  onConnect(callback: () => void): void {
    if (!this.socket) {
      throw new Error('Socket is not initialized');
    }
    this.socket.on('connect', callback);
  }

  leaveRoom(roomId: string): void {
    if (!this.socket) {
      throw new Error('Socket is not initialized');
    }
    this.socket.emit('leave-room', roomId);
  }

  sendTyping(roomId: string, username: string): void {
    if (!this.socket) {
      throw new Error('Socket is not initialized');
    }
    const userId = typeof window !== 'undefined' ? window.localStorage.getItem('userId') || undefined : undefined;
    this.socket.emit('typing', { roomId, userId });
  }

  sendCursorMove(roomId: string, userId: string, position: { x: number; y: number }): void {
    if (this.socket?.connected) {
      this.socket.emit('cursor-move', { roomId, userId, position });
    }
  }

  sendCaretMove(roomId: string, userId: string, position: { lineNumber: number; column: number }): void {
    if (this.socket?.connected) {
      console.log('📤 [CARET] Sending caret-move:', { roomId, userId, position });
      this.socket.emit('caret-move', { roomId, userId, position });
    } else {
      console.warn('⚠️ [CARET] Socket not connected, cannot send caret-move');
    }
  }

  // Validate if a room exists
  public validateRoom(roomId: string): Promise<{ exists: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        return reject(new Error('Socket not connected'));
      }

      try {
        this.socket.emit('validate-room', { roomId }, (response: { exists: boolean }) => {
          console.log(`Room validation result for ${roomId}:`, response);
          resolve(response);
        });
      } catch (error) {
        console.error('Error validating room:', error);
        reject(error);
      }
    });
  }

  private initSocket(): void {
    console.log('🔌 Initializing new socket connection...');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this._isConnected = true;
      this.emitEvent('connect', undefined);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this._isConnected = false;
      this.emitEvent('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this._isConnected = false;
      this.emitEvent('connect_error', error);
    });
  }

  // HTTP fallback for sending code changes
  private sendCodeChangeViaHttp(roomId: string, code: string): void {
    // Use axios to make a direct HTTP request to the server
    const apiUrl = `${SOCKET_URL}/api/code-change`;

    axios.post(apiUrl, { roomId, code })
      .then(response => {
        if (response.data.error) {
          console.error('HTTP fallback error:', response.data.error);
        } else {
          console.log('Code change sent via HTTP fallback');
        }
      })
      .catch(error => {
        console.error('HTTP fallback failed:', error);
        // Try to reconnect socket after error
        setTimeout(() => this.connect(), 2000);
      });
  }
}

// Export the class itself instead of calling getInstance during export
export default SocketService;
