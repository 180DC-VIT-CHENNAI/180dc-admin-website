import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../../lib/api";

interface AuthorizedEmail {
  email: string;
  added_by: string;
  created_at: string;
}

interface Props {
  authToken: string;
}

export default function AdminNewsletterSection({ authToken }: Props) {
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/admin/authorized-emails"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setEmails(data.data || []);
    } catch {}
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/admin/authorized-emails"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEmail("");
        setSuccess("Authorized!");
        load();
      } else {
        setError(data.error || "Failed to add");
      }
    } catch {
      setError("Network error");
    }
    setAdding(false);
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from newsletter editor access?`)) return;
    try {
      await fetch(apiUrl(`/api/newsletter-editor/admin/authorized-emails/${encodeURIComponent(email)}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setEmails(emails.filter((e) => e.email !== email));
    } catch {}
  };

  return (
    <div className="members-grid">
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ margin: "0 0 4px" }}>Newsletter Editor Access</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
          Manage who can create and send newsletters at <a href="https://180dcvitc.org/subscriber/newsletter" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-primary)" }}>180dcvitc.org/subscriber/newsletter</a>
        </p>

        {success && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.1)", borderLeft: "3px solid #22c55e", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#22c55e" }}>{success}</p>
          </div>
        )}
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", borderLeft: "3px solid #ef4444", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            className="input"
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn" disabled={adding} onClick={handleAdd} style={{ padding: "8px 20px", whiteSpace: "nowrap" }}>
            {adding ? "Adding..." : "+ Add"}
          </button>
        </div>

        {emails.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-tertiary)", textAlign: "center", padding: 24 }}>
            No authorized emails yet. Add someone to give them newsletter editor access.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {emails.map((e) => (
              <div
                key={e.email}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-secondary, rgba(0,0,0,0.02))",
                }}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{e.email}</span>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>
                    Added by {e.added_by} — {e.created_at?.slice(0, 10)}
                  </span>
                </div>
                <button
                  className="btn"
                  style={{ padding: "4px 12px", fontSize: 12, color: "#ef4444", background: "transparent" }}
                  onClick={() => handleRemove(e.email)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
