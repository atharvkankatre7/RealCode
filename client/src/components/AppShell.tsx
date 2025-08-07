"use client";

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HydrationSuppressor from './HydrationSuppressor';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditorRoute = /^\/editor\//.test(pathname ?? "");

  return (
    <>
      {!isEditorRoute && <Navbar />}
      <HydrationSuppressor>
        <div className="w-full">
          {children}
        </div>
      </HydrationSuppressor>
    </>
  );
}
