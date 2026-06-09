import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import FullPageLoader from "./FullPageLoader";

export default function InterDeptMeetsSection({ authToken, departments, powerLevel }: { authToken: string; departments: any[]; powerLevel: number }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };
  const canManage = powerLevel >= 50;

  async function load() {
    const res = await fetch(apiUrl("/api/inter-dept-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  useEffect(() => { load(); }, []);

  function toggleDept(id: string) {
    setSelectedDepts((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  }

  return (
    <div>
      {scheduling && <FullPageLoader message="Creating meet and sending emails..." />}
      {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No inter-department meets scheduled.</p>}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {meets.map((m) => (
          <div key={m.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{m.title}</strong>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
              <div style={{ fontSize: 12, color: "var(--text-light)" }}>Depts: {(m.departments || "").split(",").join(", ")}</div>
              {m.meet_link && <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => { try { const u = new URL(m.meet_link); if (["meet.google.com", "zoom.us", "teams.microsoft.com"].some(d => u.hostname.endsWith(d))) window.open(m.meet_link, "_blank", "noopener,noreferrer"); else alert("External link blocked for security."); } catch { alert("Invalid meet link."); } }}>Open Link</button>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {canManage && (
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                  setSendingEmail(m.id);
                  const res = await fetch(apiUrl(`/api/meets/inter_dept_meet/${m.id}/send-notification`), { method: "POST", headers });
                  const data = await res.json();
                  setSendingEmail(null);
                  if (data.success) alert(`Email sent to ${data.emailsSent} members${data.emailsQueued > 0 ? ` (${data.emailsQueued} queued for tomorrow)` : ""}`);
                  else alert(data.error);
                }} disabled={sendingEmail === m.id}>{sendingEmail === m.id ? "Sending..." : "Send Email"}</button>
              )}
              {canManage && (
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                  await fetch(apiUrl(`/api/inter-dept-meets/${m.id}`), { method: "DELETE", headers });
                  setMeets(meets.filter((x) => x.id !== m.id));
                }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Meet link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {departments.map((d: any) => (
              <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} />
                {d.name}
              </label>
            ))}
          </div>
          <button className="btn" disabled={scheduling} onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            if (selectedDepts.length === 0) return alert("Select at least one department");
            setScheduling(true);
            try {
              const res = await fetch(apiUrl("/api/inter-dept-meets"), {
                method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when, departments: selectedDepts }),
              });
              const data = await res.json();
              if (data.success) { setTitle(""); setLink(""); setWhen(""); setSelectedDepts([]); load(); alert("Meet created. Emails sent."); }
              else alert(data.error);
            } finally { setScheduling(false); }
          }}>{scheduling ? "Scheduling..." : "Schedule Inter-Department Meet"}</button>
        </div>
      )}
    </div>
  );
}
