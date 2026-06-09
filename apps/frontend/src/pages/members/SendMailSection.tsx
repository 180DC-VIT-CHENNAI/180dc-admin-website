import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function SendMailSection({ authToken }: { authToken: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualEmails, setManualEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } });
        const d = await res.json();
        if (d.success) setUsers(d.data || []);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

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
      } else alert(d.error);
    } catch { alert("Failed to send. Please try again."); } finally { setSending(false); }
  }

  if (loading) return <p>Loading members...</p>;

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Send Mail</h2>
      <div className="members-grid">
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Select Recipients</h3>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input className="input" placeholder="Search by name, email, or role..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 180 }} />
            <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: "auto", minWidth: 140 }}>
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                onChange={toggleAll} />
              Select All ({filtered.length})
            </label>
            <span style={{ color: "var(--text-secondary)" }}>
              {selected.size} selected
            </span>
          </div>

          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: 8, padding: 4 }}>
            {filtered.map((u) => (
              <label key={u.email} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                cursor: "pointer", borderRadius: 4, fontSize: 13,
              }}>
                <input type="checkbox" checked={selected.has(u.email)} onChange={() => toggle(u.email)} />
                <span style={{ fontWeight: 600, minWidth: 140 }}>{u.name}</span>
                <span style={{ color: "var(--text-secondary)" }}>{u.email}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--primary-green)" }}>{u.role_name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p style={{ padding: "1rem", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No members match your search.</p>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>
              Additional Recipients (manual email entry, comma/semicolon separated)
            </label>
            <input className="input" placeholder="email1@example.com, email2@example.com"
              value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} />
          </div>

          <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>
            <strong>To:</strong> {getToValue() || "(none selected)"}
          </div>
        </div>

        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Compose Email</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Subject</label>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Body</label>
              <textarea className="input" rows={10} value={body} onChange={(e) => setBody(e.target.value)}
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={sending} onClick={handleSend}>
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
