"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import ProtectedRoute from "@/components/ProtectedRoute"
import { EditPermissionProvider } from "@/context/EditPermissionContext"
import { EditorPermissionStatus } from "@/components/PermissionBadge"
import { useAuth } from '@/context/AuthContext';
import { FiUser, FiCopy, FiPlay, FiAlignLeft, FiUsers, FiLogOut, FiMoon, FiSun, FiLock, FiUnlock, FiCheckCircle, FiAlertCircle, FiTerminal, FiTrash2, FiClock } from 'react-icons/fi';
import { useTheme } from "@/context/ThemeContext"
import { useEditPermission } from "@/context/EditPermissionContext"
import ReactDOM from "react-dom";
import TerminalPanel from "@/components/TerminalPanel";
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import CodeHistoryPanel from "@/components/CodeHistoryPanel";
import IndividualUserPermissionPanel from "@/components/IndividualUserPermissionPanel";

// Dynamic import for CodeEditor to avoid SSR issues
const CodeEditor = dynamic(() => import("@/components/CodeEditor"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full bg-zinc-900 text-white">Loading editor...</div>
});

type CodeEditorRef = any; // Define CodeEditorRef here since it's no longer imported directly

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
    <motion.div
      ref={ref}
      style={dropdownStyle}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5"
    >
      {children}
    </motion.div>
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

const TopNavbar = ({ roomId, onRun, onCopy, onFormat, onLanguageChange, language, activeUsers, user, logout, theme, toggleTheme, onOpenHistory }: any) => {
  const { users, globalCanEdit, isTeacher, toggleRoomPermission } = useEditPermission();
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
const [isRoomToggling, setIsRoomToggling] = useState(false);
const [showProfile, setShowProfile] = useState(false);
const [showUsers, setShowUsers] = useState(false);
const [showRoomControl, setShowRoomControl] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // NEW: mobile drawer state
const [showIndividualPermissions, setShowIndividualPermissions] = useState(false);
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
<div className="w-full flex items-center px-6 py-4 justify-between gap-4 relative bg-slate-900/80 border-b border-slate-800/30">
    {/* Hamburger for mobile */}
    <button
      className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md bg-slate-800/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 mr-3"
      aria-label="Open menu"
      aria-expanded={mobileMenuOpen}
      aria-controls="mobile-navbar-drawer"
      onClick={() => setMobileMenuOpen(true)}
      tabIndex={0}
      type="button"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    {/* Left: App/Room Name */}
    <div className="flex items-center gap-4 min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-white truncate tracking-tight">RealCode</h1>
        <div className="bg-cyan-500/10 rounded-lg px-3 py-1.5 text-xs font-medium text-cyan-300 border border-cyan-500/20">
          Room: {roomId}
        </div>
    </div>
    {/* Key Actions: Always visible, responsive layout */}
    <div className="flex items-center gap-3 ml-auto flex-wrap overflow-x-auto no-scrollbar">
        {/* Enhanced Language Selector */}
        <Popover
            trigger={<button className="flex items-center gap-2 bg-slate-800/40 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 text-sm rounded-lg px-3 py-2 border border-slate-700/50 hover:border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 shadow-sm hover:shadow-md" aria-label="Select language">
                <span className="text-base">{languageOptions.find(l => l.value === language)?.icon}</span>
                <span className="hidden md:inline font-medium">{languageOptions.find(l => l.value === language)?.label}</span>
            </button>}
        >
            <div className="bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5 p-3 min-w-[200px]">
                {/* Language Categories */}
                <div className="space-y-3">
                    {/* Web Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">Web</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['javascript', 'typescript'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-yellow-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - Modern web development`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                    
                    {/* General Purpose Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">General Purpose</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['python', 'java', 'csharp', 'cpp'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-blue-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - General purpose programming`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-blue-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Modern Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">Modern</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['ruby', 'go', 'rust'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-emerald-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - Modern systems programming`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-emerald-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Popover>
        {/* Run Button with Enhanced Styling */}
        <button 
          onClick={onRun} 
          className="group flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 focus:ring-2 focus:ring-cyan-500/50 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-cyan-500/25 active:scale-95 transform hover:-translate-y-1" 
          title="Run code (Ctrl+Enter)" 
          aria-label="Run code"
        >
          <FiPlay className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
          <span className="hidden md:inline text-base">Run</span>
        </button>
        
        {/* Copy Button (hide on xs) */}
        <button 
          onClick={onCopy} 
          className="hidden xs:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-95 hover:shadow-lg hover:shadow-cyan-500/20" 
          title="Copy code (Ctrl+C)" 
          aria-label="Copy code"
        >
          <FiCopy className="w-4 h-4" />
        </button>
        
        {/* Format Button (hide on xs) */}
        <button 
          onClick={onFormat} 
          className="hidden xs:flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-95 hover:shadow-lg hover:shadow-cyan-500/20" 
          title="Format code (Shift+Alt+F)" 
          aria-label="Format code"
        >
          <FiAlignLeft className="w-4 h-4" />
        </button>
        
        {/* Code History Button */}
        <button 
          onClick={onOpenHistory} 
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/60 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-300 focus:ring-2 focus:ring-cyan-500/50 active:scale-95 hover:shadow-lg hover:shadow-cyan-500/20" 
          title="Code History" 
          aria-label="Code History"
        >
          <FiClock className="w-4 h-4" />
        </button>
        {/* User List Button */}
        <Popover
            trigger={<button className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-800/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm hover:shadow-md active:scale-95" aria-label="Show users"><FiUsers className="w-4 h-4 text-cyan-400" /></button>}
        >
            <div className="bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5 p-3 min-w-[240px] max-w-xs">
                {/* Enhanced Title */}
                <div className="px-2 py-2 mb-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-white">Active Users</h3>
                        <span className="text-sm text-zinc-400 font-medium">({users.length})</span>
                    </div>
                </div>
                
                {/* Enhanced User List */}
                <div className="max-h-60 overflow-y-auto space-y-1">
                {users
                    .sort((a, b) => (a.role === 'teacher' ? -1 : 1))
                    .map((user, i: number) => {
                    const isCurrent = user.userId === currentUserId;
                    return (
                    <motion.div
                        key={user.userId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-all duration-150 group"
                    >
                        {/* Enhanced Avatar */}
                        <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-gray-900 shadow-sm border border-gray-300/50"
                        style={{ backgroundColor: lightenColor(stringToColor(user.username), 0.7) }}
                        >
                        {user.username[0]?.toUpperCase() || 'U'}
                        </div>
                        
                        {/* Username with enhanced styling */}
                        <div className="flex-1 min-w-0">
                            <span className="font-medium text-white text-sm">{user.username}</span>
                            {isCurrent && (
                                <span className="ml-2 text-xs text-zinc-400 font-normal">(you)</span>
                            )}
                        </div>
                        
                        {/* Enhanced Role Badge */}
                        <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'teacher'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}
                        >
                        {user.role}
                        </div>
                    </motion.div>
                    );
                    })}
                </div>
            </div>
        </Popover>
        {/* Permission Button - Responsive */}
        {isTeacher && (
          <Popover
            trigger={<button className={`flex items-center justify-center w-8 h-8 rounded-md bg-slate-800/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm hover:shadow-md active:scale-95`} aria-label="Change room permission" title="Change permission for this room">
              {globalCanEdit ? <FiUnlock className="w-4 h-4" /> : <FiLock className="w-4 h-4" />}
            </button>}
          >
            <div className="bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5 p-5 min-w-[240px] max-w-xs flex flex-col items-center">
              {/* Title with Badge */}
              <div className="flex flex-col items-center mb-3">
                <h3 className="text-lg font-bold text-white mb-1">Room Permission</h3>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  globalCanEdit 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {globalCanEdit ? '✏️ Editable' : '👁️ View Only'}
                </div>
              </div>

              {/* Main Toggle Button */}
              <button
                onClick={() => {
                  if (isRoomToggling) return;
                  setIsRoomToggling(true);
                  toggleRoomPermission(() => setIsRoomToggling(false));
                }}
                disabled={isRoomToggling}
                className={`flex items-center justify-center gap-3 px-5 py-3 rounded-lg border border-slate-600/50 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isRoomToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label="Toggle room permission"
                title={globalCanEdit ? "Click to make room view-only" : "Click to make room editable"}
              >
                <motion.div
                  animate={{ rotate: isRoomToggling ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {globalCanEdit ? <FiLock className="w-4 h-4" /> : <FiUnlock className="w-4 h-4" />}
                </motion.div>
                <span>{globalCanEdit ? 'Set to View Only' : 'Set to Editable'}</span>
              </button>

              {/* Current Status */}
              <motion.div
                key={globalCanEdit ? 'editable' : 'viewonly'}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 text-sm text-zinc-400"
              >
                Current: {globalCanEdit ? 'Editable' : 'View Only'}
              </motion.div>
              
              {/* Divider */}
              <div className="w-full h-px bg-zinc-700/50 my-3"></div>
              
              {/* Individual User Permissions Button */}
              <button
                onClick={() => setShowIndividualPermissions(true)}
                className="w-full py-2.5 px-5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-zinc-600/50 hover:border-zinc-500/50 shadow-sm hover:shadow-md"
              >
                <FiUsers className="w-4 h-4" />
                Manage Individual Permissions
              </button>
            </div>
          </Popover>
        )}
        {/* Theme Toggle Switch */}
        <button 
          onClick={toggleTheme} 
          className="flex items-center justify-center w-8 h-8 rounded-md bg-slate-800/40 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm hover:shadow-md active:scale-95" 
          title="Toggle theme" 
          aria-label="Toggle theme"
        >
            {isDark ? <FiSun className="w-4 h-4 text-yellow-400" /> : <FiMoon className="w-4 h-4 text-cyan-400" />}
        </button>
        
        {/* User Avatar Dropdown */}
        <Popover
            trigger={<button className="w-8 h-8 rounded-md flex items-center justify-center border border-slate-600/50 shadow-sm bg-slate-800/40 hover:bg-cyan-500/20 transition-all duration-200 active:scale-95" style={{ backgroundColor: avatarColor }} aria-label="User menu"><span className="text-white font-semibold text-sm">{initials}</span></button>}
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
          {/* Enhanced Language Selector */}
          <Popover
            trigger={<button className="flex items-center gap-2 bg-slate-800/40 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 text-sm rounded-lg px-3 py-2 border border-slate-700/50 hover:border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 shadow-sm hover:shadow-md" aria-label="Select language">
              <span className="text-base">{languageOptions.find(l => l.value === language)?.icon}</span>
              <span className="font-medium">{languageOptions.find(l => l.value === language)?.label}</span>
            </button>}
          >
            <div className="bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/5 p-3 min-w-[200px]">
                {/* Language Categories */}
                <div className="space-y-3">
                    {/* Web Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">Web</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['javascript', 'typescript'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-yellow-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - Modern web development`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                    
                    {/* General Purpose Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">General Purpose</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['python', 'java', 'csharp', 'cpp'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-blue-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - General purpose programming`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-blue-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Modern Languages */}
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">Modern</h4>
                        <div className="space-y-1">
                            {languageOptions.filter(lang => ['ruby', 'go', 'rust'].includes(lang.value)).map((lang) => (
                                <motion.button 
                                    key={lang.value} 
                                    onClick={() => {
                                        onLanguageChange(lang.value);
                                        // Close dropdown after selection
                                        const event = new Event('mousedown');
                                        document.dispatchEvent(event);
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        language === lang.value 
                                            ? 'bg-white/10 border-l-2 border-emerald-400 shadow-md' 
                                            : 'hover:bg-white/5'
                                    }`}
                                    aria-label={`Select ${lang.label} language`}
                                    title={`${lang.label} - Modern systems programming`}
                                >
                                    <span className="text-base">{lang.icon}</span>
                                    <span className={`font-medium ${language === lang.value ? 'text-white' : 'text-zinc-200'}`}>
                                        {lang.label}
                                    </span>
                                    {language === lang.value && (
                                        <motion.div 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="ml-auto w-2 h-2 bg-emerald-400 rounded-full"
                                        />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          </Popover>
          {/* Action Buttons Group */}
          <div className="flex flex-col gap-2 mt-4">
            <button onClick={onCopy} className="flex items-center gap-2 p-3 bg-gray-700 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Copy code (Ctrl+C)" aria-label="Copy code"><FiCopy /><span>Copy</span></button>
            <button onClick={onFormat} className="flex items-center gap-2 p-3 bg-gray-700 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Format code (Shift+Alt+F)" aria-label="Format code"><FiAlignLeft /><span>Format</span></button>
            <button onClick={onOpenHistory} className="flex items-center gap-2 p-3 bg-gray-700 rounded-md text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]" title="Code History" aria-label="Code History"><FiClock /><span>History</span></button>
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
              {globalCanEdit ? <FiUnlock className="w-5 h-5" /> : <FiLock className="w-5 h-5" />}
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

    {/* Individual User Permission Panel */}
    <IndividualUserPermissionPanel
      isOpen={showIndividualPermissions}
      onClose={() => setShowIndividualPermissions(false)}
    />
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

function EditorPage() {
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
const { language, setLanguage } = useLanguage();
const [sidebarOpen, setSidebarOpen] = useState(false);
const [copied, setCopied] = useState(false);
const [runCodeString, setRunCodeString] = useState<string | undefined>(undefined);
const [userInput, setUserInput] = useState<string>("");
const [showHistory, setShowHistory] = useState(false);
const [terminalCollapsed, setTerminalCollapsed] = useState(false);
const [terminalWidth, setTerminalWidth] = useState(320); // Default width in pixels
const [isResizing, setIsResizing] = useState(false);

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

// Terminal resize handlers
const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
};

useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const containerWidth = window.innerWidth;
        const newWidth = containerWidth - e.clientX;
        
        // Minimum width: 250px, Maximum width: 60% of screen
        const minWidth = 250;
        const maxWidth = containerWidth * 0.6;
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setTerminalWidth(newWidth);
        }
    };
    
    const handleMouseUp = () => {
        setIsResizing(false);
    };
    
    if (isResizing) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }
    
    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };
}, [isResizing]);

const handleRunCode = () => {
  const code = editorRef.current?.getValue() || "";
  setRunCodeString(code);
  setTimeout(() => setRunCodeString(undefined), 100);
};

const handleCopyCode = () => editorRef.current?.copyCode();
const handleFormatCode = () => editorRef.current?.formatCurrentCode();
const handleLanguageChange = (lang: string) => {
  setLanguage(lang);
  editorRef.current?.setLanguage(lang);
};

const handleOpenHistory = () => {
  setShowHistory(true);
};

const handleLoadCode = (code: string, lang: string) => {
  setLanguage(lang);
  editorRef.current?.setValue(code);
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
        <div className="w-screen h-screen flex flex-col overflow-x-hidden overflow-y-hidden bg-gradient-to-br from-[#0a0a0f] via-[#111827] to-[#0f172a] relative">
            {/* Sticky Top Navbar with Glassmorphism */}
            <div className="sticky top-0 z-30 shadow-2xl border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <TopNavbar 
                    roomId={roomId} 
                    onRun={handleRunCode}
                    onCopy={handleCopyCode}
                    onFormat={handleFormatCode}
                    onLanguageChange={handleLanguageChange}
                    language={language}
                    activeUsers={activeUsers}
                    user={user}
                    logout={logout}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onOpenHistory={handleOpenHistory}
                />
            </div>
            {/* Main Content Area with Grid Alignment */}
            <div className="flex flex-col lg:flex-row flex-1 w-full h-full overflow-hidden min-w-0 p-0 gap-0">
                {/* Editor Area with Enhanced Styling */}
                <div className="flex-1 min-w-0 min-h-[300px] w-full h-full flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl border-r border-white/10 relative p-6 transition-all duration-300 custom-scrollbar rounded-r-2xl">
                    <div className="editor-container flex-1 min-w-0 w-full h-full flex flex-col">
                        <CodeEditor
                            ref={editorRef}
                            roomId={roomId}
                            username={username}
                            onExecutionResult={handleExecutionResult}
                            onActiveUsersChange={handleActiveUsersChange}
                            options={{ automaticLayout: true }}
                            language={language}
                        />
                    </div>
                    <div className="w-full mt-4">
                        <EditorPermissionStatus />
                    </div>
                </div>
                {/* Resize Handle */}
                {!terminalCollapsed && (
                    <div 
                        className="w-1 bg-slate-700/30 hover:bg-cyan-500/50 cursor-col-resize flex-shrink-0 transition-colors duration-200 relative group"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="absolute inset-0 w-2 -translate-x-0.5 group-hover:bg-cyan-500/20" />
                    </div>
                )}
                
                {/* Terminal Panel with Enhanced Styling */}
                <div 
                    className={`flex-shrink-0 bg-slate-900/95 border-l border-white/10 overflow-y-auto flex flex-col rounded-l-2xl shadow-2xl transition-all duration-300 min-w-0 custom-scrollbar relative ${
                        terminalCollapsed ? 'w-12' : ''
                    }`}
                    style={!terminalCollapsed ? { width: `${terminalWidth}px` } : {}}
                >
                    {/* Always Visible Toggle Button */}
                    <button 
                        onClick={() => {
                            setTerminalCollapsed(!terminalCollapsed);
                            // Trigger terminal re-fit when reopening
                            if (terminalCollapsed) {
                                setTimeout(() => {
                                    window.dispatchEvent(new Event('resize'));
                                }, 300); // Wait for transition to complete
                            }
                        }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-md bg-slate-700/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-200 flex items-center justify-center active:scale-95 group z-50 shadow-lg border border-slate-600/50"
                        title={terminalCollapsed ? "Expand terminal" : "Collapse terminal"}
                    >
                        <span className="text-sm font-bold transition-transform duration-200 group-hover:scale-110">{terminalCollapsed ? '▶' : '−'}</span>
                    </button>
                    
                    {/* Terminal Header with Enhanced Styling */}
                    <div className={`flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-white/10 rounded-tl-2xl transition-all duration-300 ${terminalCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                        <h3 className="text-slate-200 font-medium text-xs uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                            Terminal
                        </h3>
                    </div>
                    
                    <div className={`flex-1 p-4 transition-all duration-300 ${terminalCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <TerminalPanel
                            runCode={runCodeString}
                            language={language}
                            input={userInput}
                            className="mt-2"
                        />
                    </div>
                </div>
            </div>
        </div>
        
        {/* Code History Panel */}
        <CodeHistoryPanel
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            onLoadCode={handleLoadCode}
            getCurrentCode={() => editorRef.current?.getValue() || ""}
            currentLanguage={language}
        />
    </EditPermissionProvider>
</ProtectedRoute>
);
}

// Wrap the page in LanguageProvider
const EditorPageWithProvider = (props: any) => {
  return (
    <LanguageProvider>
      <EditorPage {...props} />
    </LanguageProvider>
  );
};

export default EditorPageWithProvider;