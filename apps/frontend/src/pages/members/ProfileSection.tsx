import { useState } from "react";
import { apiUrl } from "../../lib/api";

interface Props {
  authToken: string;
  email: string;
  powerLevel: number;
  departmentId: string | null;
  deptName: string;
}

export default function ProfileSection({ authToken, email, powerLevel, departmentId, deptName }: Props) {
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [currentToken, setCurrentToken] = useState(authToken);
  const [rotateError, setRotateError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = currentToken;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    setRotateError(null);
    try {
      const res = await fetch(apiUrl("/api/auth/rotate-token"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.status === 429) {
        const mins = Math.ceil((data.retryAfter || 3600) / 60);
        setRotateError(`Rate limited. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
        return;
      }
      if (!data.success) {
        setRotateError(data.error || "Failed to rotate token.");
        return;
      }
      setCurrentToken(data.token);
      sessionStorage.setItem("authToken", data.token);
      setShowToken(true);
    } catch {
      setRotateError("Network error. Please try again.");
    } finally {
      setRotating(false);
    }
  };

  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Profile</h2>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
          Your account details and authentication token
        </p>
      </header>

      <div className="members-grid">
        <div className="card-doodle">
          <h3>Account</h3>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Email</span>
              <p style={{ margin: "2px 0 0", fontSize: 14 }}>{email}</p>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Power Level</span>
              <p style={{ margin: "2px 0 0", fontSize: 14 }}>{powerLevel}</p>
            </div>
            {departmentId && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Department</span>
                <p style={{ margin: "2px 0 0", fontSize: 14 }}>{deptName}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Authentication Token</h3>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                flex: 1,
                minWidth: 200,
                padding: "0.5rem 0.75rem",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-light)",
                borderRadius: 6,
                fontSize: 13,
                wordBreak: "break-all",
                fontFamily: "monospace",
                userSelect: showToken ? "text" : "none",
              }}
            >
              {showToken ? currentToken : currentToken.slice(0, 8) + "••••••••"}
            </code>

            <button
              className="btn"
              onClick={() => setShowToken(!showToken)}
              style={{ whiteSpace: "nowrap" }}
            >
              {showToken ? "Hide" : "Reveal"}
            </button>

            <button className="btn" onClick={handleCopy} style={{ whiteSpace: "nowrap" }}>
              {tokenCopied ? "Copied!" : "Copy"}
            </button>

            <button
              className="btn"
              onClick={handleRotate}
              disabled={rotating}
              style={{ whiteSpace: "nowrap" }}
            >
              {rotating ? "Rotating..." : "Rotate"}
            </button>
          </div>

          {rotateError && (
            <p style={{ color: "var(--danger, #e74c3c)", fontSize: 13, marginTop: 8 }}>
              {rotateError}
            </p>
          )}

          <p style={{ color: "var(--text-light)", fontSize: 12, marginTop: 8 }}>
            Your token is used for API authentication. Rotating it will invalidate the old token.
            Limited to 3 rotations per hour.
          </p>
        </div>
      </div>
    </div>
  );
}
