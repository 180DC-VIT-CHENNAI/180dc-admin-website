import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { apiUrl } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

const serifAccent: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontStyle: "italic",
  fontWeight: 400,
  color: "var(--primary-green)",
};

function HomePill() {
  const [hover, setHover] = useState(false);
  return (
    <a
      href="https://180dcvitc.org"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute", top: 24, left: 24, zIndex: 2,
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "9px 18px", borderRadius: 999,
        border: `1px solid ${hover ? "var(--border-green)" : "var(--border-light)"}`,
        background: "var(--bg-card)",
        color: hover ? "var(--primary-green)" : "var(--text-secondary)",
        cursor: "pointer", textDecoration: "none",
        fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em",
        boxShadow: "var(--shadow-sm)",
        transition: `all 250ms ${EASE}`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>home</span>
      Home
    </a>
  );
}

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Toggle Theme"
      aria-label="Toggle Theme"
      style={{
        position: "absolute", top: 24, right: 24, zIndex: 2,
        width: 42, height: 42, borderRadius: "50%",
        border: `1px solid ${hover ? "var(--border-green)" : "var(--border-light)"}`,
        background: "var(--bg-card)",
        color: hover ? "var(--primary-green)" : "var(--text-primary)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "var(--shadow-sm)",
        transition: `all 250ms ${EASE}`,
      }}
    >
      <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
    </button>
  );
}

function OfficialLogo({ isDark }: { isDark: boolean }) {
  return (
    <img
      src="/images/official-logo.png"
      alt="180 Degrees Consulting"
      style={{
        width: 56, height: 56, objectFit: "contain",
        display: "block", margin: "0 auto",
        filter: isDark ? "brightness(0) invert(1)" : "none",
      }}
    />
  );
}

function PrimaryButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = !disabled;
  return (
    <button
      type="submit"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => active && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", padding: "13px 24px",
        background: hover && active ? "var(--accent-hover)" : "var(--accent)",
        color: "#ffffff", border: "none", borderRadius: 12,
        fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
        cursor: active ? "pointer" : "default",
        opacity: disabled ? 0.55 : 1,
        transform: pressed ? "scale(0.98)" : hover && active ? "translateY(-1px)" : "none",
        boxShadow: hover && active ? "0 8px 24px var(--accent-glow)" : "0 4px 12px var(--accent-glow)",
        transition: `all 250ms ${EASE}`,
      }}
    >
      {children}
    </button>
  );
}

function GoogleButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", padding: "13px 24px", borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        border: `1px solid ${hover ? "var(--border-green)" : "var(--border-light)"}`,
        background: hover ? "var(--accent-soft)" : "transparent",
        color: hover ? "var(--primary-green)" : "var(--text-primary)",
        fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
        cursor: "pointer",
        transition: `all 250ms ${EASE}`,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Sign in with Google
    </button>
  );
}

export default function SubscriberPage() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress || "";

  const [subscribing, setSubscribing] = useState(false);
  const [subStep, setSubStep] = useState("");
  const [subMsg, setSubMsg] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [switchHover, setSwitchHover] = useState(false);

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
      setSubStep("Validating account...");
      await new Promise((r) => setTimeout(r, 400));
      setSubStep("Confirming email address...");
      await new Promise((r) => setTimeout(r, 300));
      setSubStep("Subscribing to newsletter...");
      const res = await fetch(apiUrl("/api/newsletter/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubStep("Processing...");
      const data = await res.json();
      setSubStep("");
      setSubMsg(data.message || (data.success ? "Subscribed!" : "Something went wrong"));
      if (data.success) setSubscribed(true);
    } catch {
      setSubStep("");
      setSubMsg("Network error. Please try again.");
    }
    setSubscribing(false);
  };

  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-primary)",
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5.5rem 1.5rem 3.5rem",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Atmosphere: soft green-tinted glow + concentric rings */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: 560, height: 560, borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", right: -160, bottom: -240,
          width: 520, height: 520, borderRadius: "50%",
          border: "1px solid var(--border-light)", pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", right: -280, bottom: -360,
          width: 780, height: 780, borderRadius: "50%",
          border: "1px solid var(--border-light)", pointerEvents: "none",
        }}
      />

      <HomePill />
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 440, width: "100%" }}>
        <div style={{ marginBottom: 28 }}>
          <OfficialLogo isDark={isDark} />
        </div>

        <div
          style={{
            position: "relative",
            background: "var(--bg-card)",
            padding: "40px 36px 36px",
            borderRadius: 24,
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-lg)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "inline-block", marginBottom: 16,
              padding: "5px 14px", borderRadius: 999,
              background: "var(--accent-soft)", color: "var(--primary-green)",
              fontSize: "0.6875rem", fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
            }}
          >
            Newsletter
          </span>

          <h1
            style={{
              fontSize: "clamp(1.625rem, 4vw, 2rem)",
              fontWeight: 300, lineHeight: 1.12, letterSpacing: "-0.02em",
              margin: "0 0 12px", color: "var(--text-primary)",
            }}
          >
            Subscribe to our <em style={serifAccent}>newsletter</em>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)", fontSize: 15, fontWeight: 300,
              lineHeight: 1.65, margin: "0 auto 28px", maxWidth: 320,
            }}
          >
            Get our latest newsletters delivered to your inbox.
          </p>

          {!isSignedIn ? (
            <GoogleButton
              onClick={() =>
                clerk.redirectToSignIn({ signInFallbackRedirectUrl: "/subscriber" })
              }
            />
          ) : (
            <div>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 14,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-light)",
                }}
              >
                {user?.imageUrl && (
                  <img
                    src={user.imageUrl}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {user?.fullName || email}
                  </div>
                  <div
                    style={{
                      fontSize: 12, color: "var(--text-tertiary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {email}
                  </div>
                </div>
                <button
                  onClick={() =>
                    clerk.signOut().then(() =>
                      clerk.redirectToSignIn({ signInFallbackRedirectUrl: "/subscriber" })
                    )
                  }
                  onMouseEnter={() => setSwitchHover(true)}
                  onMouseLeave={() => setSwitchHover(false)}
                  style={{
                    padding: "6px 14px", fontSize: 12, fontWeight: 600,
                    flexShrink: 0, cursor: "pointer", borderRadius: 999,
                    background: switchHover ? "var(--accent-soft)" : "transparent",
                    border: `1px solid ${switchHover ? "var(--border-green)" : "var(--border-light)"}`,
                    color: switchHover ? "var(--primary-green)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    transition: `all 250ms ${EASE}`,
                  }}
                >
                  Switch
                </button>
              </div>

              <form onSubmit={handleSubscribe} style={{ marginTop: 16 }}>
                <PrimaryButton disabled={subscribing || subscribed}>
                  {subscribed ? "Subscribed!" : subscribing ? subStep || "Processing..." : "Subscribe"}
                </PrimaryButton>
              </form>

              {subscribing && subStep && (
                <div
                  style={{
                    margin: "16px 0 0", display: "flex",
                    alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 14, height: 14,
                      border: "2px solid var(--border-light)", borderTopColor: "var(--accent)",
                      borderRadius: "50%", animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{subStep}</span>
                </div>
              )}

              {subMsg && (
                <p
                  style={{
                    margin: "16px 0 0", fontSize: 13, lineHeight: 1.6,
                    color: "var(--text-secondary)", textAlign: "center",
                  }}
                >
                  {subMsg}
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, padding: "0 6px" }}>
          <p
            style={{
              margin: "0 0 8px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--text-tertiary)",
            }}
          >
            Terms &amp; Conditions
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            <li style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.7, color: "var(--text-tertiary)" }}>
              By subscribing, you consent to receive newsletter communications from 180 Degrees Consulting via email.
            </li>
            <li style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.7, color: "var(--text-tertiary)" }}>
              You also agree to receive updates about events conducted by 180 Degrees Consulting, including workshops,
              seminars, and promotional events.
            </li>
            <li style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.7, color: "var(--text-tertiary)" }}>
              You may unsubscribe at any time by visiting{" "}
              <a
                href="https://180dcvitc.org/unsubscribe"
                style={{
                  color: "var(--accent)", textDecoration: "underline",
                  textUnderlineOffset: 3, textDecorationThickness: 1,
                }}
              >
                180dcvitc.org/unsubscribe
              </a>
            </li>
          </ul>
        </div>

        <p
          style={{
            textAlign: "center", margin: "32px 0 0",
            fontSize: 12, fontWeight: 300, letterSpacing: "0.02em",
            color: "var(--text-tertiary)",
          }}
        >
          &copy; 2026 180 Degrees Consulting &middot; VIT Chennai
        </p>
      </div>
    </div>
  );
}
