"use client";

import { AuthGate } from "@/components/auth/AuthGate";
import { Dashboard } from "@/components/Dashboard";
import { AuthProvider } from "@/hooks/useAuth";

export default function Home() {
  return (
    <AuthProvider>
      <AuthGate>
        <Dashboard />
      </AuthGate>
    </AuthProvider>
  );
}
