"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import socketService from "../services/socketService"
import { Socket } from "socket.io-client"

interface RoomState {
  code: string;
  users: Array<{
    socketId: string;
    username: string;
    userId: string;
    role: string;
    canEdit: boolean;
  }>;
  permissions: {
    canEdit: boolean;
    roomPermission: boolean;
  };
  lastUpdated: string;
}

type SocketContextType = {
    isConnected: boolean;
    isReady: boolean;
    socket: Socket | null;
    roomState: RoomState | null;
    reconnect: () => void;
    requestRoomState: (roomId: string) => Promise<RoomState | null>;
    updateRoomState: (updates: Partial<RoomState>) => void;
    connectionAttempts: number;
    lastConnectionTime: Date | null;
}

const SocketContext = createContext<SocketContextType | null>(null)

export const useSocket = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error("useSocket must be used within SocketProvider")
    }
    return context
}

// Use an instance of SocketService
const socketServiceInstance = socketService.getInstance();

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const [lastConnectionTime, setLastConnectionTime] = useState<Date | null>(null);

    // Request room state from server
    const requestRoomState = useCallback(async (roomId: string): Promise<RoomState | null> => {
        if (!socketServiceInstance || !isConnected) {
            console.warn('🔌 [ROOM_STATE] Cannot request state - socket not connected');
            return null;
        }

        try {
            console.log(`📥 [ROOM_STATE] Requesting state for room ${roomId}`);

            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.warn('⏰ [ROOM_STATE] Request timeout');
                    resolve(null);
                }, 5000);

                const currentSocket = socketServiceInstance.getSocket();
                currentSocket?.emit('request-room-state', { roomId }, (response: any) => {
                    clearTimeout(timeout);

                    if (response?.success && response?.state) {
                        console.log('✅ [ROOM_STATE] Received room state:', response.state);
                        setRoomState(response.state);
                        resolve(response.state);
                    } else {
                        // Don't log as error for "Room not found" - this is normal for new rooms
                        if (response?.error && response.error.includes('Room not found')) {
                            console.log('ℹ️ [ROOM_STATE] Room not found - this is normal for new rooms:', response.error);
                        } else {
                            console.error('❌ [ROOM_STATE] Failed to get room state:', response?.error);
                        }
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            console.error('💥 [ROOM_STATE] Error requesting room state:', error);
            return null;
        }
    }, [isConnected]);

    // Update room state locally
    const updateRoomState = useCallback((updates: Partial<RoomState>) => {
        setRoomState(prev => {
            if (!prev) return null;

            const newState = {
                ...prev,
                ...updates,
                lastUpdated: new Date().toISOString()
            };

            console.log('🔄 [ROOM_STATE] Local state updated:', updates);
            return newState;
        });
    }, []);

    useEffect(() => {
        // Initialize socket connection
        const initSocket = () => {
            try {
                const newSocket = socketServiceInstance.connect();
                setSocket(newSocket);
            } catch (error) {
                console.error('Failed to initialize socket:', error);
            }
        };

        initSocket();

        // Handle connection status changes
        const handleConnect = () => {
            console.log('🔌 [SOCKET] Connected');
            setIsConnected(true);
            setIsReady(true);
            setLastConnectionTime(new Date());
            setConnectionAttempts(0);
        };

        const handleDisconnect = (reason: string) => {
            console.log('🔌 [SOCKET] Disconnected:', reason);
            setIsConnected(false);
            setIsReady(false);

            // Try to reconnect after a short delay
            setTimeout(() => {
                console.log("🔄 [SOCKET] Attempting to reconnect...");
                setConnectionAttempts(prev => prev + 1);
                initSocket();
            }, 3000);
        };

        const handleReconnect = () => {
            console.log('🔌 [SOCKET] Reconnected');
            setIsConnected(true);
            setIsReady(true);
            setLastConnectionTime(new Date());
            setConnectionAttempts(0);
        };

        const handleRoomStateUpdate = (data: any) => {
            console.log('📨 [ROOM_STATE] Received state update:', data);
            if (data?.state) {
                setRoomState(data.state);
            }
        };

        const currentSocket = socketServiceInstance.getSocket();
        if (currentSocket) {
            currentSocket.on("connect", handleConnect);
            currentSocket.on("disconnect", handleDisconnect);
            currentSocket.on("reconnect", handleReconnect);
            currentSocket.on("room-state-update", handleRoomStateUpdate);
        }

        // Check initial connection state
        if (socketServiceInstance.isConnected()) {
            setIsConnected(true);
            setIsReady(true);
            setLastConnectionTime(new Date());
        }

        // Cleanup on unmount
        return () => {
            if (currentSocket) {
                currentSocket.off("connect", handleConnect);
                currentSocket.off("disconnect", handleDisconnect);
                currentSocket.off("reconnect", handleReconnect);
                currentSocket.off("room-state-update", handleRoomStateUpdate);
            }
        };
    }, []);

    const reconnect = useCallback(() => {
        console.log('🔄 [SOCKET] Manual reconnection triggered');
        const newSocket = socketServiceInstance.connect();
        setSocket(newSocket);
    }, []);

    const value = {
        isConnected,
        isReady,
        socket: socketServiceInstance.getSocket(),
        roomState,
        reconnect,
        requestRoomState,
        updateRoomState,
        connectionAttempts,
        lastConnectionTime
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}
