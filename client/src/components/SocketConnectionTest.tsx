'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface ConnectionLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function SocketConnectionTest() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [transport, setTransport] = useState<string>('');

  const addLog = (message: string, type: ConnectionLog['type'] = 'info') => {
    const newLog: ConnectionLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testWebSocketConnection = () => {
    addLog('🌐 Testing WebSocket connection...', 'info');
    setConnectionStatus('connecting');

    if (socket) {
      socket.disconnect();
    }

    const SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
    
    const newSocket = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 15000,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      forceNew: true,
      withCredentials: false
    });

    setupSocketListeners(newSocket, 'WebSocket');
    setSocket(newSocket);
  };

  const testPollingConnection = () => {
    addLog('📡 Testing Polling connection...', 'info');
    setConnectionStatus('connecting');

    if (socket) {
      socket.disconnect();
    }

    const SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
    
    const newSocket = io(SERVER_URL, {
      transports: ['polling'],
      timeout: 30000,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      forceNew: true,
      withCredentials: false,
      upgrade: false
    });

    setupSocketListeners(newSocket, 'Polling');
    setSocket(newSocket);
  };

  const testMixedConnection = () => {
    addLog('🔄 Testing Mixed transports...', 'info');
    setConnectionStatus('connecting');

    if (socket) {
      socket.disconnect();
    }

    const SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
    
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      forceNew: true,
      withCredentials: false
    });

    setupSocketListeners(newSocket, 'Mixed');
    setSocket(newSocket);
  };

  const setupSocketListeners = (socketInstance: Socket, testType: string) => {
    socketInstance.on('connect', () => {
      addLog(`✅ ${testType} connection successful! Socket ID: ${socketInstance.id}`, 'success');
      addLog(`🔌 Transport: ${socketInstance.io.engine.transport.name}`, 'info');
      setConnectionStatus('connected');
      setTransport(socketInstance.io.engine.transport.name);

      // Test basic communication
      socketInstance.emit('test-message', { 
        message: `Hello from ${testType} test!`,
        timestamp: new Date().toISOString()
      });
    });

    socketInstance.on('disconnect', (reason) => {
      addLog(`❌ ${testType} disconnected: ${reason}`, 'error');
      setConnectionStatus('disconnected');
      setTransport('');
    });

    socketInstance.on('connect_error', (error) => {
      addLog(`🚨 ${testType} connection error: ${error.message}`, 'error');
      addLog(`Error details: ${JSON.stringify(error)}`, 'error');
      setConnectionStatus('error');
    });

    socketInstance.on('test-response', (data) => {
      addLog(`📨 Received test response: ${JSON.stringify(data)}`, 'success');
    });

    // Transport-specific events
    if (socketInstance.io) {
      socketInstance.io.on('error', (error) => {
        addLog(`🚨 Transport error: ${error}`, 'error');
      });

      socketInstance.io.on('reconnect_attempt', (attempt) => {
        addLog(`🔄 Reconnection attempt ${attempt}`, 'warning');
      });

      socketInstance.io.on('reconnect', (attemptNumber) => {
        addLog(`✅ Reconnected after ${attemptNumber} attempts`, 'success');
        setConnectionStatus('connected');
      });
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      addLog('👋 Manually disconnected', 'info');
    }
  };

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getLogColor = (type: ConnectionLog['type']) => {
    switch (type) {
      case 'success': return 'text-green-700 bg-green-50 border-l-green-500';
      case 'error': return 'text-red-700 bg-red-50 border-l-red-500';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-l-yellow-500';
      default: return 'text-blue-700 bg-blue-50 border-l-blue-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center mb-6">🔌 Socket.IO Connection Test</h1>
      
      {/* Status Display */}
      <div className={`p-4 rounded-lg mb-6 text-center font-semibold ${getStatusColor()}`}>
        Status: {connectionStatus.toUpperCase()}
        {transport && ` (${transport})`}
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={testWebSocketConnection}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
        >
          🌐 Test WebSocket
        </button>
        <button
          onClick={testPollingConnection}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
        >
          📡 Test Polling
        </button>
        <button
          onClick={testMixedConnection}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
        >
          🔄 Test Mixed
        </button>
        <button
          onClick={disconnect}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors"
        >
          ❌ Disconnect
        </button>
      </div>

      {/* Clear Logs Button */}
      <div className="mb-4">
        <button
          onClick={clearLogs}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
        >
          🧹 Clear Logs
        </button>
      </div>

      {/* Logs Display */}
      <div className="bg-gray-50 border rounded-lg p-4 h-96 overflow-y-auto">
        <h3 className="font-semibold mb-3">Connection Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500 italic">No logs yet. Click a test button to start.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-2 rounded border-l-4 text-sm ${getLogColor(log.type)}`}
              >
                <span className="font-mono text-xs text-gray-500">[{log.timestamp}]</span>{' '}
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Server Information:</h3>
        <p className="text-sm text-blue-700">
          <strong>URL:</strong> {process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002'}
        </p>
        <p className="text-sm text-blue-700">
          <strong>Available Transports:</strong> WebSocket, Polling
        </p>
      </div>
    </div>
  );
}
