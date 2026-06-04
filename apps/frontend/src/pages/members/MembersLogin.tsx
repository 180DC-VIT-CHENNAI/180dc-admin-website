import { useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";

interface MembersLoginProps {
  onLogin: (
    token: string,
    email: string,
    powerLevel?: number,
    departmentId?: string,
    roleId?: string,
  ) => void;
}

export default function MembersLogin({ onLogin }: MembersLoginProps) {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [dualRolePending, setDualRolePending] = useState<any>(null);

  const handleTokenLogin = async (loginAs?: string) => {
    const t = token;
    if (!t) return alert("Enter token");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/dev-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginAs ? { token: t, loginAs } : { token: t }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.dualRole && !data.dualRoleChosen) {
          setDualRolePending(data);
          setLoading(false);
          return;
        }
        onLogin(token, data.email, data.powerLevel, data.departmentId, data.roleId);
      } else {
        alert("Login failed: " + (data.error || "unknown"));
      }
    } catch (e) {
      alert("Login error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotToken = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setForgotSent(true);
      } else if (res.status === 429) {
        alert(data.error || "Daily email quota reached. Please contact the administrator or try again after 24 hours.");
      } else {
        alert("Something went wrong. Try again later.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Dev superuser shortcut — calls onLogin with a dummy token when creds match

  return (
    <div
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        width: "100%",
        position: "relative",
      }}
    >
      <button
        onClick={toggleTheme}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          padding: "0.5rem 0.8rem", border: "2px solid var(--border-light)",
          background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer",
          fontSize: 13, borderRadius: 8, fontWeight: 600,
        }}
      >
        {isDark ? "☀ Light" : "☾ Dark"}
      </button>
      <div className="container" style={{ padding: "4rem 0" }}>
        <div
          className="card-doodle"
          style={{ maxWidth: 540, margin: "0 auto" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
              }}
            >
              VIT
            </div>
            <div>
              <h2 style={{ margin: 0 }}>Members Portal</h2>
              <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                club members only
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="section-label">Admin Token</label>
            <input
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter admin token"
            />

            <div className="login-actions">
              <button
                onClick={() => handleTokenLogin()}
                className="btn"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login with Token"}
              </button>

              <Link
                to="/request-account"
                className="btn outline"
                style={{ marginLeft: "auto" }}
              >
                Request account
              </Link>
            </div>

            <div style={{ marginTop: 10, textAlign: "right" }}>
              <button
                onClick={() => { setShowForgot(!showForgot); setForgotSent(false); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Forgot token?
              </button>
            </div>

            {showForgot && (
              <div style={{ marginTop: 14, padding: 16, background: "var(--bg-secondary)", borderRadius: 12, border: "2px solid var(--border-light)" }}>
                {forgotSent ? (
                  <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    If that email is registered, your token has been sent. Check your inbox (and spam folder).
                  </p>
                ) : (
                  <>
                    <label className="section-label">Registered Email</label>
                    <input
                      className="input"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter your email"
                      type="email"
                    />
                    <button
                      onClick={handleForgotToken}
                      className="btn"
                      disabled={forgotLoading || !forgotEmail}
                      style={{ marginTop: 10 }}
                    >
                      {forgotLoading ? "Sending..." : "Send Token"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {dualRolePending && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="card-doodle" style={{ maxWidth: 400, width: "90%", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px" }}>Choose Login Role</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 20px" }}>
              Your token is recognized as <strong>{dualRolePending.roleName}</strong> with a secondary role of <strong>{dualRolePending.secondaryRoleName}</strong>. Which role would you like to use for this session?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn" onClick={() => handleTokenLogin(dualRolePending.secondaryRoleId)}>
                Login as {dualRolePending.secondaryRoleName}
              </button>
              <button className="btn outline" onClick={() => handleTokenLogin("director")}>
                Login as {dualRolePending.roleName}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
