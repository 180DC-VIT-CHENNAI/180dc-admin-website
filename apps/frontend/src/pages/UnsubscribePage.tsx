import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

function EmailInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      id={id}
      type="email"
      required
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: "100%", padding: "13px 16px", borderRadius: 12,
        border: `1px solid ${focus ? "var(--border-green)" : "var(--border-light)"}`,
        background: "var(--bg-primary)", color: "var(--text-primary)",
        fontSize: 15, fontWeight: 400, outline: "none", boxSizing: "border-box",
        boxShadow: focus ? "0 0 0 3px var(--accent-soft)" : "none",
        transition: `all 200ms ease-out`,
      }}
    />
  );
}

function PrimaryButton({
  type,
  disabled,
  children,
}: {
  type?: "submit" | "button";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = !disabled;
  return (
    <button
      type={type ?? "submit"}
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

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "12px 28px", borderRadius: 12,
        border: `1px solid ${hover ? "var(--border-green)" : "var(--border-light)"}`,
        background: hover ? "var(--accent-soft)" : "transparent",
        color: hover ? "var(--primary-green)" : "var(--text-primary)",
        fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
        textDecoration: "none", cursor: "pointer",
        transition: `all 250ms ${EASE}`,
      }}
    >
      {children}
    </a>
  );
}

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const { isDark, toggle: toggleTheme } = useTheme();

  const [inputEmail, setInputEmail] = useState(emailParam);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "not-found" | "error">("idle");

  useEffect(() => {
    if (emailParam && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam)) {
      setInputEmail(emailParam);
      doUnsubscribe(emailParam);
    }
  }, [emailParam]);

  const doUnsubscribe = async (email: string) => {
    setStatus("loading");
    try {
      const res = await fetch(apiUrl(`/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`));
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.status === "already") setStatus("already");
        else if (data.status === "not_found") setStatus("not-found");
        else setStatus("success");
      } else if (res.status === 400) {
        setStatus("not-found");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("not-found");
      return;
    }
    doUnsubscribe(trimmed);
  };

  const messages: Record<string, { title: React.ReactNode; desc: string; icon: string }> = {
    idle: {
      title: (
        <>
          Unsubscribe from our <em style={serifAccent}>newsletter</em>
        </>
      ),
      desc: "Enter the email address you subscribed with, and we will remove you from our mailing list.",
      icon: "\u2709",
    },
    loading: { title: "Unsubscribing\u2026", desc: "Please wait while we process your request.", icon: "\u2709" },
    success: {
      title: (
        <>
          You&apos;re <em style={serifAccent}>unsubscribed</em>
        </>
      ),
      desc: "You have been unsubscribed from the 180DC newsletter. You will no longer receive newsletter emails from us.",
      icon: "\u2713",
    },
    already: {
      title: "Already unsubscribed",
      desc: "You are not currently subscribed to the 180DC newsletter, or you have already unsubscribed.",
      icon: "\u2713",
    },
    "not-found": {
      title: "Email not found",
      desc: "This email address is not subscribed to our newsletter. Please check and try again.",
      icon: "!",
    },
    error: {
      title: "Something went wrong",
      desc: "We couldn't process your unsubscribe request. Please try again later.",
      icon: "!",
    },
  };

  const showForm = status === "idle" || status === "not-found" || status === "error";
  const msg = messages[status];

  const positive = status === "success" || status === "already";
  const neutral = status === "not-found" || status === "error";

  const iconCircle: React.CSSProperties = {
    width: 64, height: 64, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 26, fontWeight: 300, margin: "0 auto 24px",
    ...(positive
      ? { background: "var(--primary-green)", color: "#ffffff", boxShadow: "0 8px 24px var(--accent-glow)" }
      : neutral
        ? { background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }
        : { background: "var(--accent-soft)", color: "var(--primary-green)" }),
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

          <div style={iconCircle} aria-hidden="true">
            {status === "loading" ? (
              <div
                style={{
                  width: 22, height: 22,
                  border: "2px solid var(--border-light)", borderTopColor: "var(--accent)",
                  borderRadius: "50%", animation: "spin 0.8s linear infinite",
                }}
              />
            ) : (
              msg.icon
            )}
          </div>

          <h1
            style={{
              fontSize: "clamp(1.625rem, 4vw, 2rem)",
              fontWeight: 300, lineHeight: 1.12, letterSpacing: "-0.02em",
              margin: "0 0 12px", color: "var(--text-primary)",
            }}
          >
            {msg.title}
          </h1>
          <p
            style={{
              color: "var(--text-secondary)", fontSize: 15, fontWeight: 300,
              lineHeight: 1.65, margin: "0 auto 28px", maxWidth: 320,
            }}
          >
            {msg.desc}
          </p>

          {showForm && (
            <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
              <label
                htmlFor="unsubscribe-email"
                style={{
                  display: "block", textAlign: "left", marginBottom: 8,
                  fontSize: 13, fontWeight: 500, color: "var(--text-secondary)",
                }}
              >
                Email address
              </label>
              <EmailInput
                id="unsubscribe-email"
                value={inputEmail}
                onChange={setInputEmail}
                placeholder="you@example.com"
              />
              <div style={{ marginTop: 16 }}>
                <PrimaryButton type="submit">Unsubscribe</PrimaryButton>
              </div>
            </form>
          )}

          {!showForm && emailParam && (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 24px" }}>
              {emailParam}
            </p>
          )}

          <GhostLink href="https://180dcvitc.org">Visit Website</GhostLink>
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
