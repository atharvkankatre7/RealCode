"use client";
import { useEffect } from "react";

export default function HydrationSuppressor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress hydration warnings from browser extensions
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('hydration') || 
        message.includes('mismatch') ||
        message.includes('data-new-gr-c-s-check-loaded') ||
        message.includes('data-gr-ext-installed')
      ) {
        return;
      }
      originalError.apply(console, args);
    };
    
    console.warn = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('hydration') || 
        message.includes('mismatch') ||
        message.includes('data-new-gr-c-s-check-loaded') ||
        message.includes('data-gr-ext-installed')
      ) {
        return;
      }
      originalWarn.apply(console, args);
    };
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return <>{children}</>;
}
