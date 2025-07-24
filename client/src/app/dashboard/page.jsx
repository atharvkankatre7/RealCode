"use client"

import RoomForm from "@/components/RoomForm"
import { motion } from "framer-motion"
import { FiCode, FiUsers, FiClock, FiActivity } from "react-icons/fi"
import { useAuth } from "@/context/AuthContext"

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
}

const StatCard = ({ icon, title, value, color }) => {
  return (
    <motion.div
      className={`card p-8 flex flex-col items-center text-center bg-white/70 dark:bg-zinc-800/80 rounded-xl shadow-md transition-transform duration-200 hover:scale-105 hover:shadow-xl cursor-pointer border border-transparent hover:border-blue-400`}
      variants={fadeIn}
      whileHover={{ scale: 1.05 }}
    >
      <div className={`text-5xl mb-4 font-bold ${color}`}>{icon}</div>
      <h3 className="text-lg font-semibold mb-1 tracking-wide uppercase text-gray-700 dark:text-gray-200">{title}</h3>
      <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{value}</p>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <main className="w-full flex flex-col min-h-screen bg-white dark:bg-[#0e0e0e]">
      {/* Background elements */}
      <motion.div
        className="absolute inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-purple-900/10 dark:from-blue-900/20 dark:to-purple-900/20" />
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      </motion.div>

      <div className="max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Header Section */}
        <motion.div
          className="text-center mb-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1
            className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
            variants={fadeIn}
          >
            {user ? `Welcome, ${user.name || user.email}!` : 'Dashboard'}
          </motion.h1>

          <motion.p
            className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Start a new session or join an existing one.
          </motion.p>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <StatCard
            icon={<FiCode />}
            title="Active Sessions"
            value="12"
            color="text-blue-500"
          />

          <StatCard
            icon={<FiUsers />}
            title="Online Users"
            value="28"
            color="text-green-500"
          />

          <StatCard
            icon={<FiClock />}
            title="Avg. Session Time"
            value="42m"
            color="text-purple-500"
          />

          <StatCard
            icon={<FiActivity />}
            title="Code Changes"
            value="1.4k"
            color="text-orange-500"
          />
        </motion.div>

        {/* Room Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/10"
        >
          <RoomForm />
        </motion.div>
      </div>
    </main>
  )
}