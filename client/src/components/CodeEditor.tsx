"use client"

import React, { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react"
import Editor from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import { motion, AnimatePresence } from "framer-motion"
import { FiUsers, FiCopy, FiCode, FiPlay, FiLoader, FiAlignLeft, FiDownload, FiUpload, FiSearch, FiSun, FiMoon, FiHelpCircle } from "react-icons/fi"
import SocketService from "../services/socketService"
import { throttle } from "lodash"
import { useSocket } from "../context/SocketContext"
import axios from "axios"
import { formatCode } from "../utils/formatCode"
import { useRouter } from "next/navigation"
import { useTheme } from "../context/ThemeContext"
import { useEditPermission } from "../context/EditPermissionContext"
import { UserInfo } from "./UserRole"
import TeacherCursor from "./TeacherCursor"
import UserListPanel from './UserListPanel';
import { useAuth } from "@/context/AuthContext"

interface CodeEditorProps {
  roomId: string
  username: string
  onExecutionResult: (result: { output: string | null; error: string | null }) => void;
  onActiveUsersChange: (users: string[]) => void;
  options?: any; // Add this line for Monaco options
  language?: string; // Controlled language from parent/context
}

export interface CodeEditorRef {
  executeCode: () => void;
  copyCode: () => void;
  formatCurrentCode: () => void;
  setLanguage: (lang: string) => void;
  getValue: () => string;
  setValue: (code: string) => void;
  saveCode: () => void;
}

const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(({ roomId, username: initialUsername, onExecutionResult, onActiveUsersChange, options, language: controlledLanguage }, ref) => {
  const {
    socket,
    isConnected,
    isReady: socketReady,
    roomState,
    requestRoomState,
    updateRoomState
  } = useSocket()
  const { canEdit, isTeacher, setIsTeacher } = useEditPermission()
  const { user } = useAuth();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [code, setCode] = useState<string>("// Start coding...")
  const [autoSaveInterval, setAutoSaveInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const latestCodeRef = useRef<string>("")
  const isRemoteUpdate = useRef(false)
  // Track timestamp of latest local keystroke to ignore stale echoes
  const lastLocalEditRef = useRef<number>(0)

  const storedUsername = typeof window !== 'undefined' ? localStorage.getItem("username") : null
  const [username, setUsername] = useState(storedUsername || initialUsername)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeUsers, setActiveUsers] = useState<string[]>([])
  const [language, setLanguage] = useState("javascript")

  const [isExecuting, setIsExecuting] = useState(false)

  const [runtimes, setRuntimes] = useState<Array<{
    language: string;
    version: string;
    aliases: string[];
    runtime?: string;
  }>>([]);
  const [runtimesLoaded, setRuntimesLoaded] = useState(false);

  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const socketService = SocketService.getInstance();
  const router = useRouter();

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  // --- Multi-file support: Track current fileId ---
  const [fileId, setFileId] = useState('main'); // Default file
  // TODO: Add UI for file selection and file explorer, update fileId as needed

  useEffect(() => {
    if (isTeacher) {
      setIsTeacher(true);
    }
  }, [isTeacher, setIsTeacher]);

  const handleLeaveRoom = () => {
    socketService.leaveRoom(roomId);
    router.push("/dashboard");
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('teacher-highlighting-css')) {
      const style = document.createElement('style');
      style.id = 'teacher-highlighting-css';
      style.innerHTML = `
        .teacher-selection-highlight {
          background: rgba(255, 230, 80, 0.5) !important;
          border-bottom: 2px solid orange !important;
          border-radius: 2px;
        }
        .teacher-cursor-highlight {
          border-left: 2px solid orange !important;
          margin-left: -1px;
          animation: teacher-cursor-blink 1s steps(2, start) infinite;
        }
        @keyframes teacher-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const teacherSelectionDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const teacherCursorDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const [teacherCursorPosition, setTeacherCursorPosition] = useState<{
    lineNumber: number;
    column: number;
    teacherName: string;
  } | null>(null);

  const [currentTeacherSelection, setCurrentTeacherSelection] = useState<any>(null)
  const [currentTeacherCursor, setCurrentTeacherCursor] = useState<{ lineNumber: number; column: number } | null>(null)

  useEffect(() => {
    console.log('[DEBUG][CodeEditor] canEdit:', canEdit, 'isTeacher:', isTeacher);
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const shouldBeReadOnly = !canEdit && !isTeacher;
    editor.updateOptions({
      readOnly: shouldBeReadOnly,
      contextmenu: !shouldBeReadOnly,
      quickSuggestions: !shouldBeReadOnly,
      parameterHints: { enabled: !shouldBeReadOnly },
      suggestOnTriggerCharacters: !shouldBeReadOnly,
      acceptSuggestionOnEnter: shouldBeReadOnly ? 'off' : 'on',
      tabCompletion: shouldBeReadOnly ? 'off' : 'on',
      wordBasedSuggestions: shouldBeReadOnly ? 'off' : 'allDocuments',
      renderLineHighlight: shouldBeReadOnly ? 'none' : 'line',
      cursorStyle: shouldBeReadOnly ? 'line-thin' : 'line',
      dragAndDrop: !shouldBeReadOnly
    });
    console.log('[DEBUG][CodeEditor] Monaco readOnly set to:', shouldBeReadOnly, 'actual:', editor.getOption && editor.getOption(monaco.editor.EditorOption.readOnly));
    const editorElement = editor.getDomNode();
    if (editorElement) {
      if (shouldBeReadOnly) {
        editorElement.style.opacity = '0.8';
        editorElement.style.cursor = 'not-allowed';
        editorElement.title = '👁️ View-only mode';
        editorElement.classList.add('read-only-editor');
      } else {
        editorElement.style.opacity = '1';
        editorElement.style.cursor = 'text';
        editorElement.title = '✏️ Edit mode';
        editorElement.classList.remove('read-only-editor');
      }
    }
  }, [canEdit, isTeacher, editorRef.current]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    setIsLoading(false);
  };

  // Sync language from parent/context
  useEffect(() => {
    if (controlledLanguage && controlledLanguage !== language) {
      setLanguage(controlledLanguage);
      // Optionally, also update the model language immediately for better UX
      if (editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          const monacoLang = controlledLanguage;
          try { monaco.editor.setModelLanguage(model, monacoLang); } catch {}
        }
      }
    }
  }, [controlledLanguage]);

  // Throttled sender to reduce network & prevent echo loops
  const throttledSendCode = useRef(
    throttle((codeText: string) => {
      socketService.sendCodeChange(roomId, fileId, codeText); // Pass fileId
    }, 200)
  ).current;

  // Throttled typing notifier (500 ms) – for "user is typing" indicator
  const throttledSendTyping = useRef(
    throttle(() => {
      socketService.sendTyping(roomId, username);
    }, 500)
  ).current;

  const handleEditorChange = (value?: string) => {
    if (value === undefined || isRemoteUpdate.current) return;
    latestCodeRef.current = value;
    lastLocalEditRef.current = Date.now();
    // 🚫 do NOT call setCode here – avoids React re-render & cursor jump
    throttledSendCode(value);
    throttledSendTyping();
  };
  
  useImperativeHandle(ref, () => ({
    executeCode,
    copyCode,
    formatCurrentCode,
    setLanguage,
    getValue: () => latestCodeRef.current || "",
    setValue: (code: string) => {
      if (editorRef.current) {
        isRemoteUpdate.current = true;
        try {
          const wasReadOnly = editorRef.current.getOptions().get(monaco.editor.EditorOption.readOnly);
          if (wasReadOnly) editorRef.current.updateOptions({ readOnly: false });
          
          editorRef.current.setValue(code);
          setCode(code);
          latestCodeRef.current = code;
          
          if (wasReadOnly) editorRef.current.updateOptions({ readOnly: true });
        } finally {
          isRemoteUpdate.current = false;
        }
      }
    },
    saveCode: () => {
      if (editorRef.current && canEdit) {
        const currentCode = editorRef.current.getValue();
        triggerManualSave(currentCode);
      }
    }
  }));

  const copyCode = () => {
     if (navigator.clipboard && latestCodeRef.current) {
       navigator.clipboard.writeText(latestCodeRef.current)
         .then(() => {
            // Can show a toast notification here
         })
         .catch(err => {
           console.error('Failed to copy code: ', err)
         })
     }
   }

  const formatCurrentCode = () => {
     const raw = latestCodeRef.current;
     if (!raw || !editorRef.current) return;
 
     try {
       const formattedCode = formatCode(raw, language);
 
       if (formattedCode !== raw) {
         editorRef.current.setValue(formattedCode);
         latestCodeRef.current = formattedCode;
         throttledSendCode(formattedCode);
       }
     } catch (error) {
       console.error('Error formatting code:', error);
     }
  }
  const fetchRuntimes = async () => {
     try {
       const response = await axios.get('https://emkc.org/api/v2/piston/runtimes');
       setRuntimes(response.data);
       setRuntimesLoaded(true);
       return { success: true, data: response.data };
     } catch (error) {
       console.error('Error fetching Piston API runtimes:', error);
       return {
         success: false,
         error: axios.isAxiosError(error)
           ? `${error.message} - ${error.response?.status || 'Unknown'} ${error.response?.statusText || ''}`
           : String(error)
       };
     }
   };
 
  const checkPistonAPI = async () => {
     if (!runtimesLoaded) {
       return await fetchRuntimes();
     }
     if (runtimes.length > 0) {
       return { success: true, data: runtimes };
     }
     return await fetchRuntimes();
   };

  // Execute code using Piston API
  const executeCode = async () => {
    const codeToExec = latestCodeRef.current;
    if (!codeToExec || isExecuting) return

    // Map Monaco editor language to Piston API language
    const languageMap: Record<string, string> = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python3",
      python3: "python3",
      java: "java",
      csharp: "csharp",
      c: "c",
      cpp: "cpp",
      go: "go",
      ruby: "ruby",
      rust: "rust",
      php: "php"
    }

    // Get the mapped language
    const pistonLanguage = languageMap[language] || language

    // Check if we have runtimes loaded
    if (!runtimesLoaded || runtimes.length === 0) {
      onExecutionResult({ output: null, error: 'Runtimes not loaded yet. Please try again in a moment.'});
      return
    }

    // Find available runtimes for the selected language
    const availableRuntimes = runtimes.filter(runtime =>
      runtime.language === pistonLanguage ||
      (runtime.aliases && runtime.aliases.includes(pistonLanguage))
    )

    // Check if the language is supported
    if (availableRuntimes.length === 0) {
      // Get a list of supported languages from the runtimes
      const supportedLanguages = [...new Set(runtimes.flatMap(runtime =>
        [runtime.language, ...(runtime.aliases || [])]
      ))].sort()

      onExecutionResult({ output: null, error: `The language '${language}' (mapped to '${pistonLanguage}') is not supported by the Piston API.\n\n` + `Supported languages: ${supportedLanguages.join(', ')}`});
      return
    }

    // Get the latest version of the runtime
    const selectedRuntime = availableRuntimes[0]

    try {
      setIsExecuting(true)
      onExecutionResult({ output: null, error: null });

      // First check if the API is available
      const apiStatus = await checkPistonAPI();
      if (!apiStatus.success) {
        onExecutionResult({ output: null, error: `API Check Failed: ${apiStatus.error}\nThe Piston API might be down or unreachable.`});
        return;
      }

      // Determine file extension based on language
      let fileExtension = '';
      if (selectedRuntime.language === 'python3' || selectedRuntime.language === 'python') fileExtension = '.py';
      else if (selectedRuntime.language === 'javascript') fileExtension = '.js';
      else if (selectedRuntime.language === 'typescript') fileExtension = '.ts';
      else if (selectedRuntime.language === 'java') fileExtension = '.java';
      else if (selectedRuntime.language === 'csharp') fileExtension = '.cs';
      else if (selectedRuntime.language === 'c') fileExtension = '.c';
      else if (selectedRuntime.language === 'cpp') fileExtension = '.cpp';
      else if (selectedRuntime.language === 'go') fileExtension = '.go';
      else if (selectedRuntime.language === 'rust') fileExtension = '.rs';
      else if (selectedRuntime.language === 'ruby') fileExtension = '.rb';
      else if (selectedRuntime.language === 'php') fileExtension = '.php';
      else fileExtension = `.${selectedRuntime.language}`;

      // console.log(`Selected runtime: ${selectedRuntime.language} ${selectedRuntime.version}`);

      // Prepare the payload according to Piston API documentation
      const payload = {
        language: selectedRuntime.language,
        version: selectedRuntime.version,
        files: [{
          name: `main${fileExtension}`,
          content: codeToExec
        }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000
      };

      // Log the payload for debugging
      // console.log(`Executing ${pistonLanguage} code with payload:`, JSON.stringify(payload, null, 2));

      // Make the API request
      const response = await axios.post('https://emkc.org/api/v2/piston/execute', payload);

      // console.log('Execution response:', response.data);

      const result = response.data;

      if (result.run) {
        // Format the output
        let output = '';
        let hasOutput = false;

        // Add compile output if available (for compiled languages)
        if (result.compile && result.compile.stderr) {
          output += `Compilation output:\n${result.compile.stderr}\n\n`;
          hasOutput = true;
        }

        // Add standard output
        if (result.run.stdout) {
          output += result.run.stdout;
          hasOutput = true;
        }

        // Add error output
        if (result.run.stderr) {
          if (hasOutput) output += '\n';
          output += `Error output:\n${result.run.stderr}`;
          hasOutput = true;
        }

        // Add exit code if non-zero
        if (result.run.code !== 0) {
          if (hasOutput) output += '\n';
          output += `\nProcess exited with code ${result.run.code}`;
          hasOutput = true;
        }

        if (!hasOutput) {
          output = 'Program executed successfully with no output.';
        }

        onExecutionResult({ output, error: null });
      } else {
        onExecutionResult({ output: null, error: 'Failed to execute code. No run data returned.' });
      }
    } catch (error) {
      // console.error('Error executing code:', error)
      let errorMsg = 'An unknown error occurred while executing the code.';
      // Handle Axios errors with more detailed information
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status
        const responseData = error.response.data

        // console.error('API Error Details:', {
        //   status: statusCode,
        //   data: responseData
        // })

        // Format a more helpful error message
        if (statusCode === 400) {
          errorMsg = `API Error (400 Bad Request): ${JSON.stringify(responseData)}\n\n` + 'This usually means the API request format is incorrect. ' + 'Please check the console for more details.'
        } else if (statusCode === 429) {
          errorMsg = 'Rate limit exceeded. Please try again later.'
        } else {
          errorMsg = `API Error (${statusCode}): ${JSON.stringify(responseData)}\n\n` + 'Please check the console for more details.'
        }
      } else if (error instanceof Error) {
        errorMsg = `Error: ${error.message}`
      }
      onExecutionResult({ output: null, error: errorMsg });
    } finally {
      setIsExecuting(false)
    }
  }

  // --- Handle code-update (legacy and new) ---
  const handleCodeUpdate = useCallback((payload: string | { code: string; fileId?: string }) => {
    let incomingCode: string;
    let incomingFileId: string = 'main';
    if (typeof payload === 'string') {
      incomingCode = payload;
    } else {
      incomingCode = payload.code;
      if (payload.fileId) incomingFileId = payload.fileId;
    }
    // Only update if this is for the current file
    if (incomingFileId !== fileId) return;
    if (Date.now() - lastLocalEditRef.current < 400) return;
    setIsLoading(false);
    if (incomingCode !== latestCodeRef.current) {
      try {
        isRemoteUpdate.current = true;
        if (editorRef.current) {
          const wasReadOnly = editorRef.current.getOptions().get(monaco.editor.EditorOption.readOnly);
          if (wasReadOnly) editorRef.current.updateOptions({ readOnly: false });
          const model = editorRef.current.getModel();
          if (model) {
            const currentPosition = editorRef.current.getPosition();
            const currentSelection = editorRef.current.getSelection();
            editorRef.current.executeEdits('remote', [
              { range: model.getFullModelRange(), text: incomingCode, forceMoveMarkers: true }
            ]);
            if (currentPosition) editorRef.current.setPosition(currentPosition);
            if (currentSelection) editorRef.current.setSelection(currentSelection);
            setCode(incomingCode);
            latestCodeRef.current = incomingCode;
          }
          if (wasReadOnly) editorRef.current.updateOptions({ readOnly: true });
        } else {
          setCode(incomingCode);
          latestCodeRef.current = incomingCode;
        }
      } finally {
        isRemoteUpdate.current = false;
      }
    }
  }, [fileId]);

  // --- Handle real-time code changes from other users (multi-file) ---
  const handleRealTimeCodeChange = useCallback((data: {
    code: string;
    fileId?: string;
    userId: string;
    username: string;
    roomId: string;
    timestamp: number;
  }) => {
    const currentUserId = localStorage.getItem('userId');
    if (data.userId === currentUserId) return;
    const incomingFileId = data.fileId || 'main';
    if (incomingFileId !== fileId) return;
    if (data.code !== latestCodeRef.current && editorRef.current) {
      const wasReadOnly = editorRef.current.getOptions().get(monaco.editor.EditorOption.readOnly);
      if (wasReadOnly) editorRef.current.updateOptions({ readOnly: false });
      isRemoteUpdate.current = true;
      try {
        const model = editorRef.current.getModel();
        if (model) {
          const currentPosition = editorRef.current.getPosition();
          const currentSelection = editorRef.current.getSelection();
          editorRef.current.executeEdits('real-time-sync', [
            { range: model.getFullModelRange(), text: data.code, forceMoveMarkers: true }
          ]);
          if (currentPosition) editorRef.current.setPosition(currentPosition);
          if (currentSelection) editorRef.current.setSelection(currentSelection);
          setCode(data.code);
          latestCodeRef.current = data.code;
        }
      } finally {
        if (wasReadOnly) editorRef.current.updateOptions({ readOnly: true });
        isRemoteUpdate.current = false;
      }
    }
  }, [fileId]);

  // Room state synchronization on connection/reconnection
  useEffect(() => {
    const syncRoomState = async () => {
      if (isConnected && socketReady && roomId) {
        try {
          const state = await requestRoomState(roomId);
          if (state) {
            // console.log('✅ [ROOM_SYNC] Room state received, applying updates');

            // Update code if different and preserve cursor position
            if (state.code && state.code !== latestCodeRef.current && editorRef.current) {
              const currentPosition = editorRef.current.getPosition();
              const currentSelection = editorRef.current.getSelection();

              // Set flag to prevent infinite loops
              isRemoteUpdate.current = true;

              try {
                const model = editorRef.current.getModel();
                if (model) {
                  editorRef.current.executeEdits('room-sync', [
                    {
                      range: model.getFullModelRange(),
                      text: state.code,
                      forceMoveMarkers: true
                    }
                  ]);

                  // Restore cursor position
                  if (currentPosition) {
                    editorRef.current.setPosition(currentPosition);
                  }
                  if (currentSelection) {
                    editorRef.current.setSelection(currentSelection);
                  }

                  setCode(state.code);
                  latestCodeRef.current = state.code;
                  // console.log('🔄 [ROOM_SYNC] Code synchronized successfully');
                }
              } finally {
                isRemoteUpdate.current = false;
              }
            }

            // Update user list
            if (state.users && Array.isArray(state.users)) {
              const currentUserId = localStorage.getItem('userId');
              const usernames = state.users.map((user: any) => {
                const isCurrentUser = user.userId === currentUserId;
                return isCurrentUser ? `${user.username} (you)` : user.username;
              });
              onActiveUsersChange(usernames);
              // console.log('🔄 [ROOM_SYNC] User list synchronized');
            }
          }
        } catch (error) {
          // console.error('❌ [ROOM_SYNC] Failed to sync room state:', error);
        }
      }
    };

    // Only sync on initial connection or when roomId/socket changes
    if (isConnected && socketReady && roomId) {
      syncRoomState();
    }
    // eslint-disable-next-line
  }, [isConnected, socketReady, roomId]);

  



  // Fetch runtimes when component mounts
  useEffect(() => {
    fetchRuntimes();
  }, []);

  // Enable Monaco diagnostics for JS/TS (basic)
  useEffect(() => {
    try {
      // Use TypeScript defaults to enable semantic/syntax validation
      // @ts-ignore
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
      // @ts-ignore
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
      // Provide basic lib (optional)
      // @ts-ignore
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ checkJs: true });
    } catch {}
  }, []);

  // Handle request for initial code from new users
  const handleGetInitialCode = useCallback((data: { requestingUserId: string; requestingUsername: string }) => {
    // console.log(`Received request for initial code from ${data.requestingUsername} (${data.requestingUserId})`);

    // Only respond if we have code and we're connected
    if (roomId && latestCodeRef.current && latestCodeRef.current.trim() !== "// Start coding...") {
      const socketServiceInstance = SocketService.getInstance();
      // console.log(`Sending initial code to ${data.requestingUsername}, length: ${latestCodeRef.current.length}`);
      socketServiceInstance.sendInitialCode(roomId, latestCodeRef.current, data.requestingUserId);
    } else {
      // console.log(`Not sending initial code - no meaningful code to share or not in room`);
    }
  }, [roomId]);

  // Handle receiving initial code as a new user (always apply for sync)
  const handleInitialCodeReceived = useCallback((data: { code: string }) => {
    // console.log(`Received initial code, length: ${data.code.length}`);

    // Always apply initial code to ensure sync (regardless of current content)
    // console.log("Applying received initial code for sync");

    // Set the flag to indicate this is a remote update
    isRemoteUpdate.current = true;

    try {
      // Update the editor if it's mounted
      if (editorRef.current) {
        // Store current read-only state
        const wasReadOnly = editorRef.current.getOptions().get(monaco.editor.EditorOption.readOnly);

        // Temporarily disable read-only to allow content update
        if (wasReadOnly) {
          editorRef.current.updateOptions({ readOnly: false });
        }

        // Update editor content
        editorRef.current.setValue(data.code);

        // Restore read-only state
        if (wasReadOnly) {
          editorRef.current.updateOptions({ readOnly: true });
        }
      }

      // Update the code state and ref
      setCode(data.code);
      latestCodeRef.current = data.code;
    } catch (error) {
      // console.error('Error applying initial code:', error);
    } finally {
      isRemoteUpdate.current = false;
    }
  }, []);

  // Handle teacher selection highlighting
  const handleTeacherSelection = useCallback((data: { selection: any; teacherName: string; teacherId: string }) => {
    // console.log(`Received teacher selection from ${data.teacherName}:`, data.selection);

    // Extra debug: check if CSS class is present
    if (typeof window !== 'undefined') {
      const styleExists = !!document.querySelector('style#teacher-highlighting-css') || !!Array.from(document.styleSheets).find(sheet => {
        try {
          return Array.from(sheet.cssRules).some(rule => (rule as CSSStyleRule).selectorText?.includes('.teacher-selection-highlight'));
        } catch { return false; }
      });
      if (!styleExists) {
        // console.warn('⚠️ teacher-selection-highlight CSS missing, injecting fallback');
        const style = document.createElement('style');
        style.id = 'teacher-highlighting-css-fallback';
        style.innerHTML = `
          .teacher-selection-highlight {
            background: rgba(255, 230, 80, 0.7) !important;
            border-bottom: 2px solid orange !important;
            border-radius: 2px;
          }
        `;
        document.head.appendChild(style);
      }
    }

    if (!editorRef.current || isTeacher) {
      // console.log('Skipping teacher highlight: editor not available or user is teacher');
      return; // Don't show teacher highlights to the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model || !data.selection) {
        // console.log('No model or selection');
        return;
      }

      // Convert selection to Monaco range
      const range = new monaco.Range(
        data.selection.startLineNumber,
        data.selection.startColumn,
        data.selection.endLineNumber,
        data.selection.endColumn
      );
      // console.log('Applying teacher selection highlight with range:', range);

      // Clear previous teacher selection decorations and apply new ones with yellow/orange styling
      if (!teacherSelectionDecorationsRef.current) {
        teacherSelectionDecorationsRef.current = editor.createDecorationsCollection();
      }

      teacherSelectionDecorationsRef.current.set([
        {
          range: range,
          options: {
            className: 'teacher-selection-highlight', // Yellow background with orange border
            hoverMessage: {
              value: `🎯 Teacher ${data.teacherName} selected this text\n\nRange: Line ${data.selection.startLineNumber}-${data.selection.endLineNumber}`
            },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            overviewRuler: {
              color: 'rgba(255, 152, 0, 0.8)', // Orange in overview ruler
              position: monaco.editor.OverviewRulerLane.Right
            }
          }
        }
      ]);
      // console.log('New teacher selection decorations applied');

      // Debug: Check DOM for highlight
      setTimeout(() => {
        const elements = document.querySelectorAll('.teacher-selection-highlight');
        // console.log('DOM .teacher-selection-highlight count:', elements.length);
        elements.forEach((el, i) => {
          // console.log(`Highlight ${i}:`, el, el.className, el.getAttribute('style'));
        });
      }, 200);
    } catch (error) {
      // console.error('Error applying teacher selection:', error);
    }
  }, [isTeacher]);

  // Handle clearing teacher selection
  const handleClearTeacherSelection = useCallback((data: { teacherName: string; teacherId: string }) => {
    // console.log(`Teacher ${data.teacherName} cleared selection`);

    if (!editorRef.current || isTeacher) {
      return; // Don't clear for the teacher themselves
    }

    try {
      // Clear all teacher selection decorations
      if (teacherSelectionDecorationsRef.current) {
        teacherSelectionDecorationsRef.current.clear();
      }
    } catch (error) {
      // console.error('Error clearing teacher selection:', error);
    }
  }, [isTeacher]);

  // Handle teacher cursor position updates with blinking orange cursor decoration
  const handleTeacherCursorPosition = useCallback((data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => {
    // console.log(`🎯 Teacher ${data.teacherName} cursor at line ${data.position.lineNumber}, column ${data.position.column}`);

    if (!editorRef.current || isTeacher) {
      return; // Don't show cursor to the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model) {
        // console.log('⏭️ Skipping teacher cursor: model not available');
        return;
      }

      // Validate cursor position bounds
      const lineCount = model.getLineCount();
      if (data.position.lineNumber > lineCount || data.position.lineNumber <= 0) {
        // console.log('⏭️ Skipping teacher cursor: position out of bounds');
        return;
      }

      // Create a range for the cursor position (single character width)
      const cursorRange = new monaco.Range(
        data.position.lineNumber,
        data.position.column,
        data.position.lineNumber,
        data.position.column + 1
      );

      // Clear previous teacher cursor decorations and apply new one
      if (!teacherCursorDecorationsRef.current) {
        teacherCursorDecorationsRef.current = editor.createDecorationsCollection();
      }

      teacherCursorDecorationsRef.current.set([
        {
          range: cursorRange,
          options: {
            className: 'teacher-cursor', // Blinking orange cursor
            hoverMessage: {
              value: `🎯 Teacher ${data.teacherName} cursor position\n\nLine ${data.position.lineNumber}, Column ${data.position.column}`
            },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            overviewRuler: {
              color: 'rgba(255, 152, 0, 0.8)', // Orange in overview ruler
              position: monaco.editor.OverviewRulerLane.Left
            }
          }
        }
      ]);
      // Set the teacher cursor position for overlay rendering
      setTeacherCursorPosition({
        lineNumber: data.position.lineNumber,
        column: data.position.column,
        teacherName: data.teacherName
      });
    } catch (error) {
      // console.error('❌ Error handling teacher cursor position:', error);
    }
  }, [isTeacher]);

  

  // Handle teacher text highlight with enhanced error handling and multiple CSS class fallbacks
  const handleTeacherTextHighlight = useCallback((data: { selection: any; teacherName: string; teacherId: string }) => {
    // console.log(`🎨 Teacher ${data.teacherName} highlighted text:`, data.selection);
    // console.log(`🔍 Debug info:`, {
    //   editorAvailable: !!editorRef.current,
    //   userRole: userRole,
    //   roomId: roomId,
    //   currentDecorations: teacherSelectionDecorationsRef.current ? 'collection exists' : 'no collection',
    //   monacoAvailable: typeof monaco !== 'undefined'
    // });

    if (!editorRef.current || isTeacher) {
      // console.log('⏭️ Skipping teacher text highlight: editor not available or user is teacher');
      return; // Don't show highlights to the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model) {
        // console.error('❌ Monaco Editor model not available');
        return;
      }

      if (!data.selection) {
        // console.error('❌ Selection data is missing');
        return;
      }

      // Validate selection data with more robust checking
      const { startLineNumber, startColumn, endLineNumber, endColumn } = data.selection;

      if (
        typeof startLineNumber !== 'number' || startLineNumber <= 0 ||
        typeof startColumn !== 'number' || startColumn <= 0 ||
        typeof endLineNumber !== 'number' || endLineNumber <= 0 ||
        typeof endColumn !== 'number' || endColumn <= 0
      ) {
        // console.error('❌ Invalid selection data:', data.selection);
        return;
      }

      // Ensure the selection is within the model bounds
      const lineCount = model.getLineCount();
      if (startLineNumber > lineCount || endLineNumber > lineCount) {
        // console.warn('⚠️ Selection extends beyond model bounds, adjusting...');
        const adjustedEndLine = Math.min(endLineNumber, lineCount);
        const adjustedEndColumn = adjustedEndLine === lineCount ? 
          model.getLineMaxColumn(adjustedEndLine) : endColumn;

        // console.log(`Adjusted selection: (${startLineNumber}, ${startColumn}, ${adjustedEndLine}, ${adjustedEndColumn})`);
      }

      // console.log(`✅ Creating Monaco Range: (${startLineNumber}, ${startColumn}, ${endLineNumber}, ${endColumn})`);

      // Convert selection to Monaco range
      const range = new monaco.Range(
        startLineNumber,
        startColumn,
        endLineNumber,
        endColumn
      );

      // console.log('✅ Monaco Range created successfully:', range);

      // Apply decoration with multiple CSS class options and inline styles for better compatibility
      // console.log('🎨 Applying teacher text highlight decoration...');
      const decorationOptions = {
        range: range,
        options: {
          className: 'teacher-highlight teacher-text-highlight', // Multiple classes for fallback
          hoverMessage: {
            value: `🎯 Teacher ${data.teacherName} highlighted this text\n\nClick to focus on this selection`
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          // Add inline styles as fallback
          inlineClassName: 'teacher-highlight-inline',
          // Force inline styles for maximum compatibility
          overviewRuler: {
            color: 'rgba(59, 130, 246, 0.8)',
            position: monaco.editor.OverviewRulerLane.Right
          },
          // Add background color directly
          backgroundColor: 'rgba(59, 130, 246, 0.25)',
          // Add border styling
          border: '2px solid rgba(59, 130, 246, 0.7)'
        }
      };

      // Clear previous decorations and apply new ones
      if (!teacherSelectionDecorationsRef.current) {
        teacherSelectionDecorationsRef.current = editor.createDecorationsCollection();
      }

      teacherSelectionDecorationsRef.current.set([decorationOptions]);

      // console.log('✅ Teacher text highlight decorations applied');
      // console.log('🔍 Decoration details:', decorationOptions);

      // Debug: Check if decorations are actually in the DOM
      setTimeout(() => {
        const decorationElements = document.querySelectorAll('.teacher-text-highlight, .teacher-highlight');
        // console.log('🔍 Found decoration elements in DOM:', decorationElements.length);
        decorationElements.forEach((el, index) => {
          // console.log(`🔍 Decoration ${index + 1}:`, {
          //   element: el,
          //   className: el.className,
          //   style: el.getAttribute('style'),
          //   computedStyle: window.getComputedStyle(el).background
          // });
        });

        // Also check Monaco's internal decorations
        const allDecorations = editor.getModel()?.getAllDecorations();
        // console.log('🔍 All Monaco decorations:', allDecorations?.length);
        const teacherDecorations = allDecorations?.filter((d:any) =>
          d.options.className?.includes('teacher-highlight') ||
          d.options.className?.includes('teacher-text-highlight')
        );
        // console.log('🔍 Teacher decorations in model:', teacherDecorations);
      }, 200);

      // Force a layout update to ensure the decoration is visible
      setTimeout(() => {
        editor.layout();
        // console.log('🔄 Editor layout refreshed');
      }, 100);

    } catch (error) {
      // console.error('❌ Error applying teacher text highlight:', error);
      // console.error('🔍 Error details:', {
      //   editorAvailable: !!editorRef.current,
      //   modelAvailable: !!editorRef.current?.getModel(),
      //   selectionData: data.selection,
      //   userRole: userRole,
      //   monacoAvailable: typeof monaco !== 'undefined',
      //   currentDecorations: teacherSelectionDecorationsRef.current ? 'collection exists' : 'no collection'
      // });
    }
  }, [isTeacher]);

  // Handle clearing teacher text highlight with enhanced logging
  const handleClearTeacherTextHighlight = useCallback((data: { teacherName: string; teacherId: string }) => {
    // console.log(`🧹 Teacher ${data.teacherName} cleared text highlight`);
    // console.log(`🔍 Clear debug info:`, {
    //   editorAvailable: !!editorRef.current,
    //   userRole: userRole,
    //   roomId: roomId,
    //   currentDecorations: teacherSelectionDecorationsRef.current ? 'collection exists' : 'no collection',
    //   monacoAvailable: typeof monaco !== 'undefined'
    // });

    if (!editorRef.current || isTeacher) {
      // console.log('⏭️ Skipping clear teacher text highlight: editor not available or user is teacher');
      return; // Don't clear for the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model) {
        // console.error('❌ Monaco Editor model not available for clearing highlights');
        return;
      }

      // console.log('🧹 Clearing teacher text highlight decorations...');

      // Clear all teacher text highlight decorations
      if (teacherSelectionDecorationsRef.current) {
        teacherSelectionDecorationsRef.current.clear();
        // console.log('✅ Teacher text highlight decorations cleared');
      }

      // Force a layout update to ensure the decorations are removed
      setTimeout(() => {
        editor.layout();
        // console.log('🔄 Editor layout refreshed after clearing highlights');
      }, 50);

    } catch (error) {
      // console.error('❌ Error clearing teacher text highlight:', error);
      // console.error('🔍 Error details:', {
      //   editorAvailable: !!editorRef.current,
      //   modelAvailable: !!editorRef.current?.getModel(),
      //   userRole: userRole,
      //   currentDecorations: teacherSelectionDecorationsRef.current ? 'collection exists' : 'no collection',
      //   monacoAvailable: typeof monaco !== 'undefined'
      // });
    }
  }, [isTeacher]);

  // Handle sync events for newly joined users
  const handleSyncCode = useCallback((data: { code: string }) => {
    // console.log('🔄 Received sync-code event:', data);

    if (!editorRef.current) {
      // console.log('⏭️ Skipping sync-code: editor not available');
      return;
    }

    try {
      // Set the editor value directly
      editorRef.current.setValue(data.code);
      setCode(data.code);
      latestCodeRef.current = data.code;
      // console.log('✅ Code synced successfully');
    } catch (error) {
      // console.error('❌ Error syncing code:', error);
    }
  }, []);

  const handleSyncTeacherSelection = useCallback((data: { selection: any; teacherName: string; teacherId: string }) => {
    // console.log('🔄 Received sync-teacher-selection event:', data);

    if (!editorRef.current || isTeacher) {
      return; // Don't show highlights to the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model || !data.selection) {
        return;
      }

      // Convert selection to Monaco range
      const range = new monaco.Range(
        data.selection.startLineNumber,
        data.selection.startColumn,
        data.selection.endLineNumber,
        data.selection.endColumn
      );

      // Apply teacher selection decoration
      if (!teacherSelectionDecorationsRef.current) {
        teacherSelectionDecorationsRef.current = editor.createDecorationsCollection();
      }

      teacherSelectionDecorationsRef.current.set([
        {
          range: range,
          options: {
            className: 'teacher-selection-highlight',
            hoverMessage: {
              value: `🎯 Teacher ${data.teacherName} selected this text (synced)\n\nRange: Line ${data.selection.startLineNumber}-${data.selection.endLineNumber}`
            },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            overviewRuler: {
              color: 'rgba(255, 152, 0, 0.8)',
              position: monaco.editor.OverviewRulerLane.Right
            }
          }
        }
      ]);
      // console.log('✅ Teacher selection synced successfully');
    } catch (error) {
      // console.error('❌ Error syncing teacher selection:', error);
    }
  }, [isTeacher]);

  const handleSyncTeacherCursor = useCallback((data: { position: { lineNumber: number; column: number }; teacherName: string; teacherId: string }) => {
    // console.log('🔄 Received sync-teacher-cursor event:', data);

    if (!editorRef.current || isTeacher) {
      return; // Don't show cursor to the teacher themselves
    }

    try {
      const editor = editorRef.current;
      const model = editor.getModel();

      if (!model) {
        return;
      }

      // Create a range for the cursor position (single character width)
      const cursorRange = new monaco.Range(data.position.lineNumber, data.position.column, data.position.lineNumber, data.position.column + 1);

      // Apply teacher cursor decoration
      if (!teacherCursorDecorationsRef.current) {
        teacherCursorDecorationsRef.current = editor.createDecorationsCollection();
      }

      teacherCursorDecorationsRef.current.set([
        {
          range: cursorRange,
          options: {
            className: 'teacher-cursor',
            hoverMessage: {
              value: `🎯 Teacher ${data.teacherName} cursor position (synced)\n\nLine ${data.position.lineNumber}, Column ${data.position.column}`
            },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            overviewRuler: {
              color: 'rgba(255, 152, 0, 0.8)',
              position: monaco.editor.OverviewRulerLane.Left
            }
          }
        }
          ]);

      // Update teacher cursor position state
      setTeacherCursorPosition({
        lineNumber: data.position.lineNumber,
        column: data.position.column,
        teacherName: data.teacherName
      });

      // console.log('✅ Teacher cursor synced successfully');
    } catch (error) {
      // console.error('❌ Error syncing teacher cursor:', error);
    }
  }, [isTeacher]);

  // Moved handleUserListUpdate to the top-level of the component
  const handleUserListUpdate = useCallback((data: any) => {
    // console.log('📥 [USER_LIST] Received user list update:', data);

    let users: Array<{ socketId?: string, username: string, userId?: string, role?: string, isTeacher?: boolean, isStudent?: boolean }> = [];
    let eventType = 'unknown';
    let totalUsers = 0;

    if (Array.isArray(data)) {
      users = data;
      eventType = 'direct-array';
      totalUsers = users.length;
    } else if (data && Array.isArray(data.users)) {
      users = data.users.map((user: any) => {
        if (typeof user === 'string') {
          return { username: user, role: 'student' };
        }
        return user;
      });
      eventType = data.event || data.triggeredBy || 'users-object';
      totalUsers = data.totalUsers || users.length;
    } else if (data && data.newUserSocketId && isTeacher) {
      // console.log('🎯 [TEACHER_SYNC] New user joined, syncing teacher state:', data);

      const socketServiceInstance = SocketService.getInstance();

      if (latestCodeRef.current && latestCodeRef.current !== "// Start coding...") {
        // console.log('📤 [TEACHER_SYNC] Syncing current code to new user');
        socketServiceInstance.syncCodeToUser(roomId, latestCodeRef.current, data.newUserSocketId);
      }

      if (currentTeacherSelection) {
        // console.log('📤 [TEACHER_SYNC] Syncing current teacher selection to new user');
        socketServiceInstance.syncTeacherSelectionToUser(roomId, currentTeacherSelection, data.newUserSocketId);
      }

      if (currentTeacherCursor) {
        // console.log('📤 [TEACHER_SYNC] Syncing current teacher cursor to new user');
        socketServiceInstance.syncTeacherCursorToUser(roomId, currentTeacherCursor, data.newUserSocketId);
      }

      if (data.allUsers) {
        users = data.allUsers;
        eventType = 'user-joined-with-sync';
        totalUsers = data.totalUsers || users.length;
      }
    } else if (data && data.allUsers && Array.isArray(data.allUsers)) {
      users = data.allUsers;
      eventType = 'user-joined';
      totalUsers = data.totalUsers || users.length;
    } else {
      // console.warn('⚠️ [USER_LIST] Unexpected user list update format:', data);
      return;
    }

    const processedUsers = users.filter((user: any) => user && typeof user.username === 'string');

    if (processedUsers.length === 0) {
      // console.warn('⚠️ [USER_LIST] No valid users found in update');
      onActiveUsersChange([]);
      return;
    }

    // console.log(`✅ [USER_LIST] Processing ${processedUsers.length} users from ${eventType} event (Total: ${totalUsers})`);

    const currentUserId = localStorage.getItem('userId');

    const usernames = processedUsers.map((user:any) => {
      const displayName = user.username;
      const isCurrentUser = user.userId === currentUserId;
      const roleInfo = user.role ? ` (${user.role})` : '';

      if (isCurrentUser) {
        return `${displayName} (you)${roleInfo}`;
      } else {
        return `${displayName}${roleInfo}`;
      }
    });

    // console.log(`🔄 [USER_LIST] Setting active users: [${usernames.join(', ')}] - Total: ${totalUsers}`);
    onActiveUsersChange(usernames);

    if (eventType === 'user-joined' && data.newUserName) {
      // console.log(`👋 [USER_LIST] New user joined: ${data.newUserName} (Total: ${totalUsers})`);
    }
    
    if (usernames.length === 0) {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        // console.log('🔄 [USER_LIST] Fallback: Adding self to user list');
        onActiveUsersChange([`${storedUsername} (you)`]);
      }
    }
  }, [onActiveUsersChange, isTeacher]);

  // Track typing timeout to prevent overlapping indicators
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Added handleUserTyping function with proper timeout clearing
  const handleUserTyping = useCallback((data: { username: string }) => {
    setTypingUser(data.username);
    
    // Clear any existing timeout to prevent overlapping
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setTypingUser(null);
      typingTimeoutRef.current = null;
    }, 2000);
  }, []);

  // Register event listeners
  useEffect(() => {
    const socketServiceInstance = SocketService.getInstance();

    const listeners = [
      { event: 'code-update', handler: handleCodeUpdate },
      { event: 'code-change', handler: handleRealTimeCodeChange },
      { event: 'user-typing', handler: handleUserTyping },
      { event: 'user-joined', handler: handleUserListUpdate },
      { event: 'user-left', handler: handleUserListUpdate },
      { event: 'room-users-updated', handler: handleUserListUpdate },
      { event: 'update-user-list', handler: handleUserListUpdate },
      { event: 'user-count-update', handler: handleUserListUpdate },
      { event: 'get-initial-code', handler: handleGetInitialCode },
      { event: 'initial-code-received', handler: handleInitialCodeReceived },
      { event: 'teacher-selection', handler: handleTeacherSelection },
      { event: 'clear-teacher-selection', handler: handleClearTeacherSelection },
      { event: 'teacher-cursor-position', handler: handleTeacherCursorPosition },
      { event: 'teacher-text-highlight', handler: handleTeacherTextHighlight },
      { event: 'clear-teacher-text-highlight', handler: handleClearTeacherTextHighlight },
      { event: 'sync-code', handler: handleSyncCode },
      { event: 'sync-teacher-selection', handler: handleSyncTeacherSelection },
      { event: 'sync-teacher-cursor', handler: handleSyncTeacherCursor }
    ];

    listeners.forEach(({ event, handler }) => {
      socketServiceInstance.on(event, handler);
    });

    // console.log('✅ [EVENTS] All socket event listeners registered successfully');

    return () => {
      listeners.forEach(({ event, handler }) => {
        socketServiceInstance.off(event, handler);
      });
      // console.log('✅ [EVENTS] All socket event listeners cleaned up');
    };
  }, [
    handleCodeUpdate, handleRealTimeCodeChange, handleUserTyping, handleUserListUpdate,
    handleGetInitialCode, handleInitialCodeReceived, handleTeacherSelection,
    handleClearTeacherSelection, handleTeacherCursorPosition, handleTeacherTextHighlight,
    handleClearTeacherTextHighlight, handleSyncCode, handleSyncTeacherSelection,
    handleSyncTeacherCursor
  ]);

  // Join room effect
  useEffect(() => {
    const socketServiceInstance = SocketService.getInstance();
    
    if (roomId && socketReady && username) {
      // console.log(`Joining room: ${roomId} as ${username}`);
      
      if (!editorRef.current) {
        setIsLoading(true);
      }

      const joinRoom = async () => {
        try {
          if (socketServiceInstance.isConnected()) {
            let userId = localStorage.getItem('userId');
            if (!userId) {
              userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
              localStorage.setItem('userId', userId);
            }
            const { username: validatedUsername, users, role } = await socketServiceInstance.joinRoom(roomId, username, userId);
            
            // console.log("Successfully joined room:", roomId, { users, role });

            if (validatedUsername !== username) {
              setUsername(validatedUsername);
              localStorage.setItem('username', validatedUsername);
            }

            if (role) {
              setIsTeacher(role === 'teacher');
              localStorage.setItem('userRole', role);
            }

            if (users && Array.isArray(users)) {
              handleUserListUpdate(users);
            }
          }
        } catch (error) {
          // console.error("Error joining room:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      joinRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socketReady]);

  // Auto-save functionality
  useEffect(() => {
    if (!socket || !canEdit) return;

    // Set up auto-save interval (every 30 seconds)
    const interval = setInterval(() => {
      if (latestCodeRef.current && editorRef.current) {
        const currentCode = editorRef.current.getValue();
        if (currentCode !== latestCodeRef.current) {
          setCode(currentCode);
          latestCodeRef.current = currentCode;
          triggerAutoSave(currentCode);
        }
      }
    }, 30000); // 30 seconds

    setAutoSaveInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [socket, canEdit, latestCodeRef.current]);

  // Manual save with Ctrl+S
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (editorRef.current && canEdit) {
          const currentCode = editorRef.current.getValue();
          triggerManualSave(currentCode);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canEdit]);

  // Listen for save status updates
  useEffect(() => {
    if (!socket) return;

    socket.on('save-status', (data: { success: boolean; message: string; timestamp: string }) => {
      if (data.success) {
        setSaveStatus('saved');
        setLastSaved(new Date(data.timestamp));
        console.log('✅ Code saved successfully');
      } else {
        setSaveStatus('error');
        console.error('❌ Save failed:', data.message);
      }
    });

    return () => {
      socket.off('save-status');
    };
  }, [socket]);

  const triggerAutoSave = (code: string) => {
    if (!socket || !user?.email) return;

    setSaveStatus('saving');
    socket.emit('code-change', {
      roomId,
      code,
      userId: user.email,
      username,
      timestamp: Date.now()
    });
  };

  const triggerManualSave = (code: string) => {
    if (!socket || !currentUserId) return;

    setSaveStatus('saving');
    socket.emit('manual-save', {
      roomId,
      code,
      language: language,
      userId: currentUserId
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
        <FiLoader className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-w-0 flex flex-col">

      {/* Save Status Indicator */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs rounded">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </div>
        )}
        {saveStatus === 'saved' && lastSaved && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded">
            <span>✓</span>
            Saved {lastSaved.toLocaleTimeString()}
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs rounded">
            <span>✗</span>
            Save failed
          </div>
        )}
      </div>

      <Editor
        height="100%"
        width="100%"
        theme={isDarkMode ? "vs-dark" : "light"}
        language={language}
        value={code}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          fontSize: 16,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          readOnly: !canEdit && !isTeacher, // Only disables editing, allows scroll/select/copy
          smoothScrolling: true,
          cursorBlinking: "blink",
          contextmenu: canEdit || isTeacher,
          ...(options || {}) // Merge in options from props
        }}
      />
      {typingUser && (
        <div className="absolute bottom-2 left-2 z-10 bg-black/70 text-white text-xs px-3 py-1 rounded shadow">
          <span className="font-medium">{typingUser}</span> is typing...
        </div>
      )}
      {/* Remove overlay for students in view-only mode to allow scroll/select/copy */}
    </div>
  );
});

export default CodeEditor;

