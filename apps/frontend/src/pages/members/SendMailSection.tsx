import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function SendMailSection({ authToken, powerLevel = 100, onEmailSent }: { authToken: string; powerLevel?: number; onEmailSent?: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualEmails, setManualEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");

  const isDirector = powerLevel < 100;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } });
        const d = await res.json();
        if (d.success) setUsers(d.data || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [authToken]);

  const roles = [...new Set(users.map((u) => u.role_name).filter(Boolean))].sort();

  const filtered = users.filter((u) => {
    if (roleFilter && u.role_name !== roleFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role_name?.toLowerCase().includes(q);
  });

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => u.email)));
    }
  }

  function toggle(email: string) {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email); else next.add(email);
    setSelected(next);
  }

  function getToValue() {
    const parts: string[] = [];
    selected.forEach((e) => parts.push(e));
    if (manualEmails.trim()) {
      manualEmails.split(/[;,]+/).map((e) => e.trim()).filter(Boolean).forEach((e) => parts.push(e));
    }
    return parts.join(", ");
  }

  async function handleSend() {
    const to = getToValue();
    if (!to) return alert("Select or enter at least one recipient");
    if (!subject.trim() || !body.trim()) return alert("Subject and body are required");
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ to, subject: subject.trim(), body: body.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        alert(d.message);
        setSelected(new Set());
        setManualEmails("");
        setSubject("");
        setBody("");
        if (onEmailSent) onEmailSent();
      } else alert(d.error);
    } catch { alert("Failed to send. Please try again."); } finally { setSending(false); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-tertiary)" }}>Loading members...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="members-grid">
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>groups</span>
             <h3 style={{ margin: 0 }}>Select Recipients</h3>
          </div>

          {isDirector && (
            <p style={{ margin: "0 0 1rem", fontSize: 13, color: "var(--text-secondary)", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 12, padding: "0.6rem 0.9rem" }}>
              As a director you can send emails to members of your department only.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 2, minWidth: 260 }}>
               <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "var(--text-tertiary)" }}>search</span>
               <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ flex: 1, minWidth: 160 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0 4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} style={{ accentColor: "var(--primary-green)" }} />
              Select All ({filtered.length})
            </label>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary-green)", background: "var(--accent-bg)", padding: "2px 10px", borderRadius: 20 }}>
              {selected.size} selected
            </span>
          </div>

          <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: 16, padding: 8, background: "var(--surface-container-low)" }}>
            {filtered.map((u) => (
              <label key={u.email} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                cursor: "pointer", borderRadius: 10, transition: "background 0.2s",
                background: selected.has(u.email) ? "var(--bg-card)" : "transparent",
                border: `1px solid ${selected.has(u.email) ? "var(--border-light)" : "transparent"}`
              }}>
                <input type="checkbox" checked={selected.has(u.email)} onChange={() => toggle(u.email)} style={{ accentColor: "var(--primary-green)" }} />
                <div className="avatar-circle" style={{ width: 32, height: 32, fontSize: 12 }}>{u.name?.[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}</div>
                   <div style={{ fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>{u.role_name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-tertiary)" }}>No members match your search.</div>
            )}
          </div>

          {!isDirector && (
            <div style={{ marginTop: "1.5rem" }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-tertiary)" }}>ADDITIONAL RECIPIENTS (SEPARATED BY COMMA)</label>
              <input className="input" placeholder="e.g. guest@example.com, external@test.com" value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} />
            </div>
          )}
        </div>

        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>alternate_email</span>
             <h3 style={{ margin: 0 }}>Compose Message</h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-tertiary)" }}>SUBJECT</label>
              <input className="input" placeholder="Enter email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-tertiary)" }}>BODY</label>
              <textarea className="input" rows={12} placeholder="Write your message here..." value={body} onChange={(e) => setBody(e.target.value)} style={{ resize: "vertical", lineHeight: 1.6 }} />
            </div>
            
            <div style={{ padding: "1rem", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-light)", fontSize: 13, color: "var(--text-secondary)" }}>
               <strong>Preview Recipients:</strong> {getToValue() || <span style={{ fontStyle: "italic", opacity: 0.6 }}>No recipients selected</span>}
            </div>

            <button className="btn" style={{ padding: "12px", gap: 10 }} disabled={sending} onClick={handleSend}>
              <span className="material-symbols-outlined">send</span>
              {sending ? "Sending..." : "Dispatch Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
