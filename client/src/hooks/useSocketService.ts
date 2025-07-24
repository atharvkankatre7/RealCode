'use client';

import { useState, useEffect } from 'react';
import SocketService from '@/services/socketService';

export function useSocketService() {
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketService = SocketService.getInstance();

    const checkSocketService = () => {
      try {
        // Check if socketService exists and has required methods
        if (socketService && 
            typeof socketService.on === 'function' && 
            typeof socketService.off === 'function') {
          setIsReady(true);
          console.log('[useSocketService] isReady=true');
          // Check connection status
          if (typeof socketService.isConnected === 'function') {
            const connected = socketService.isConnected();
            setIsConnected(connected);
            console.log(`[useSocketService] isConnected=${connected}`);
          }
          console.log('Socket service is ready and available');
          return true;
        } else {
          setIsReady(false);
          setIsConnected(false);
          console.log('Socket service not ready yet...');
          return false;
        }
      } catch (error) {
        console.error('Error checking socket service:', error);
        setIsReady(false);
        setIsConnected(false);
        return false;
      }
    };

    // Check immediately
    const isInitiallyReady = checkSocketService();

    // If not ready, set up polling
    let interval: NodeJS.Timeout | null = null;
    if (!isInitiallyReady) {
      interval = setInterval(() => {
        const ready = checkSocketService();
        if (ready && interval) {
          clearInterval(interval);
          interval = null;
        }
      }, 1000);
    }

    // Set up connection status listeners if socket is ready
    if (isInitiallyReady && socketService) {
      const handleConnect = () => {
        console.log('[useSocketService] Socket connected');
        setIsConnected(true);
      };

      const handleDisconnect = () => {
        console.log('[useSocketService] Socket disconnected');
        setIsConnected(false);
      };

      try {
        socketService.on('connect', handleConnect);
        socketService.on('disconnect', handleDisconnect);
      } catch (error) {
        console.error('Error setting up connection listeners:', error);
      }

      // Cleanup function
      return () => {
        if (interval) {
          clearInterval(interval);
        }
        try {
          if (socketService) {
            socketService.off('connect', handleConnect);
            socketService.off('disconnect', handleDisconnect);
          }
        } catch (error) {
          console.error('Error cleaning up connection listeners:', error);
        }
      };
    }

    // Cleanup function for polling case
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  useEffect(() => {
    console.log(`[useSocketService] State changed: isReady=${isReady}, isConnected=${isConnected}`);
  }, [isReady, isConnected]);

  return {
    socketService: isReady && isConnected ? SocketService.getInstance() : null,
    isReady,
    isConnected
  };
}
