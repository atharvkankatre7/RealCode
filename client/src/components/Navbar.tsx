"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useTheme } from "@/context/ThemeContext"
import { useAuth } from "@/context/AuthContext"
import { useEditPermission } from "@/context/EditPermissionContext";
import { FiSun, FiMoon, FiMonitor, FiChevronDown, FiCode, FiUser, FiUsers } from "react-icons/fi"
import { usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

const Navbar = () => {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { users } = useEditPermission();
  const pathname = usePathname();
  const isEditorRoute = /^\/editor\//.test(pathname ?? "");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown]);

  const handleLogout = async () => {
    logout()
    router.push("/login")
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <>
      <motion.nav
        className="w-full bg-zinc-900 p-4 flex justify-between items-center text-white sticky top-0 z-50 glass"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
      >
        <motion.div
          className="flex items-center space-x-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FiCode className="text-2xl text-blue-400" />
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            RealCode
          </Link>
        </motion.div>

        {/* Theme Switcher and Help Icon (right) */}
        <div className="flex items-center space-x-4">
          {/* User List Dropdown - only on editor route */}
          {isEditorRoute && (
            <div className="relative">
              <button
                aria-label="Show users"
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow"
                onClick={() => setShowUserDropdown((v) => !v)}
                tabIndex={0}
              >
                <FiUsers className="text-lg text-blue-400" />
                <span className="font-medium text-white text-sm">{users.length}</span>
                <FiChevronDown className={`ml-1 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showUserDropdown && (
                <div ref={dropdownRef} className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 animate-fade-in">
                  <div className="px-4 py-2 text-xs text-gray-400 font-semibold border-b border-zinc-800">Active Users ({users.length})</div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800">
                    {users
                      .sort((a, b) => (a.role === 'teacher' ? -1 : 1))
                      .map((user) => (
                        <div
                          key={user.userId}
                          className={`flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 transition-colors ${user.role === 'teacher' ? 'border-l-4 border-blue-500 bg-blue-950/30' : ''}`}
                        >
                          <span className="text-xl">
                            {user.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                          </span>
                          <span className="font-medium text-white text-sm">{user.username}{user.userId === currentUserId ? ' (you)' : ''}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded text-xs font-semibold ${user.role === 'teacher' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>{user.role}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Animated Theme Toggle */}
          <div className="relative">
            <button
              aria-label="Theme switcher"
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={() => setThemeMenuOpen((v) => !v)}
              tabIndex={0}
              onBlur={() => setTimeout(() => setThemeMenuOpen(false), 150)}
            >
              <span className="relative w-6 h-6 flex items-center justify-center">
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="absolute"
                >
                  {theme === "light" && <FiSun className="text-yellow-400" />}
                  {theme === "dark" && <FiMoon className="text-indigo-400" />}
                  {theme === "system" && <FiMonitor className="text-green-400" />}
                </motion.span>
              </span>
              <FiChevronDown className="ml-1 text-gray-400" />
            </button>
            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-zinc-800 rounded-xl shadow-lg py-2 z-50 border border-zinc-700 animate-fade-in">
                <button
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left rounded-lg transition-colors ${theme === "light" ? "bg-zinc-700 text-yellow-400" : "text-gray-200 hover:bg-zinc-700"}`}
                  onClick={() => { setTheme("light"); setThemeMenuOpen(false); }}
                  aria-label="Light theme"
                >
                  <FiSun /> Light
                </button>
                <button
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left rounded-lg transition-colors ${theme === "dark" ? "bg-zinc-700 text-indigo-400" : "text-gray-200 hover:bg-zinc-700"}`}
                  onClick={() => { setTheme("dark"); setThemeMenuOpen(false); }}
                  aria-label="Dark theme"
                >
                  <FiMoon /> Dark
                </button>
                <button
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left rounded-lg transition-colors ${theme === "system" ? "bg-zinc-700 text-green-400" : "text-gray-200 hover:bg-zinc-700"}`}
                  onClick={() => { setTheme("system"); setThemeMenuOpen(false); }}
                  aria-label="System theme"
                >
                  <FiMonitor /> System
                </button>
              </div>
            )}
          </div>
          {/* Profile Icon (right) */}
          {user && (
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none"
              onClick={() => setShowProfilePanel((v) => !v)}
              title="Profile"
            >
              <FiUser className="text-xl text-white" />
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <motion.button
          className="md:hidden text-white"
          onClick={toggleMenu}
          whileTap={{ scale: 0.9 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </motion.button>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            className="absolute top-16 left-0 right-0 bg-zinc-900 p-4 md:hidden z-50 glass"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col space-y-4">
              {/* Theme Switcher */}
              <div className="flex justify-center space-x-4 py-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTheme("light")}
                  className={`p-2 rounded-full ${theme === "light" ? "bg-yellow-400 text-yellow-900" : "text-gray-400"}`}
                >
                  <FiSun />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTheme("dark")}
                  className={`p-2 rounded-full ${theme === "dark" ? "bg-indigo-600 text-white" : "text-gray-400"}`}
                >
                  <FiMoon />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setTheme("system")}
                  className={`p-2 rounded-full ${theme === "system" ? "bg-green-500 text-white" : "text-gray-400"}`}
                >
                  <FiMonitor />
                </motion.button>
              </div>

              {user ? (
                <>
                  <div className="text-center py-2 border-t border-zinc-800">
                    <span className="text-sm">Hello, {user.email}</span>
                  </div>
                  <motion.button
                    onClick={handleLogout}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-600 py-2 rounded-md font-medium"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Logout
                  </motion.button>
                </>
              ) : (
                <>
                  <Link href="/login" className="w-full text-center py-2 rounded-md border border-blue-500 text-blue-500">
                    Login
                  </Link>
                  <Link href="/signup" className="w-full text-center py-2 rounded-md bg-blue-600 text-white">
                    Signup
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </motion.nav>
      {user && showProfilePanel && (
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={showProfilePanel ? { x: 0, opacity: 1 } : { x: 100, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed right-2 top-20 w-60 bg-slate-900 p-4 rounded-xl shadow-lg text-white z-50 flex flex-col gap-3 items-start"
          style={{ pointerEvents: showProfilePanel ? 'auto' : 'none' }}
        >
          <div className="flex items-center gap-3">
            <FiUser className="text-2xl bg-blue-700 rounded-full p-1" />
            <div>
              <div className="font-semibold text-lg truncate max-w-[140px]">{user.email}</div>
              <div className="text-xs text-gray-400 mt-1">{user.role === 'teacher' ? 'Teacher' : 'Student'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-600 text-white hover:bg-red-700 transition-colors"
          >Logout</button>
        </motion.div>
      )}
    </>
  )
}

export default Navbar
