"use client";

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isEditorRoute = /^\/editor\//.test(pathname ?? "");

  return (
    <>
      {!isEditorRoute && <Navbar />}
      <div className="w-full">
        {children}
      </div>
    </>
  );
}
