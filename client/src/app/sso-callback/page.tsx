"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useClerk } from "@clerk/nextjs"
import { motion } from "framer-motion"

export default function SSOCallback() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { handleRedirectCallback } = useClerk()

  useEffect(() => {
    async function processCallback() {
      try {
        await handleRedirectCallback({ redirectUrl: "/" })
        router.push("/")
      } catch (error) {
        router.push("/login?error=sso-verification-failed")
      }
    }
    if (isLoaded) {
      if (isSignedIn) {
        router.push("/")
      } else {
        processCallback()
      }
    }
  }, [isLoaded, isSignedIn, router, handleRedirectCallback])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div
        className="w-full max-w-md p-8 bg-white/10 dark:bg-zinc-900/80 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Completing Authentication
        </h1>
        <div className="flex justify-center my-8">
          <div className="w-12 h-12 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          Please wait while we complete your authentication...
        </p>
      </motion.div>
    </div>
  )
}
