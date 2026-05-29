import { useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../lib/api";

interface MembersLoginProps {
  onLogin: (token: string, email: string, powerLevel?: number) => void;
}

export default function MembersLogin({ onLogin }: MembersLoginProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  // Dev superuser shortcut — calls onLogin with a dummy token when creds match

  return (
    <div
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        width: "100%",
      }}
    >
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
                Board & officers only
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

            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={async () => {
                  if (!token) return alert("Enter token");
                  setLoading(true);
                  try {
                    const res = await fetch(apiUrl("/api/dev-login"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      onLogin(token, data.email, data.powerLevel);
                    } else {
                      alert("Login failed: " + (data.error || "unknown"));
                    }
                  } catch (e: any) {
                    alert("Login error: " + e.message);
                  } finally {
                    setLoading(false);
                  }
                }}
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
          </div>
        </div>
      </div>
    </div>
  );
}
