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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://realcode.app';
const siteName = 'RealCode';
const siteDescription = 'Real-time collaborative coding platform with multi-language support. Code together with your team from anywhere in the world. Share, edit, and collaborate on code in real-time.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | Realtime Code Collaboration`,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  keywords: [
    'collaborative coding',
    'real-time code editor',
    'pair programming',
    'code collaboration',
    'online code editor',
    'team coding',
    'live coding',
    'code sharing',
    'programming collaboration',
    'multi-language editor',
    'JavaScript',
    'Python',
    'TypeScript',
    'Java',
    'C++',
    'code editor',
    'web development',
    'software development'
  ],
  authors: [{ name: 'RealCode Team' }],
  creator: 'RealCode',
  publisher: 'RealCode',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: `${siteName} | Realtime Code Collaboration`,
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${siteName} - Realtime Code Collaboration`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} | Realtime Code Collaboration`,
    description: siteDescription,
    images: [`${siteUrl}/og-image.png`],
    creator: '@realcode',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' }
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: siteName
  },
  category: 'technology',
  classification: 'Software Development Tool',
  other: {
    'application-name': siteName,
    'msapplication-TileColor': '#0a0a0f',
    'msapplication-config': '/browserconfig.xml',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    description: siteDescription,
    url: siteUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    featureList: [
      'Real-time collaborative coding',
      'Multi-language support',
      'Live code synchronization',
      'Team collaboration',
      'Code sharing',
      'Online code editor'
    ],
    author: {
      '@type': 'Organization',
      name: siteName
    }
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
