"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { useUser, useClerk, useSignIn, useSignUp } from "@clerk/nextjs"

// Define the User type for our auth system
interface User {
  email: string;
  name?: string;
  photoURL?: string;
  role?: string; // Added role property
}

// Define the AuthContext type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<any>;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpWithEmail: (email: string, password: string, name?: string, verificationCode?: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  signInWithGoogle: async () => ({}),
  signInWithEmail: async () => ({}),
  signUpWithEmail: async () => ({})
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true)
  const { isLoaded: clerkLoaded, user: clerkUser, isSignedIn } = useUser()
  const { signOut, setActive } = useClerk()
  const { signIn, isLoaded: signInLoaded } = useSignIn()
  const { signUp, isLoaded: signUpLoaded } = useSignUp()

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (clerkLoaded) {
      if (isSignedIn && clerkUser) {
        const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress
        if (primaryEmail) {
          // Create user in backend database
          const createUserInBackend = async () => {
            try {
              const response = await fetch('http://localhost:5002/api/auth/clerk', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: primaryEmail,
                  name: clerkUser.fullName || clerkUser.username || primaryEmail.split('@')[0],
                  clerkId: clerkUser.id,
                  picture: clerkUser.imageUrl
                })
              });
              
              if (response.ok) {
                console.log('User created/updated in backend database');
              } else {
                console.error('Failed to create user in backend:', await response.text());
              }
            } catch (error) {
              console.error('Error creating user in backend:', error);
            }
          };
          
          createUserInBackend();
          
          const userData = {
            email: primaryEmail,
            name: clerkUser.fullName || clerkUser.username || primaryEmail.split('@')[0],
            photoURL: clerkUser.imageUrl,
            role: typeof clerkUser.publicMetadata?.role === 'string' ? clerkUser.publicMetadata.role : "student" // Ensure role is a string
          };
          console.log('👤 AuthContext: Setting user:', userData);
          setUser(userData);
        }
              } else {
          console.log('👤 AuthContext: Setting user to null');
          setUser(null)
        }
      setLoading(false)
    }
  }, [clerkLoaded, clerkUser, isSignedIn])

  const signInWithGoogle = async () => {
    if (!signInLoaded) return { success: false, error: "Auth not loaded" }
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: window.location.origin + "/sso-callback",
        redirectUrlComplete: window.location.origin + "/"
      })
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!signInLoaded) return { success: false, error: "Auth not loaded" }
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        return { success: true }
      } else {
        return { success: false, error: "Sign-in failed", nextStep: result.status }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const signUpWithEmail = async (email: string, password: string, name?: string, verificationCode?: string) => {
    if (!signUpLoaded) return { success: false, error: "Auth not loaded" }
    try {
      if (verificationCode) {
        const result = await signUp.attemptEmailAddressVerification({ code: verificationCode })
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId })
          return { success: true }
        } else {
          return { success: false, error: "Invalid or expired code", nextStep: result.status }
        }
      }
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName: name ? name.split(' ')[0] : undefined,
        lastName: name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : undefined,
      })
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        return { success: true }
      } else {
        return { success: false, error: "Verification required", nextStep: result.status }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const logout = async () => {
    try {
      await signOut()
      setUser(null)
    } catch (error) {}
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || !clerkLoaded,
      logout,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
