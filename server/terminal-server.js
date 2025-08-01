// terminal-server.js
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');

const PORT = 5002;

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`✅ Terminal WebSocket Server running on ws://localhost:${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('🔌 Client connected to terminal');

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: process.env,
  });

  ptyProcess.on('data', (data) => {
    ws.send(data);
  });

  ws.on('message', (msg) => {
    // Accept both raw string and JSON input
    try {
      const parsed = JSON.parse(msg);
      if (parsed && parsed.type === 'input' && typeof parsed.data === 'string') {
        ptyProcess.write(parsed.data);
        return;
      }
    } catch (e) {
      // Not JSON, treat as raw input
    }
    ptyProcess.write(msg);
  });

  ws.on('close', () => {
    ptyProcess.kill();
    console.log('❌ Client disconnected');
  });

  ws.on('error', (err) => {
    ptyProcess.kill();
    console.error('WebSocket error:', err);
  });
});