import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./grid-pattern.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/context/AuthContext"
import { SocketProvider } from "@/context/SocketContext";
import Navbar from "@/components/Navbar"
import "react-toastify/dist/ReactToastify.css"
import { ToastContainer } from "react-toastify"
import ClientAnimatePresence from "@/components/ClientAnimatePresence";
import { ThemeProvider } from "@/context/ThemeContext"
import AppShell from '@/components/AppShell';
import { usePathname } from 'next/navigation';
import Providers from "@/components/Providers";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RealCode | Realtime Code Collaboration",
  description: "Realtime collaborative coding platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <Script
          id="suppress-hydration-errors"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.error = function(...args) {
                  const message = args[0]?.toString() || '';
                  if (
                    message.includes('hydration') || 
                    message.includes('mismatch') ||
                    message.includes('data-new-gr-c-s-check-loaded') ||
                    message.includes('data-gr-ext-installed') ||
                    message.includes('message channel closed') ||
                    message.includes('asynchronous response') ||
                    message.includes('A listener indicated an asynchronous response by returning true') ||
                    message.includes('chrome-extension://') ||
                    message.includes('moz-extension://') ||
                    message.includes('Extension context invalidated')
                  ) {
                    return;
                  }
                  originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const message = args[0]?.toString() || '';
                  if (
                    message.includes('hydration') || 
                    message.includes('mismatch') ||
                    message.includes('data-new-gr-c-s-check-loaded') ||
                    message.includes('data-gr-ext-installed') ||
                    message.includes('message channel closed') ||
                    message.includes('asynchronous response')
                  ) {
                    return;
                  }
                  originalWarn.apply(console, args);
                };
                
                // Suppress unhandled promise rejections from extensions
                window.addEventListener('unhandledrejection', function(event) {
                  const reason = event.reason?.toString() || '';
                  if (
                    reason.includes('message channel closed') ||
                    reason.includes('listener indicated an asynchronous response') ||
                    reason.includes('A listener indicated an asynchronous response by returning true') ||
                    reason.includes('chrome-extension://') ||
                    reason.includes('moz-extension://') ||
                    reason.includes('Extension context invalidated')
                  ) {
                    event.preventDefault();
                    return;
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className="bg-white dark:bg-[#0e0e0e]">
        <ClerkProvider>
          <Providers>
            <AppShell>
              <ClientAnimatePresence>
                <div className="w-full min-h-screen flex flex-col">
                  {children}
                </div>
              </ClientAnimatePresence>
            </AppShell>
            <ToastContainer
              position="bottom-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
