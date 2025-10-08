"use client"

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

export type Language = string;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "javascript",
  setLanguage: () => null,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>("javascript");
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();
  
  // Get API URL from environment
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

  // Load language from backend on login/app load
  useEffect(() => {
    const fetchLanguage = async () => {
      const email = user?.email;
      if (!email) {
        setLanguage("javascript"); // Default if no user email
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/user/preferences?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.preferences && data.preferences.defaultLanguage) {
            setLanguage(data.preferences.defaultLanguage);
          } else {
            setLanguage("javascript"); // Fallback to default if no preference found
          }
        } else {
          console.warn('Failed to load language preference from backend:', res.status);
          setLanguage("javascript"); // Fallback on API error
        }
      } catch (err) {
        console.error('Error fetching language preference from backend:', err);
        setLanguage("javascript"); // Fallback on network error
      }
      setLoaded(true);
    };
    fetchLanguage();
  }, [user?.email]);

  // Save language to backend ONLY when user changes it
  const handleSetLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    const email = user?.email;
    if (!email) return;
    fetch(`${API_URL}/api/user/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, preferences: { defaultLanguage: newLanguage } }),
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {loaded && children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);