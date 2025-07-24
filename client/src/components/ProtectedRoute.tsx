"use client"

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import toast from "react-hot-toast"

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in with Google
      toast.error("Please sign in to access this page")
      router.push("/login")
    }
  }, [user, loading, router])

  // Show nothing while checking authentication status
  if (loading) return null

  // If not authenticated, return null (redirect is handled in useEffect)
  if (!user) return null

  // If authenticated with Google, render children
  return <>{children}</>
}

export default ProtectedRoute
