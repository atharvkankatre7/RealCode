"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { auth } from "@/lib/firebase/config"
import { toast } from "react-hot-toast"

const SignupForm = () => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCred.user, { displayName: name })

      toast.success("Signup successful!")
      router.push("/dashboard") // Redirect to dashboard after signup
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="p-2 border rounded w-64"
      />
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 border rounded w-64"
      />
      <input
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 border rounded w-64"
      />
      <button
        onClick={handleSignup}
        className="p-2 bg-blue-500 text-white rounded mt-4"
      >
        Sign Up
      </button>
    </div>
  )
}

export default SignupForm
