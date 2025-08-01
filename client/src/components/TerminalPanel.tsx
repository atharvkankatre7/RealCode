import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

// Use env variable for WebSocket URL
const TERMINAL_WS_URL = process.env.NEXT_PUBLIC_TERMINAL_WS_URL || "ws://localhost:5002";

type TerminalPanelProps = {
  runCode?: string;
  language?: string;
  input?: string;
  className?: string;
};

const TerminalPanel: React.FC<TerminalPanelProps> = ({
  runCode,
  language = "javascript",
  input = "",
  className = "",
}) => {
  const xtermRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const term = new Terminal({
      theme: {
        background: "#10131a",
        foreground: "#e5e7eb",
        cursor: "#3b82f6",
      },
      fontFamily: "Fira Mono, monospace",
      fontSize: 15,
      cursorBlink: true,
      disableStdin: false,
      allowProposedApi: true,
      scrollback: 1000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (xtermRef.current) {
      term.open(xtermRef.current);
      fitAddon.fit();
    }

    // WebSocket connection
    const ws = new WebSocket(TERMINAL_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln("\x1b[1;32m[Connected to terminal server]\x1b[0m");
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        
        if (parsed.type === "output") {
          // Handle output with proper line breaks
          const data = parsed.data;
          if (data.includes('\n')) {
            // Split by newlines and write each line separately
            const lines = data.split('\n');
            lines.forEach((line: string, index: number) => {
              if (line.trim()) {
                term.write(line + (index < lines.length - 1 ? '\r\n' : ''));
              }
            });
          } else {
            term.write(data);
          }
        } else if (parsed.type === "prompt-waiting") {
          setIsWaitingForInput(parsed.data);
          if (parsed.data) {
            term.writeln("\r\n\x1b[1;33m[Waiting for input...]\x1b[0m");
          }
        }
      } catch (e) {
        // Fallback to raw data handling
        const data = event.data;
        if (data.includes('\n')) {
          const lines = data.split('\n');
          lines.forEach((line: string, index: number) => {
            if (line.trim()) {
              term.write(line + (index < lines.length - 1 ? '\r\n' : ''));
            }
          });
        } else {
          term.write(data);
        }
      }
    };
    ws.onclose = () => {
      term.writeln("\r\n\x1b[1;31m[Disconnected]\x1b[0m");
    };
    ws.onerror = () => {
      term.writeln("\r\n\x1b[1;31m[WebSocket error]\x1b[0m");
    };

    // Send terminal input to backend
    term.onData((data) => {
      ws.readyState === 1 && ws.send(JSON.stringify({ type: "input", data }));
    });

    // Resize handling
    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);
    setTimeout(() => fitAddon.fit(), 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      ws.close();
      term.dispose();
    };
  }, []);

  // Send input to running process
  const sendInput = (input: string) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ 
        type: "send-input", 
        data: input 
      }));
      setInputValue("");
    }
  };

  // Handle Enter key in input field
  const handleInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendInput(inputValue);
    }
  };

  // Run code as command (when runCode changes)
  useEffect(() => {
    if (runCode && wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ 
        type: "run_code", 
        data: runCode,
        language: language,
        input: input
      }));
    }
  }, [runCode, language, input]);

  return (
    <div className={`${className}`}>
      <div
        ref={xtermRef}
        className="rounded-xl border border-zinc-800 bg-[#10131a] shadow-inner overflow-hidden"
        style={{ width: "100%", height: "300px", minHeight: 200 }}
      />
      
      {/* Dynamic Input Field */}
      {isWaitingForInput && (
        <div className="mt-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">→</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleInputKeyPress}
              placeholder="Enter input and press Enter..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
              autoFocus
            />
            <button
              onClick={() => sendInput(inputValue)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalPanel;