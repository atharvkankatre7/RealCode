import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

// WebSocket URL: derive from backend URL unless explicitly provided
const BACKEND_HTTP = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5002";
const DEFAULT_WS = BACKEND_HTTP.replace(/^http(s?):\/\//, "ws$1://") + "/terminal";
const TERMINAL_WS_URL = process.env.NEXT_PUBLIC_TERMINAL_WS_URL || DEFAULT_WS;

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
  
  // Add mounted state to prevent operations after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Check if container is ready before initializing terminal
    if (!xtermRef.current) {
      console.warn('[Terminal] Container ref not ready');
      return;
    }

    // Check if container has valid dimensions
    const container = xtermRef.current;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn('[Terminal] Container has zero dimensions, retrying in 100ms...');
      // Retry after a short delay when dimensions are not ready
      const retryTimer = setTimeout(() => {
        if (xtermRef.current && xtermRef.current.offsetWidth > 0 && xtermRef.current.offsetHeight > 0) {
          // Re-trigger the effect
          console.log('[Terminal] Container dimensions ready, re-initializing...');
        }
      }, 100);
      
      return () => clearTimeout(retryTimer);
    }

    const term = new Terminal({
      theme: {
        background: "#0f172a", // slate-900 - matches app theme
        foreground: "#e2e8f0", // slate-200 - high contrast
        cursor: "#06b6d4", // cyan-500 - bright accent
        black: "#0f172a",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#f8fafc",
        brightBlack: "#475569",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#a78bfa",
        brightCyan: "#22d3ee",
        brightWhite: "#ffffff"
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', monospace",
      fontSize: window.innerWidth < 768 ? 13 : 15,
      cursorBlink: true,
      disableStdin: false,
      allowProposedApi: true,
      scrollback: 1000,
      convertEol: true,
      rightClickSelectsWord: true,
      // Enhanced terminal features
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Open terminal and fit it safely
    try {
      term.open(container);
      // Only fit if terminal is properly opened and container has dimensions
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit();
      }
    } catch (error) {
      console.error('[Terminal] Failed to open terminal:', error);
      return;
    }

    // WebSocket connection
    const ws = new WebSocket(TERMINAL_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      try {
        term.writeln("\x1b[1;36m╭─────────────────────────────────────────────╮\x1b[0m");
        term.writeln("\x1b[1;36m│\x1b[0m \x1b[1;32m✓ Connected to RealCode Terminal Server\x1b[0m \x1b[1;36m│\x1b[0m");
        term.writeln("\x1b[1;36m│\x1b[0m \x1b[1;33mType 'help' for available commands\x1b[0m \x1b[1;36m│\x1b[0m");
        term.writeln("\x1b[1;36m╰─────────────────────────────────────────────╯\x1b[0m");
        term.writeln("");
        term.writeln("\x1b[1;34m$\x1b[0m \x1b[1;37mReady to execute code...\x1b[0m");
      } catch (error) {
        console.warn('[Terminal] Failed to write connection message:', error);
      }
    };
    ws.onmessage = (event) => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
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
                try {
                  term.write(line + (index < lines.length - 1 ? '\r\n' : ''));
                } catch (error) {
                  console.warn('[Terminal] Failed to write line:', error);
                }
              }
            });
          } else {
            try {
              term.write(data);
            } catch (error) {
              console.warn('[Terminal] Failed to write data:', error);
            }
          }
        } else if (parsed.type === "prompt-waiting") {
          setIsWaitingForInput(parsed.data);
          if (parsed.data) {
            try {
              term.writeln("\r\n\x1b[1;33m[Waiting for input...]\x1b[0m");
            } catch (error) {
              console.warn('[Terminal] Failed to write prompt:', error);
            }
          }
        }
      } catch (e) {
        // Fallback to raw data handling
        const data = event.data;
        if (data.includes('\n')) {
          const lines = data.split('\n');
          lines.forEach((line: string, index: number) => {
            if (line.trim()) {
              try {
                term.write(line + (index < lines.length - 1 ? '\r\n' : ''));
              } catch (error) {
                console.warn('[Terminal] Failed to write fallback line:', error);
              }
            }
          });
        } else {
          try {
            term.write(data);
          } catch (error) {
            console.warn('[Terminal] Failed to write fallback data:', error);
          }
        }
      }
    };
    ws.onclose = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      try {
        term.writeln("\r\n\x1b[1;31m[Disconnected]\x1b[0m");
      } catch (error) {
        console.warn('[Terminal] Failed to write disconnection message:', error);
      }
    };
    ws.onerror = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      try {
        term.writeln("\r\n\x1b[1;31m[WebSocket error]\x1b[0m");
      } catch (error) {
        console.warn('[Terminal] Failed to write error message:', error);
      }
    };

    // Send terminal input to backend
    term.onData((data) => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      ws.readyState === 1 && ws.send(JSON.stringify({ type: "input", data }));
    });

    // Safe resize handling with dimension checks
    const handleResize = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      if (termRef.current && fitAddonRef.current && container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          fitAddonRef.current.fit();
        } catch (error) {
          console.warn('[Terminal] Resize failed:', error);
        }
      }
    };
    
    // Handle visibility change to prevent operations when tab is not visible
    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      if (document.hidden) {
        console.log('[Terminal] Tab hidden, pausing terminal operations');
      } else {
        console.log('[Terminal] Tab visible, resuming terminal operations');
        // Safe fit when tab becomes visible again
        setTimeout(() => {
          if (!isMountedRef.current) return; // Check again after timeout
          if (termRef.current && fitAddonRef.current && container.offsetWidth > 0 && container.offsetHeight > 0) {
            try {
              fitAddonRef.current.fit();
            } catch (error) {
              console.warn('[Terminal] Visibility change fit failed:', error);
            }
          }
        }, 100);
      }
    };
    
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Safe delayed fit with dimension check
    const delayedFit = () => {
      if (!isMountedRef.current) return; // Skip if component is unmounted
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          fitAddon.fit();
        } catch (error) {
          console.warn('[Terminal] Delayed fit failed:', error);
        }
      }
    };
    setTimeout(delayedFit, 100);

    // Add ResizeObserver to automatically fit terminal when container size changes
    const resizeObserver = new ResizeObserver((entries) => {
      if (!isMountedRef.current) return;
      
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Only fit if dimensions are valid and terminal is ready
        if (width > 100 && height > 100 && termRef.current && fitAddonRef.current) {
          try {
            // Longer delay for collapse/expand scenarios
            setTimeout(() => {
              if (isMountedRef.current && fitAddonRef.current && termRef.current) {
                try {
                  fitAddonRef.current.fit();
                  // Force a refresh of the terminal display
                  termRef.current.refresh(0, termRef.current.rows - 1);
                  console.log(`[Terminal] Auto-fitted to ${Math.floor(width)}x${Math.floor(height)}`);
                } catch (error) {
                  console.warn('[Terminal] Fit or refresh failed:', error);
                }
              }
            }, 150); // Increased delay for better reliability
          } catch (error) {
            console.warn('[Terminal] ResizeObserver fit failed:', error);
          }
        }
      }
    });

    // Start observing the terminal container
    resizeObserver.observe(container);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      // Disconnect ResizeObserver
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        try {
          termRef.current.dispose();
        } catch (error) {
          console.warn('[Terminal] Dispose error:', error);
        }
      }
      // Clear refs to prevent access after disposal
      termRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, []);

  // Add effect to handle terminal fitting when component becomes visible
  useEffect(() => {
    const handleTerminalRefit = () => {
      if (!isMountedRef.current) return;
      
      setTimeout(() => {
        if (xtermRef.current && termRef.current && fitAddonRef.current) {
          const container = xtermRef.current;
          if (container.offsetWidth > 100 && container.offsetHeight > 100) {
            try {
              fitAddonRef.current.fit();
              termRef.current.refresh(0, termRef.current.rows - 1);
              console.log('[Terminal] Re-fitted after visibility change');
            } catch (error) {
              console.warn('[Terminal] Refit failed:', error);
            }
          }
        }
      }, 200);
    };

    // Listen for custom refit events (triggered when terminal is reopened)
    window.addEventListener('resize', handleTerminalRefit);
    
    return () => {
      window.removeEventListener('resize', handleTerminalRefit);
    };
  }, []);

  // Send input to running process
  const sendInput = (input: string) => {
    if (!isMountedRef.current) return; // Skip if component is unmounted
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
    if (!isMountedRef.current) return; // Skip if component is unmounted
    if (e.key === 'Enter') {
      e.preventDefault();
      sendInput(inputValue);
    }
  };

  // Run code as command (when runCode changes)
  useEffect(() => {
    if (!isMountedRef.current) return; // Skip if component is unmounted
    if (runCode && wsRef.current?.readyState === 1) {
      // Show execution feedback in terminal
      if (termRef.current) {
        termRef.current.writeln("");
        termRef.current.writeln("\x1b[1;33m🚀 Executing code...\x1b[0m");
        termRef.current.writeln("\x1b[1;36m┌─────────────────────────────────────────────┐\x1b[0m");
        termRef.current.writeln("\x1b[1;36m│\x1b[0m \x1b[1;37mLanguage:\x1b[0m \x1b[1;32m" + language + "\x1b[0m");
        termRef.current.writeln("\x1b[1;36m│\x1b[0m \x1b[1;37mTimestamp:\x1b[0m \x1b[1;32m" + new Date().toLocaleTimeString() + "\x1b[0m");
        termRef.current.writeln("\x1b[1;36m└─────────────────────────────────────────────┘\x1b[0m");
        termRef.current.writeln("");
      }
      
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
      {/* Terminal Header with Controls */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-300">Terminal Output</h4>
        <div className="flex items-center gap-2">
          {/* Clear Terminal Button */}
          <button
            onClick={() => {
              if (termRef.current) {
                termRef.current.clear();
                termRef.current.writeln("\x1b[1;36m[Terminal cleared]\x1b[0m");
              }
            }}
            className="w-6 h-6 rounded-md bg-slate-700/50 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-all duration-200 flex items-center justify-center text-xs"
            title="Clear terminal"
            aria-label="Clear terminal"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div
        ref={xtermRef}
        className="rounded-xl border border-zinc-800 bg-[#0f172a] shadow-inner overflow-hidden w-full"
        style={{ 
          height: "100%", 
          minHeight: "200px",
          maxHeight: "100%"
        }}
      />
      
      {/* Dynamic Input Field */}
      {isWaitingForInput && (
        <div className="mt-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">→</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                if (!isMountedRef.current) return; // Skip if component is unmounted
                setInputValue(e.target.value);
              }}
              onKeyPress={handleInputKeyPress}
              placeholder="Enter input and press Enter..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
              autoFocus
            />
            <button
              onClick={() => {
                if (!isMountedRef.current) return; // Skip if component is unmounted
                sendInput(inputValue);
              }}
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
