"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => null,
  toggleTheme: () => null,
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("system")
  const [mounted, setMounted] = useState(false)

  // Set theme on mount from localStorage or system
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as Theme | null
    if (storedTheme) {
      setTheme(storedTheme)
    } else {
      setTheme("system")
    }
    setMounted(true)
  }, [])

  // Update <html> class and localStorage on theme change
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else if (theme === 'light') {
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      // system
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');
      localStorage.removeItem('theme');
    }
    // Debug: print current html classList
    console.log('Theme set:', root.classList.value);
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    handleSetTheme(newTheme);
  };

  // Add smooth transition support for theme change
  useEffect(() => {
    const root = window.document.documentElement;
    root.style.transition = 'background-color 0.3s, color 0.3s';
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme }}>
      {mounted && children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
