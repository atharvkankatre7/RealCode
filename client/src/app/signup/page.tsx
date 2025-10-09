"use client"

import { SignUp } from "@clerk/nextjs"

export default function SignupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md mb-4 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
          🚀 Join RealCode and start coding collaboratively!
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs">
          After signup, you'll be automatically logged in and ready to code.
        </p>
      </div>
      <SignUp 
        afterSignUpUrl="/"
        appearance={{
          elements: {
            formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white",
            card: "bg-white/10 dark:bg-zinc-900/80 backdrop-blur-lg border border-white/10",
            headerTitle: "text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent",
            headerSubtitle: "text-gray-500 dark:text-gray-400",
            socialButtonsIconButton: "bg-white dark:bg-zinc-800 text-gray-700 dark:text-white border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700",
            footerActionText: "text-gray-500 dark:text-gray-400",
            footerActionLink: "text-blue-500 hover:text-blue-600 font-medium"
          }
        }} 
      />
      <div className="w-full max-w-md mt-4 text-center">
        <p className="text-gray-400 dark:text-gray-500 text-xs">
          💡 Pro tip: Google sign-in also works from the login page!
        </p>
      </div>
    </div>
  )
}
