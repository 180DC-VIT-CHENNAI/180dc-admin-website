import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import FullPageLoader from "./FullPageLoader";

export default function DepartmentMeetsSection({ authToken, departments, powerLevel, departmentId }: { authToken: string; departments: any[]; powerLevel: number; departmentId: string | null }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };

  async function load() {
    const res = await fetch(apiUrl("/api/department-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  useEffect(() => { load(); }, []);

  const isLead = powerLevel >= 50 && departmentId;
  const userDeptName = departmentId ? departments.find((d: any) => d.id === departmentId)?.name : null;

  return (
    <div>
      {scheduling && <FullPageLoader message="Creating meet and sending emails..." />}
      {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No department meets scheduled.</p>}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {meets.map((m) => (
          <div key={m.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{m.title}</strong>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
              <div style={{ fontSize: 12, color: "var(--primary-green)" }}>{m.department_name}</div>
              {m.meet_link && <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => { try { const u = new URL(m.meet_link); if (["meet.google.com", "zoom.us", "teams.microsoft.com"].some(d => u.hostname.endsWith(d))) window.open(m.meet_link, "_blank", "noopener,noreferrer"); else alert("External link blocked for security."); } catch { alert("Invalid meet link."); } }}>Open Link</button>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {isLead && m.department_id === departmentId && (
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                  setSendingEmail(m.id);
                  const res = await fetch(apiUrl(`/api/meets/department_meet/${m.id}/send-notification`), { method: "POST", headers });
                  const data = await res.json();
                  setSendingEmail(null);
                  if (data.success) alert(`Email sent to ${data.emailsSent} members${data.emailsQueued > 0 ? ` (${data.emailsQueued} queued for tomorrow)` : ""}`);
                  else alert(data.error);
                }} disabled={sendingEmail === m.id}>{sendingEmail === m.id ? "Sending..." : "Send Email"}</button>
              )}
              {isLead && m.department_id === departmentId && (
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                  await fetch(apiUrl(`/api/departments/${departmentId}/meets/${m.id}`), { method: "DELETE", headers });
                  setMeets(meets.filter((x) => x.id !== m.id));
                }}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {isLead && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", width: "100%", marginBottom: 4 }}>
            Schedule a meet for <strong>{userDeptName}</strong>:
          </div>
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Meet link (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <button className="btn" disabled={scheduling} onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            setScheduling(true);
            try {
              const res = await fetch(apiUrl(`/api/departments/${departmentId}/meets`), {
                method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when }),
              });
              const data = await res.json();
              if (data.success) { setTitle(""); setLink(""); setWhen(""); load(); alert("Meet created. Emails sent."); }
              else alert(data.error);
            } finally { setScheduling(false); }
          }}>{scheduling ? "Scheduling..." : "Schedule"}</button>
        </div>
      )}
    </div>
  );
}
