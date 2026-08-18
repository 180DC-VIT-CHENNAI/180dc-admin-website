import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const { isDark, toggle: toggleTheme } = useTheme();

  const [status, setStatus] = useState<"loading" | "success" | "already" | "no-email" | "error">("loading");

  useEffect(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("no-email");
      return;
    }
    fetch(apiUrl(`/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`))
      .then((res) => {
        if (res.ok) {
          res.text().then((text) => {
            if (text.includes("Successfully")) setStatus("success");
            else if (text.includes("not currently") || text.includes("Already")) setStatus("already");
            else setStatus("success");
          });
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [email]);

  const messages = {
    loading: { title: "Unsubscribing...", desc: "Please wait while we process your request.", color: "var(--text-secondary)" },
    success: { title: "Successfully Unsubscribed", desc: "You have been unsubscribed from the 180DC newsletter. You will no longer receive newsletter emails from us.", color: "#22c55e" },
    already: { title: "Already Unsubscribed", desc: "You are not currently subscribed to the 180DC newsletter, or you have already unsubscribed.", color: "var(--text-secondary)" },
    "no-email": { title: "Invalid Request", desc: "No email address was provided. Please use the unsubscribe link from one of our emails.", color: "#ef4444" },
    error: { title: "Something Went Wrong", desc: "We couldn't process your unsubscribe request. Please try again later.", color: "#ef4444" },
  };

  const msg = messages[status];

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
      <div style={{ position: "absolute", top: 24, left: 24, display: "flex", gap: 10 }}>
        <a
          href="https://180dcvitc.org"
          style={{
            padding: "10px 16px", border: "1px solid var(--border-light)",
            background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer",
            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            boxShadow: "var(--shadow-sm)", textDecoration: "none", fontSize: 14, fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
          Home
        </a>
      </div>
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
        <div
          style={{
            background: "var(--bg-card)",
            padding: "2.5rem 2rem",
            borderRadius: 24,
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-lg)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: "50%",
              background: status === "success" ? "#22c55e" : "var(--accent)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 800, margin: "0 auto 1.25rem",
              boxShadow: status === "success"
                ? "0 4px 12px rgba(34,197,94,0.3)"
                : "0 4px 12px rgba(141, 198, 63, 0.3)",
            }}
          >
            {status === "loading" ? "..." : status === "success" || status === "already" ? "\u2713" : "!"}
          </div>

          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 8px", color: "var(--text-primary)" }}>
            {msg.title}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            {msg.desc}
          </p>

          {email && status !== "loading" && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 1.25rem" }}>
              {email}
            </p>
          )}

          <a
            href="https://180dcvitc.org"
            style={{
              display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff",
              textDecoration: "none", borderRadius: 50, fontSize: 13, fontWeight: 800,
              textTransform: "uppercase" as const, letterSpacing: 1,
            }}
          >
            Visit Website
          </a>
        </div>

        <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--text-tertiary)", fontSize: "13px" }}>
          &copy; 2026 180 Degrees Consulting. All rights reserved.
        </p>
      </div>
    </div>
  );
}
