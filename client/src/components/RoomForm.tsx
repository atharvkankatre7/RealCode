"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { motion } from "framer-motion"
import { FiPlus, FiLogIn, FiUser, FiHash, FiCopy, FiShare2, FiInfo } from "react-icons/fi"
import SocketService from "../services/socketService"
import { useAuth } from "@/context/AuthContext"

const RoomForm = () => {
  const [createUsername, setCreateUsername] = useState("")
  const [createRoomId, setCreateRoomId] = useState("")
  const [joinUsername, setJoinUsername] = useState("")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [generatedRoomId, setGeneratedRoomId] = useState("")
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create')
  const [showTooltip, setShowTooltip] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  // Get the singleton instance of SocketService
  const socketService = SocketService.getInstance()

  // Load username from localStorage if available
  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    if (storedUsername) {
      setCreateUsername(storedUsername)
      setJoinUsername(storedUsername)
    }

    // Generate a random room ID for quick access
    setGeneratedRoomId(Math.random().toString(36).substring(2, 11))
  }, [])

  // Function to validate username
  const validateUsername = () => {
    if (!createUsername) {
      toast.error("Username is required")
      return false
    }

    return true
  }

  // Function to copy room ID to clipboard
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopySuccess(true)
          toast.success("Room ID copied to clipboard!")
          setTimeout(() => setCopySuccess(false), 2000)
        })
        .catch(err => {
          console.error('Failed to copy:', err)
          toast.error("Failed to copy room ID")
        })
    }
  }

  // Function to share room link
  const shareRoomLink = (roomIdToShare: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Join my RealCode room',
        text: `Join my collaborative coding session with room ID: ${roomIdToShare}`,
        url: `${window.location.origin}/editor/${roomIdToShare}`,
      })
      .catch(err => {
        console.error('Failed to share:', err)
        toast.error("Failed to share room link")
      })
    } else {
      copyToClipboard(`${window.location.origin}/editor/${roomIdToShare}`)
    }
  }

  const createRoom = async () => {
    if (!validateUsername()) return

    if (!user) {
      toast.error("You must be logged in to create a room. Please log in first.")
      return
    }

    setIsLoading(true)
    localStorage.setItem("username", createUsername)
    console.log(`Storing username in localStorage for create room: ${createUsername}`)

    try {
      const roomIdToCreate = createRoomId.trim() || Math.random().toString(36).substring(2, 11)
      console.log("Creating room with ID:", roomIdToCreate)

      // Make sure socket is connected (with increased timeout and better error handling)
      if (!socketService.isConnected()) {
        console.log('Socket not connected, attempting to connect...');
        try {
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              socketService.connect();
              const checkConnection = () => {
                if (socketService.isConnected()) {
                  resolve();
                } else {
                  setTimeout(checkConnection, 100);
                }
              };
              checkConnection();
              // Fallback timeout
              setTimeout(() => reject(new Error('Socket connection timeout')), 15000);
            })
          ]);
          console.log('Socket connected successfully');
        } catch (connectionError) {
          console.error('Failed to connect to server:', connectionError);
          toast.error('Failed to connect to server. Please check your internet connection and try again.');
          setIsLoading(false)
          return;
        }
      }

      const { roomId: createdRoomId } = await socketService.createRoom(createUsername, roomIdToCreate)
      toast.success(`Created new room: ${createdRoomId}`)
      router.push(`/editor/${createdRoomId}`)
    } catch (error: any) {
      console.error("Error creating room:", error)
      const errorMessage = error.message || "Failed to create room. Please try again."
      toast.error(errorMessage)
      setIsLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!validateUsername()) return
    if (!joinRoomId.trim()) {
      toast.error("Room ID is required to join a room")
      return
    }
    if (!user) {
      toast.error("You must be logged in to join a room. Please log in first.")
      return
    }
    setIsLoading(true)
    localStorage.setItem("username", joinUsername)
    console.log(`Storing username in localStorage for join room: ${joinUsername}`)
    try {
      const roomIdToJoin = joinRoomId.trim()
      console.log("Joining room:", roomIdToJoin)
      
      // Make sure socket is connected (with better error handling)
      if (!socketService.isConnected()) {
        console.log('Socket not connected, attempting to connect...');
        try {
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              socketService.connect();
              const checkConnection = () => {
                if (socketService.isConnected()) {
                  resolve();
                } else {
                  setTimeout(checkConnection, 100);
                }
              };
              checkConnection();
              // Fallback timeout
              setTimeout(() => reject(new Error('Socket connection timeout')), 15000);
            })
          ]);
          console.log('Socket connected successfully');
        } catch (connectionError) {
          console.error('Failed to connect to server:', connectionError);
          toast.error('Failed to connect to server. Please check your internet connection and try again.');
          setIsLoading(false)
          return;
        }
      }

      const response = await socketService.validateRoom(roomIdToJoin)
      if (!response.exists) {
        toast.error("Room does not exist. Please check the Room ID and try again.")
        setIsLoading(false)
        return
      }

      router.push(`/editor/${roomIdToJoin}`)
    } catch (error: any) {
      console.error("Error joining room:", error)
      const errorMessage = error.message || "Failed to join room. Please check the Room ID and try again."
      toast.error(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.h2
        className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent flex items-center justify-center gap-2 relative"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Create or Join a Coding Room
        <span
          className="ml-2 cursor-pointer relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip((v) => !v)}
        >
          <FiInfo className="text-lg text-blue-400 hover:text-blue-600 transition-colors" />
          {showTooltip && (
            <span className="absolute left-1/2 -translate-x-1/2 top-8 z-20 w-64 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 text-sm rounded-lg shadow-lg px-4 py-3 border border-blue-200 dark:border-zinc-700 font-normal">
              A Room is a collaborative coding space.<br />You can create a new room or join an existing one using its Room ID.
            </span>
          )}
        </span>
      </motion.h2>

      {/* Tabs UI */}
      <div className="flex justify-center mb-8">
        <button
          className={`px-6 py-2 rounded-t-lg font-semibold focus:outline-none transition-all border-b-2 ${activeTab === 'create' ? 'border-blue-600 text-blue-600 bg-white dark:bg-zinc-900' : 'border-transparent text-gray-500 bg-gray-100 dark:bg-zinc-800'}`}
          onClick={() => setActiveTab('create')}
        >
          <FiPlus className="inline mr-2" /> Create Room
        </button>
        <button
          className={`px-6 py-2 rounded-t-lg font-semibold focus:outline-none transition-all border-b-2 ${activeTab === 'join' ? 'border-blue-600 text-blue-600 bg-white dark:bg-zinc-900' : 'border-transparent text-gray-500 bg-gray-100 dark:bg-zinc-800'}`}
          onClick={() => setActiveTab('join')}
        >
          <FiLogIn className="inline mr-2" /> Join Room
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-b-xl rounded-tr-xl shadow-lg p-6">
        {activeTab === 'create' && (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <FiPlus className="text-blue-500" /> Create New Room
            </h3>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiUser className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Your username"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                autoFocus
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiHash className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Optional Room ID"
                value={createRoomId}
                onChange={(e) => setCreateRoomId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              />
            </div>

            <motion.button
              onClick={createRoom}
              disabled={isLoading}
              className={`w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileHover={{ scale: isLoading ? 1 : 1.02, boxShadow: isLoading ? 'none' : "0 10px 25px -5px rgba(59, 130, 246, 0.5)" }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <FiPlus />
                  Create New Room
                </>
              )}
            </motion.button>
          </motion.div>
        )}
        {activeTab === 'join' && (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <FiLogIn className="text-blue-500" /> Join Existing Room
            </h3>

            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Your username"
                  value={joinUsername}
                  onChange={(e) => setJoinUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiHash className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                />
              </div>
            </div>

            <motion.button
              onClick={joinRoom}
              disabled={isLoading}
              className={`w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              whileHover={{ scale: isLoading ? 1 : 1.02, boxShadow: isLoading ? 'none' : "0 10px 25px -5px rgba(34, 197, 94, 0.5)" }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Joining...
                </>
              ) : (
                <>
                  <FiLogIn />
                  Join Room
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Recently Created Room Section */}
      <motion.div
        className="mt-8 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/5 dark:bg-zinc-800/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiShare2 className="text-purple-500" /> Recently Generated Room
        </h3>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-zinc-800 px-3 py-2 rounded-lg font-mono text-sm overflow-hidden text-ellipsis">
            {generatedRoomId}
          </div>

          <motion.button
            onClick={() => copyToClipboard(generatedRoomId)}
            className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Copy Room ID"
          >
            <FiCopy size={18} />
          </motion.button>

          <motion.button
            onClick={() => shareRoomLink(generatedRoomId)}
            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Share Room Link"
          >
            <FiShare2 size={18} />
          </motion.button>
        </div>

        <div className="mt-2 flex justify-center">
          <motion.button
            onClick={async () => {
              if (!user) {
                toast.error("You must be logged in to join a room. Please log in first.");
                return;
              }
              if (validateUsername()) {
                setJoinRoomId(generatedRoomId);
                // Use the current username for joining
                const usernameToUse = createUsername || joinUsername;
                if (usernameToUse) {
                  setJoinUsername(usernameToUse);
                  localStorage.setItem("username", usernameToUse);
                  router.push(`/editor/${generatedRoomId}`);
                } else {
                  toast.error("Please enter a username first");
                }
              }
            }}
            disabled={isLoading}
            className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            whileHover={{ scale: isLoading ? 1 : 1.05 }}
            whileTap={{ scale: isLoading ? 1 : 0.95 }}
          >
            {isLoading ? 'Joining...' : 'Join This Room'}
          </motion.button>
        </div>

        <p className="mt-2 text-center text-gray-500 dark:text-gray-400 text-sm">
          Share this Room ID with your team members to collaborate in real-time.
        </p>
      </motion.div>
    </div>
  )
}

export default RoomForm