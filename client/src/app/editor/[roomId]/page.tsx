"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import CodeEditor, { CodeEditorRef } from "@/components/CodeEditor"
import ProtectedRoute from "@/components/ProtectedRoute"
import { EditPermissionProvider } from "@/context/EditPermissionContext"
import { EditorPermissionStatus } from "@/components/PermissionBadge"
import { useAuth } from '@/context/AuthContext';
import { FiUser, FiCopy, FiPlay, FiAlignLeft, FiUsers, FiLogOut, FiMoon, FiSun, FiLock, FiUnlock, FiCheckCircle, FiAlertCircle, FiTerminal, FiTrash2 } from 'react-icons/fi';
import { useTheme } from "@/context/ThemeContext"
import { useEditPermission } from "@/context/EditPermissionContext"
import ReactDOM from "react-dom";

const languageOptions = [
{ value: 'javascript', label: 'JavaScript', icon: <span className="text-yellow-400">JS</span> },
{ value: 'typescript', label: 'TypeScript', icon: <span className="text-blue-400">TS</span> },
{ value: 'python', label: 'Python', icon: <span className="text-blue-300">Py</span> },
{ value: 'java', label: 'Java', icon: <span className="text-orange-400">Jv</span> },
{ value: 'csharp', label: 'C#', icon: <span className="text-purple-400">C#</span> },
{ value: 'cpp', label: 'C++', icon: <span className="text-indigo-400">C++</span> },
{ value: 'ruby', label: 'Ruby', icon: <span className="text-red-400">Rb</span> },
{ value: 'go', label: 'Go', icon: <span className="text-cyan-400">Go</span> },
{ value: 'rust', label: 'Rust', icon: <span className="text-orange-600">Rs</span> },
];

// Popover component with portal, fixed positioning, and edge overflow prevention
function Popover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  // Position dropdown using portal and fixed positioning, prevent right overflow
  useEffect(() => {
    if (!open) return;
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const dropdownWidth = isMobile ? window.innerWidth : 240; // default width for popover
    let left = rect.left;
    let top = rect.bottom + 4;
    // Prevent right overflow
    if (!isMobile && left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8; // 8px margin from right
      if (left < 8) left = 8; // 8px margin from left if too small
    }
    if (isMobile) {
      setDropdownStyle({
        position: 'fixed',
        left: 0,
        right: 0,
        top,
        zIndex: 9999,
        width: '100vw',
        maxWidth: '100vw',
        minWidth: 0,
      });
    } else {
      setDropdownStyle({
        position: 'fixed',
        left,
        top,
        zIndex: 9999,
        minWidth: 160,
        maxWidth: 320,
      });
    }
  }, [open]);

  const dropdown = open ? (
    <div
      ref={ref}
      style={dropdownStyle}
      className="bg-zinc-900 rounded-lg shadow-lg p-2"
    >
      {children}
    </div>
  ) : null;

  return (
    <div className="relative inline-block">
      <span ref={triggerRef} onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && typeof window !== 'undefined' && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
}

function stringToColor(str: string): string {
let hash = 0;
for (let i = 0; i < str.length; i++) {
hash = str.charCodeAt(i) + ((hash << 5) - hash);
}
let color = '#';
for (let i = 0; i < 3; i++) {
const value = (hash >> (i * 8)) & 0xff;
color += ('00' + value.toString(16)).slice(-2);
}
return color;
}

// Helper to blend color with white for lighter avatar backgrounds
function lightenColor(hex: string, percent: number = 0.6): string {
// Convert hex to RGB
let r = parseInt(hex.slice(1, 3), 16);
let g = parseInt(hex.slice(3, 5), 16);
let b = parseInt(hex.slice(5, 7), 16);
// Blend with white
r = Math.round(r + (255 - r) * percent);
g = Math.round(g + (255 - g) * percent);
b = Math.round(b + (255 - b) * percent);
return `rgb(${r}, ${g}, ${b})`;
}

const TopNavbar = ({ roomId, onRun, onCopy, onFormat, onLanguageChange, language, activeUsers, user, logout, theme, toggleTheme }: any) => {
const { canEdit, isTeacher, toggleRoomPermission } = useEditPermission();
const [isRoomToggling, setIsRoomToggling] = useState(false);
const [showProfile, setShowProfile] = useState(false);
const [showUsers, setShowUsers] = useState(false);
const [showRoomControl, setShowRoomControl] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // NEW: mobile drawer state
const isDark = theme === 'dark';
const initials = user?.email ? user.email[0].toUpperCase() : 'U';
const avatarColor = user?.email ? stringToColor(user.email) : '#888888';
const userDropdownRef = useRef<HTMLDivElement>(null);
const userDropdownButtonRef = useRef<HTMLButtonElement>(null);

// Close dropdown on outside click, but not when clicking the button
useEffect(() => {
if (!showUsers) return;
function handle(e: MouseEvent) {
const target = e.target as Node;
if (
    userDropdownRef.current &&
    !userDropdownRef.current.contains(target) &&
    userDropdownButtonRef.current &&
    !userDropdownButtonRef.current.contains(target)
) {
    setShowUsers(false);
}
}
document.addEventListener('mousedown', handle);
return () => document.removeEventListener('mousedown', handle);
}, [showUsers]);

// Close mobile menu on Escape or overlay click
useEffect(() => {
  if (!mobileMenuOpen) return;
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') setMobileMenuOpen(false);
  }
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}, [mobileMenuOpen]);

return (
<div className="w-full flex items-center px-4 py-2 justify-between gap-2 relative">
    {/* Hamburger for mobile */}
    <button
      className="lg:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
      aria-label="Open menu"
      aria-expanded={mobileMenuOpen}
      aria-controls="mobile-navbar-drawer"
      onClick={() => setMobileMenuOpen(true)}
      tabIndex={0}
      type="button"
    >
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    {/* Left: App/Room Name */}
    <div className="flex items-center gap-2 min-w-0 flex-1">
        <h1 className="text-xl font-bold text-white truncate">
            RealCode <span className="text-sm font-normal text-gray-400">- Room: {roomId}</span>
        </h1>
    </div>
    {/* Key Actions: Always visible, responsive layout */}
    <div className="flex items-center gap-0.5 sm:gap-1 ml-auto flex-wrap overflow-x-auto no-scrollbar">
        {/* Language Selector */}
        <Popover
            trigger={<button className="flex items-center justify-center gap-0.5 bg-gray-700 text-white text-sm rounded-md p-1 sm:px-2 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-600 transition min-w-[44px] min-h-[44px]" aria-label="Select language"><span>{languageOptions.find(l => l.value === language)?.icon}</span><span className="hidden md:inline">{languageOptions.find(l => l.value === language)?.label}</span></button>}
        >
            <div className="bg-zinc-900 rounded-lg shadow-lg p-2 min-w-[120px]">
                {languageOptions.map((lang) => (
                    <button key={lang.value} onClick={() => onLanguageChange(lang.value)} className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-white hover:bg-zinc-800 transition ${language === lang.value ? 'bg-zinc-800 font-bold' : ''}`}>{lang.icon}{lang.label}</button>
                ))}
            </div>
        </Popover>
        {/* Run Button */}
        <button onClick={onRun} className="flex items-center justify-center gap-0.5 px-1 sm:px-2 py-1 sm:py-2 bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 text-white shadow border-l border-gray-600/50 min-w-[44px] min-h-[44px] rounded-md" title="Run code (Ctrl+Enter)" aria-label="Run code"><FiPlay /><span className="hidden md:inline">Run</span></button>
        {/* Copy Button (hide on xs) */}
        <button onClick={onCopy} className="hidden xs:inline-flex items-center justify-center p-1 sm:p-2 hover:bg-gray-600 focus:outline-none min-w-[44px] min-h-[44px] rounded-md" title="Copy code (Ctrl+C)" aria-label="Copy code"><FiCopy className="text-white" /></button>
        {/* Format Button (hide on xs) */}
        <button onClick={onFormat} className="hidden xs:inline-flex items-center justify-center p-1 sm:p-2 hover:bg-gray-600 focus:outline-none min-w-[44px] min-h-[44px] rounded-md" title="Format code (Shift+Alt+F)" aria-label="Format code"><FiAlignLeft className="text-white" /></button>
        {/* User List Button */}
        <Popover
            trigger={<button className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow min-w-[44px] min-h-[44px]" aria-label="Show users"><FiUsers className="text-lg text-blue-400" /></button>}
        >
            <div className="bg-zinc-900 rounded-lg shadow-lg p-2 min-w-[220px] max-w-xs">
                <div className="px-4 py-2 text-xs text-gray-400 font-semibold border-b border-zinc-800">Active Users ({activeUsers.length})</div>
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800">
                {activeUsers
                    .map((u: string, i: number) => {
                    const isTeacher = u.toLowerCase().includes('teacher');
                    const isCurrent = u.toLowerCase().includes('(you)');
                    const username = u.replace(/\s*\(you\).*/, '').replace(/\s*\(teacher\).*/, '').replace(/\s*\(student\).*/, '').trim();
                    return { u, isTeacher, isCurrent, username };
                    })
                    .sort((a: { isTeacher: boolean }, b: { isTeacher: boolean }) => (a.isTeacher ? -1 : 1))
                    .map(({ u, isTeacher, isCurrent, username }: { u: string, isTeacher: boolean, isCurrent: boolean, username: string }, i: number) => (
                    <div
                        key={u + i}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 transition-colors ${isTeacher ? 'border-l-4 border-blue-500 bg-blue-950/30' : ''}`}
                    >
                        <span
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-gray-900 mr-2 border border-gray-300 shadow-sm"
                        style={{ backgroundColor: lightenColor(stringToColor(username), 0.7) }}
                        >
                        {username[0]?.toUpperCase() || 'U'}
                        </span>
                        <span className="font-medium text-white text-sm">{username}{isCurrent ? ' (you)' : ''}</span>
                        <span
                        className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${isTeacher ? '' : ''}`}
                        style={{
                            backgroundColor: isTeacher ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                            color: isTeacher ? '#3b82f6' : '#10b981',
                            opacity: 2.5,
                            fontWeight: 300,
                        }}
                        >
                        {isTeacher ? 'teacher' : 'student'}
                        </span>
                    </div>
                    ))}
                </div>
            </div>
        </Popover>
        {/* Permission Button - Responsive */}
        {isTeacher && (
          <Popover
            trigger={<button className={`flex items-center justify-center w-10 h-10 rounded-full border border-slate-600 bg-zinc-800 text-white font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:bg-zinc-700 active:scale-[.97] min-w-[44px] min-h-[44px]`} aria-label="Change room permission" title="Change permission for this room">
              {canEdit ? <FiUnlock className="w-5 h-5" /> : <FiLock className="w-5 h-5" />}
            </button>}
          >
            <div className="bg-zinc-900 rounded-lg shadow-lg p-4 min-w-[220px] max-w-xs flex flex-col items-center">
              <span className="text-white font-semibold mb-2">Room Permission</span>
              <button
                onClick={() => {
                  if (isRoomToggling) return;
                  setIsRoomToggling(true);
                  toggleRoomPermission(() => setIsRoomToggling(false));
                }}
                disabled={isRoomToggling}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border border-slate-600 bg-blue-600 text-white font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:bg-blue-700 active:scale-[.97] min-w-[44px] min-h-[44px] ${isRoomToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Toggle room permission"
                title="Change permission for this room"
              >
                {canEdit ? <FiLock className="w-5 h-5" /> : <FiUnlock className="w-5 h-5" />}
                <span>{canEdit ? 'Set to View Only' : 'Set to Editable'}</span>
              </button>
              <span className="mt-2 text-xs text-gray-400">Current: {canEdit ? 'Editable' : 'View Only'}</span>
            </div>
          </Popover>
        )}
        {/* Theme Toggle Switch */}
        <button onClick={toggleTheme} className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 transition focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Toggle theme" aria-label="Toggle theme">
            {isDark ? <FiSun className="text-yellow-300" /> : <FiMoon className="text-blue-400" />}
        </button>
        {/* User Avatar Dropdown */}
        <Popover
            trigger={<button className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-gray-600 shadow bg-white/10 min-w-[44px] min-h-[44px]" style={{ backgroundColor: avatarColor }} aria-label="User menu"><span className="text-white font-bold text-lg">{initials}</span></button>}
        >
            <div className="bg-zinc-900 rounded-lg shadow-lg p-4 min-w-[180px]">
                {user && <div className="px-2 py-2 text-sm text-gray-300 border-b border-gray-600 mb-2">{user.email}</div>}
                <button onClick={logout} className="w-full text-left flex items-center gap-3 px-2 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-md min-w-[44px] min-h-[44px]">
                    <FiLogOut />
                    <span>Logout</span>
                </button>
            </div>
        </Popover>
    </div>
    {/* Hamburger menu for overflow/secondary actions remains */}
    {/* Mobile Drawer (hamburger menu) */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" id="mobile-navbar-drawer">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" tabIndex={0} />
        {/* Drawer */}
        <nav className="relative ml-auto w-72 max-w-full h-full bg-[#171a29] border-l-2 border-zinc-800 flex flex-col shadow-2xl animate-slide-in-right rounded-l-3xl min-w-0 p-6 transition-all duration-200">
          <button
            className="absolute top-5 right-5 z-50 bg-zinc-800 text-white rounded-full p-3 shadow border-2 border-gray-700 hover:bg-zinc-700 hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            type="button"
          >
            <span className="text-2xl">×</span>
          </button>
          {/* Language Selector */}
          <Popover
            trigger={<button className="flex items-center gap-2 bg-gray-700 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-600 transition min-w-[44px] min-h-[44px]" aria-label="Select language"><span>{languageOptions.find(l => l.value === language)?.icon}</span>{languageOptions.find(l => l.value === language)?.label}</button>}
          >
            <div className="bg-zinc-900 rounded-lg shadow-lg p-2 min-w-[160px]">
              {languageOptions.map((lang) => (
                <button key={lang.value} onClick={() => onLanguageChange(lang.value)} className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-white hover:bg-zinc-800 transition ${language === lang.value ? 'bg-zinc-800 font-bold' : ''}`}>{lang.icon}{lang.label}</button>
              ))}
            </div>
          </Popover>
          {/* Action Buttons Group */}
          <div className="flex flex-col gap-2 mt-4">
            <button onClick={onCopy} className="flex items-center gap-2 p-3 bg-gray-700 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Copy code (Ctrl+C)" aria-label="Copy code"><FiCopy /><span>Copy</span></button>
            <button onClick={onFormat} className="flex items-center gap-2 p-3 bg-gray-700 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Format code (Shift+Alt+F)" aria-label="Format code"><FiAlignLeft /><span>Format</span></button>
            <button onClick={onRun} className="flex items-center gap-2 p-3 bg-blue-600 rounded-md text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Run code (Ctrl+Enter)" aria-label="Run code"><FiPlay /><span>Run</span></button>
          </div>
          {/* Room Control (if teacher) */}
          {isTeacher && (
            <button
              onClick={() => {
                if (isRoomToggling) return;
                setIsRoomToggling(true);
                toggleRoomPermission(() => setIsRoomToggling(false));
              }}
              disabled={isRoomToggling}
              className={`flex items-center gap-2 mt-4 px-4 py-3 rounded-md border border-slate-600 bg-zinc-800 text-white font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:bg-zinc-700 active:scale-[.97] min-w-[44px] min-h-[44px] ${isRoomToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Toggle room permission"
              title="Change permission for this room"
            >
              {canEdit ? <FiUnlock className="w-5 h-5" /> : <FiLock className="w-5 h-5" />}
              <span>Change Permission</span>
            </button>
          )}
          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="mt-4 flex items-center gap-2 w-full p-3 rounded-md bg-gray-700 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Toggle theme" aria-label="Toggle theme">
            {isDark ? <FiSun className="text-yellow-300" /> : <FiMoon className="text-blue-400" />}
            <span>Theme</span>
          </button>
          {/* User Avatar & Logout */}
          <div className="flex items-center gap-3 mt-6">
            <button className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-gray-600 shadow bg-white/10 min-w-[44px] min-h-[44px]" style={{ backgroundColor: avatarColor }} aria-label="User menu"><span className="text-white font-bold text-lg">{initials}</span></button>
            <span className="text-white text-sm font-medium">{user?.email}</span>
          </div>
          <button onClick={logout} className="w-full text-left flex items-center gap-3 px-2 py-3 text-sm text-red-400 hover:bg-gray-700 rounded-md min-w-[44px] min-h-[44px] mt-2" aria-label="Logout"><FiLogOut /><span>Logout</span></button>
        </nav>
      </div>
    )}
</div>
);
};

const MainContent = ({ editorRef, roomId, username, onExecutionResult, onActiveUsersChange }: any) => (
<div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
<CodeEditor
    ref={editorRef}
    roomId={roomId}
    username={username}
    onExecutionResult={onExecutionResult}
    onActiveUsersChange={onActiveUsersChange}
/>
<div className="absolute bottom-0 left-0 w-full">
    <EditorPermissionStatus />
</div>
</div>
);

const RightSidebar = ({ executionOutput, executionError, activeUsers, onClearOutput, onCopyOutput, copied }: any) => (
<aside className="w-72 bg-[#171a29] flex-shrink-0 hidden lg:flex flex-col border-l border-gray-700">
<div className="p-4 border-b border-gray-700">
    <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold">Output</h3>
        <div className="flex items-center gap-1">
        <button
            onClick={onCopyOutput}
            className="p-1 rounded hover:bg-zinc-800 text-gray-400 hover:text-blue-500 transition"
            title={copied ? 'Copied!' : 'Copy Output'}
            aria-label="Copy Output"
            type="button"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <FiCopy className="w-5 h-5" />
        </button>
        <button
            onClick={onClearOutput}
            className="p-1 rounded hover:bg-zinc-800 text-gray-400 hover:text-red-500 transition"
            title="Clear Output"
            aria-label="Clear Output"
            type="button"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <FiTrash2 className="w-5 h-5" />
        </button>
        </div>
    </div>
    <div className={`relative w-full flex items-start ${executionError ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}>
        <span className="mt-1 mr-2">
        {executionError ? (
            <FiAlertCircle className="text-red-400 w-5 h-5" />
        ) : (
            <FiCheckCircle className="text-green-400 w-5 h-5" />
        )}
        </span>
        <pre className={`w-full flex-1 whitespace-pre-wrap text-base rounded-xl bg-black p-4 overflow-auto resize-y min-h-[120px] max-h-[400px] ${executionError ? 'text-red-400' : 'text-green-300'}`}>
        {executionError || executionOutput || "Click 'Run' to see the output here."}
        </pre>
    </div>
</div>
</aside>
);

export default function EditorPage() {
const params = useParams();
const roomId = params?.roomId as string;
const [username, setUsername] = useState<string>("Anonymous");
const { user, logout } = useAuth();
const { theme, toggleTheme } = useTheme();
const editorRef = useRef<CodeEditorRef>(null);
const userDropdownRef = useRef<HTMLDivElement>(null);
const userDropdownButtonRef = useRef<HTMLButtonElement>(null);
const [executionOutput, setExecutionOutput] = useState<string | null>(null);
const [executionError, setExecutionError] = useState<string | null>(null);
const [activeUsers, setActiveUsers] = useState<string[]>([]);
const [currentLanguage, setCurrentLanguage] = useState('javascript');
const [sidebarOpen, setSidebarOpen] = useState(false);
const [copied, setCopied] = useState(false);

useEffect(() => {
if (!roomId) return;
if (typeof window !== "undefined") {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
        setUsername(storedUsername);
    } else {
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const defaultUsername = `User${randomSuffix}`;
        localStorage.setItem("username", defaultUsername);
        setUsername(defaultUsername);
    }
}
}, [roomId]);

const handleRunCode = () => editorRef.current?.executeCode();
const handleCopyCode = () => editorRef.current?.copyCode();
const handleFormatCode = () => editorRef.current?.formatCurrentCode();
const handleLanguageChange = (lang: string) => {
setCurrentLanguage(lang);
editorRef.current?.setLanguage(lang);
};

const handleExecutionResult = ({ output, error }: { output: string | null; error: string | null }) => {
setExecutionOutput(output);
setExecutionError(error);
};

const handleActiveUsersChange = (users: string[]) => {
setActiveUsers(users);
};

const handleCopyOutput = () => {
const text = executionError || executionOutput || '';
if (!text) return;
navigator.clipboard.writeText(text).then(() => {
setCopied(true);
setTimeout(() => setCopied(false), 1200);
});
};

if (!roomId) {
return <div>Error: Room ID is missing. Please join a valid room.</div>;
}

return (
<ProtectedRoute>
    <EditPermissionProvider>
        <div className="w-screen h-screen flex flex-col overflow-x-hidden overflow-y-hidden bg-gradient-to-br from-[#10131a] via-[#181c2a] to-[#0e0e0e] relative">
            {/* Sticky Top Navbar */}
            <div className="sticky top-0 z-30 shadow-lg border-b border-zinc-800 bg-[#1f2333]/95 backdrop-blur-md">
                <TopNavbar 
                    roomId={roomId} 
                    onRun={handleRunCode}
                    onCopy={handleCopyCode}
                    onFormat={handleFormatCode}
                    onLanguageChange={handleLanguageChange}
                    language={currentLanguage}
                    activeUsers={activeUsers}
                    user={user}
                    logout={logout}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
            </div>
            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 w-full h-full overflow-hidden min-w-0 p-0 gap-0">
                {/* Editor Area */}
                <div className="flex-1 min-w-0 min-h-[300px] w-full h-full flex flex-col overflow-hidden bg-zinc-900/90 shadow-2xl border-2 border-zinc-800 relative p-3 sm:p-6 transition-all duration-200">
                    <div className="editor-container flex-1 min-w-0 w-full h-full flex flex-col">
                        <CodeEditor
                            ref={editorRef}
                            roomId={roomId}
                            username={username}
                            onExecutionResult={handleExecutionResult}
                            onActiveUsersChange={handleActiveUsersChange}
                            options={{ automaticLayout: true }}
                        />
                    </div>
                    <div className="w-full mt-4">
                        <EditorPermissionStatus />
                    </div>
                    {/* Sidebar Toggle Button for Mobile */}
                    <button
                        className="lg:hidden absolute top-5 right-5 z-20 bg-[#171a29] text-white rounded-full p-3 shadow-lg border-2 border-gray-700 hover:bg-[#23263a] hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Show Output"
                        title="Show Output"
                    >
                        <FiTerminal className="w-6 h-6" />
                    </button>
                </div>
                {/* Sidebar (Desktop) - Output only */}
                <aside className="w-80 flex-shrink-0 bg-[#171a29] border-l-2 border-zinc-800 overflow-y-auto hidden lg:flex flex-col rounded-3xl shadow-2xl transition-all duration-200 min-w-0">
                    <div className="flex-1 p-6 flex flex-col">
                        <h3 className="text-white mb-3 font-semibold">Output</h3>
                        <pre className={`w-full flex-1 whitespace-pre-wrap text-base rounded-xl bg-black p-4 overflow-auto resize-y min-h-[120px] max-h-[400px] ${executionError ? 'text-red-400' : 'text-green-300'}`}>
                            {executionError || executionOutput || "Click 'Run' to see the output here."}
                        </pre>
                    </div>
                </aside>
                {/* Slide-in Sidebar Drawer (Mobile/Tablet) */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" tabIndex={-1}>
                        {/* Overlay */}
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Close sidebar overlay"
                            tabIndex={0}
                        />
                        {/* Drawer */}
                        <aside className="relative ml-auto w-80 max-w-full h-full bg-[#171a29] border-l-2 border-zinc-800 flex flex-col shadow-2xl animate-slide-in-right rounded-l-3xl min-w-0 p-4 transition-all duration-200 focus:outline-none" tabIndex={0}>
                            <button
                                className="absolute top-5 right-5 z-50 bg-zinc-800 text-white rounded-full p-3 shadow border-2 border-gray-700 hover:bg-zinc-700 hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
                                onClick={() => setSidebarOpen(false)}
                                aria-label="Close sidebar"
                                type="button"
                            >
                                <span className="text-2xl">×</span>
                            </button>
                            <div className="p-2 border-b border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-white font-semibold">Output</h3>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={handleCopyOutput}
                                            className="p-1 rounded hover:bg-zinc-800 text-gray-400 hover:text-blue-500 transition min-w-[44px] min-h-[44px]"
                                            title={copied ? 'Copied!' : 'Copy Output'}
                                            aria-label="Copy Output"
                                            type="button"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <FiCopy className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => { setExecutionOutput(null); setExecutionError(null); }}
                                            className="p-1 rounded hover:bg-zinc-800 text-gray-400 hover:text-red-500 transition min-w-[44px] min-h-[44px]"
                                            title="Clear Output"
                                            aria-label="Clear Output"
                                            type="button"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <FiTrash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className={`relative w-full flex items-start ${executionError ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}>
                                    <span className="mt-1 mr-2">
                                        {executionError ? (
                                            <FiAlertCircle className="text-red-400 w-5 h-5" />
                                        ) : (
                                            <FiCheckCircle className="text-green-400 w-5 h-5" />
                                        )}
                                    </span>
                                    <pre className={`w-full flex-1 whitespace-pre-wrap text-base rounded-xl bg-black p-4 overflow-auto resize-y min-h-[120px] max-h-[400px] ${executionError ? 'text-red-400' : 'text-green-300'}`}>
                                        {executionError || executionOutput || "Click 'Run' to see the output here."}
                                    </pre>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    </EditPermissionProvider>
</ProtectedRoute>
);
}