"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import { motion } from "framer-motion"
import Link from "next/link"
import { FcGoogle } from "react-icons/fc"
import { FiMail, FiLock } from "react-icons/fi"
import { useAuth } from "@/context/AuthContext"

const LoginPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signInWithGoogle, signInWithEmail } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [pendingVerification, setPendingVerification] = useState(false)
  const [pendingEmail, setPendingEmail] = useState("")

  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("error")) {
      toast.error("SSO verification failed. Please try again.")
    }
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await signInWithEmail(email, password)
      if (result.success) {
        toast.success("Signed in successfully!")
        router.push("/")
      } else if (result.notFound) {
        toast.error("No account found with this email. Redirecting to sign up...")
        setTimeout(() => router.push("/signup"), 1500)
      } else if (result.nextStep || (result.error && result.error.toLowerCase().includes("verification"))) {
        setPendingVerification(true)
        setPendingEmail(email)
        toast.success("Please check your email for a verification code")
      } else {
        toast.error(result.error || "Failed to sign in")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during sign in")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Use Clerk's API to verify email address
      // This logic can be implemented in AuthContext if needed
      toast.success("Verification step (implement as needed)")
      setPendingVerification(false)
      router.push("/")
    } catch (err: any) {
      toast.error(err.message || "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <motion.div
        className="w-full max-w-md p-8 bg-white/10 dark:bg-zinc-900/80 rounded-2xl shadow-2xl backdrop-blur-lg border border-white/10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-4">Welcome Back</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          New user? No problem! Google sign-in will automatically create your account.
        </p>
        {pendingVerification ? (
          <motion.form onSubmit={handleVerifyCode} className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiMail className="text-gray-400" /></div>
                <input type="text" placeholder="Enter verification code" className="w-full pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} required />
              </div>
            </div>
            <motion.button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {loading ? (<><div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin" />Verifying...</>) : ("Verify")}
            </motion.button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => setPendingVerification(false)} className="text-blue-500 hover:text-blue-600 text-sm font-medium">Back to login</button>
            </div>
          </motion.form>
        ) : showEmailForm ? (
          <motion.form onSubmit={handleEmailSignIn} className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiMail className="text-gray-400" /></div>
                <input type="email" placeholder="Email" className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiLock className="text-gray-400" /></div>
                <input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <motion.button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {loading ? (<><div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin" />Signing in...</>) : ("Sign in")}
            </motion.button>
            <div className="text-center mt-4">
              <button type="button" onClick={() => setShowEmailForm(false)} className="text-blue-500 hover:text-blue-600 text-sm font-medium">Back to options</button>
            </div>
          </motion.form>
        ) : (
          <div className="space-y-4 pt-4">
            <motion.button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 bg-white dark:bg-zinc-800 text-gray-700 dark:text-white rounded-lg font-medium flex items-center justify-center gap-2 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <FcGoogle className="text-xl" />Continue with Google
            </motion.button>
            <div className="flex items-center my-2">
              <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-sm">or</span>
              <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <motion.button type="button" onClick={() => setShowEmailForm(true)} disabled={loading} className="w-full py-3 bg-transparent text-gray-700 dark:text-white rounded-lg font-medium flex items-center justify-center gap-2 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <FiMail className="text-gray-500" />Sign in with Email
            </motion.button>
          </div>
        )}
        <div className="pt-4 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Need to create an account? <Link href="/signup" className="text-blue-500 hover:text-blue-600 font-medium">Sign up with email</Link>
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
            (Google sign-in works for both new and existing accounts)
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
