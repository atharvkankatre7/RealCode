"use client";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { EditPermissionProvider } from "@/context/EditPermissionContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <EditPermissionProvider>
            {children}
          </EditPermissionProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 