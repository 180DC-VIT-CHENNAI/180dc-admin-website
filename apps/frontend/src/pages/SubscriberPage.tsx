import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { apiUrl } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

export default function SubscriberPage() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress || "";

  const [subscribing, setSubscribing] = useState(false);
  const [subMsg, setSubMsg] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !email) return;
    setSubscribed(false);
    setSubMsg("");
  }, [isSignedIn, email]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribing(true);
    setSubMsg("");
    try {
      const res = await fetch(apiUrl("/api/newsletter/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSubMsg(data.message || (data.success ? "Subscribed!" : "Something went wrong"));
      if (data.success) setSubscribed(true);
    } catch {
      setSubMsg("Network error. Please try again.");
    }
    setSubscribing(false);
  };

  return (
    <div
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <button
        onClick={toggleTheme}
        style={{
          position: "absolute", top: 24, right: 24,
          padding: "10px", border: "1px solid var(--border-light)",
          background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer",
          borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--shadow-sm)",
        }}
        title="Toggle Theme"
      >
        <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
      </button>

      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: "var(--accent)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 800, margin: "0 auto 1rem",
              boxShadow: "0 4px 12px rgba(141, 198, 63, 0.3)",
            }}
          >
            180
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Subscribe to Newsletter</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginTop: "8px" }}>
            Get our latest newsletters delivered to your inbox.
          </p>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            padding: "2rem",
            borderRadius: 24,
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {!isSignedIn ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 1.25rem" }}>
                Sign in with your Google account to subscribe.
              </p>
              <button
                onClick={() => clerk.redirectToSignIn({ signInFallbackRedirectUrl: "/subscriber" })}
                className="btn outline"
                style={{ width: "100%", padding: "0.875rem", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: "15px" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--surface-container-low, rgba(0,0,0,0.03))", borderRadius: 12 }}>
                {user?.imageUrl && (
                  <img src={user.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.fullName || email}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {email}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubscribe}>
                <button
                  type="submit"
                  disabled={subscribing || subscribed}
                  className="btn"
                  style={{ width: "100%", padding: "0.875rem", borderRadius: 12, justifyContent: "center", fontSize: "15px" }}
                >
                  {subscribed ? "Subscribed!" : subscribing ? "Subscribing..." : "Subscribe"}
                </button>
              </form>

              {subMsg && (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
                  {subMsg}
                </p>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--text-tertiary)", fontSize: "13px" }}>
          &copy; 2026 180 Degrees Consulting. All rights reserved.
        </p>
      </div>
    </div>
  );
}
