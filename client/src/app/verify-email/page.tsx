"use client"

import { motion } from "framer-motion"; // Ensure named imports
import Link from "next/link"

const VerifyEmailPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div
        className="w-full max-w-md p-8 bg-white/10 dark:bg-zinc-900/80 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-6">Email Verification</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          If you are signing up or logging in, please check your email for a verification code. Enter it in the signup/login form if prompted.
        </p>
        <Link href="/" className="text-blue-500 hover:text-blue-600 font-medium">
          Back to Home
        </Link>
      </motion.div>
    </div>
  )
}

export default VerifyEmailPage
