import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/react";

interface ClerkGateProps {
  afterSignOutUrl: string;
  children: ReactNode;
}

export default function ClerkGate({ afterSignOutUrl, children }: ClerkGateProps) {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
        <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Clerk Not Configured</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            VITE_CLERK_PUBLISHABLE_KEY is missing. Google login is unavailable.
          </p>
        </div>
      </div>
    );
  }
  return (
    <ClerkProvider publishableKey={key} afterSignOutUrl={afterSignOutUrl}>
      {children}
    </ClerkProvider>
  );
}
