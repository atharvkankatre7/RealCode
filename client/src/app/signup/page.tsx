"use client"

import { SignUp } from "@clerk/nextjs"

export default function SignupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <SignUp appearance={{
        elements: {
          formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white",
          card: "bg-white/10 dark:bg-zinc-900/80 backdrop-blur-lg border border-white/10",
          headerTitle: "text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent",
          headerSubtitle: "text-gray-500 dark:text-gray-400",
          socialButtonsIconButton: "bg-white dark:bg-zinc-800 text-gray-700 dark:text-white border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
        }
      }} />
    </div>
  )
}
