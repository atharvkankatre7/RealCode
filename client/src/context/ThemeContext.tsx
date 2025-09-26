"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => null,
  toggleTheme: () => null,
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark")
  const [loaded, setLoaded] = useState(false)
  const { user } = useAuth()

  // Load theme from backend on login/app load
  useEffect(() => {
    console.log('👤 ThemeContext: user changed:', user?.email);
    const fetchTheme = async () => {
      const email = user?.email;
      if (!email) {
        console.log('🌙 No user email, setting default theme: dark');
        setTheme("dark"); // Default if no user email
        setLoaded(true);
        return;
      }
      try {
        console.log('🔍 Fetching theme preference for email:', email);
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/preferences?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          console.log('📥 Received preferences data:', data);
          if (data.preferences && data.preferences.theme) {
            console.log('✅ Setting theme from backend:', data.preferences.theme);
            setTheme(data.preferences.theme);
          } else {
            console.log('⚠️ No theme preference found, using default: dark');
            setTheme("dark"); // Fallback to default if no preference found
          }
        } else {
          console.warn('❌ Failed to load theme preference from backend:', res.status);
          setTheme("dark"); // Fallback on API error
        }
      } catch (err) {
        console.error('❌ Error fetching theme preference from backend:', err);
        setTheme("dark"); // Fallback on network error
      }
      setLoaded(true);
    };
    fetchTheme();
  }, [user?.email]);

  // Save theme to backend ONLY when user changes it
  const handleSetTheme = (newTheme: Theme) => {
    console.log('🎨 Setting theme to:', newTheme);
    setTheme(newTheme);
    
    // Immediately apply theme to HTML element
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
    console.log('✅ Applied theme class to HTML:', newTheme);
    
    const email = user?.email;
    if (!email) return;
    
    console.log('🎨 Saving theme preference to backend:', { email, theme: newTheme });
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, preferences: { theme: newTheme } }),
    }).then(response => {
      if (response.ok) {
        console.log('✅ Theme preference saved successfully');
      } else {
        console.error('❌ Failed to save theme preference:', response.status);
      }
    }).catch(err => {
      console.warn('Failed to save theme preference to backend:', err);
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log('🔄 Toggling theme from', theme, 'to', newTheme);
    handleSetTheme(newTheme);
  };

  // Update <html> class on theme change
  useEffect(() => {
    if (!loaded) return;
    console.log('🔄 Applying theme to HTML element:', theme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    console.log('✅ Theme applied to HTML element:', theme);
  }, [theme, loaded]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme }}>
      {loaded && children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext)
