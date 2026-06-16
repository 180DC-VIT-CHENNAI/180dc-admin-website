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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {scheduling && <FullPageLoader message="Creating meet and sending emails..." />}
      
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meets.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--outline-variant)", borderRadius: 12 }}>No inter-department meets scheduled.</div>}
        {meets.map((m) => (
          <div key={m.id} style={{ 
            padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 12, flexWrap: "wrap", gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
               <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--primary-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined">hub</span>
               </div>
               <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                       <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                       {new Date(m.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <span style={{ color: "var(--primary-green)", fontWeight: 600 }}>Depts: {(m.departments || "").split(",").join(", ")}</span>
                  </div>
               </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {m.meet_link && (
                <button className="btn outline" style={{ padding: "6px 12px", fontSize: 12, gap: 6 }} onClick={() => window.open(m.meet_link, "_blank")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                  Join
                </button>
              )}
              {canManage && (
                <button className="header-action-btn" title="Notify Members" onClick={async () => {
                  setSendingEmail(m.id);
                  const res = await fetch(apiUrl(`/api/meets/inter_dept_meet/${m.id}/send-notification`), { method: "POST", headers });
                  const data = await res.json();
                  setSendingEmail(null);
                  if (data.success) alert(`Notification sent.`);
                  else alert(data.error);
                }} disabled={sendingEmail === m.id}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>mail</span>
                </button>
              )}
              {canManage && (
                <button className="header-action-btn" style={{ color: "#ef4444" }} title="Delete Meet" onClick={async () => {
                  if (!confirm("Delete meet?")) return;
                  await fetch(apiUrl(`/api/inter-dept-meets/${m.id}`), { method: "DELETE", headers });
                  setMeets(meets.filter((x) => x.id !== m.id));
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface-container-low)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)" }}>SCHEDULE INTER-DEPARTMENT MEET</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" placeholder="Meet Link" value={link} onChange={(e) => setLink(e.target.value)} />
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "4px" }}>
            {departments.map((d: any) => (
              <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", padding: "4px 10px", background: selectedDepts.includes(d.id) ? "var(--accent-bg)" : "var(--bg-card)", border: `1px solid ${selectedDepts.includes(d.id) ? "var(--primary-green)" : "var(--border-light)"}`, borderRadius: 8, transition: "all 0.2s" }}>
                <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} style={{ accentColor: "var(--primary-green)" }} />
                <span style={{ fontWeight: selectedDepts.includes(d.id) ? 700 : 500 }}>{d.name}</span>
              </label>
            ))}
          </div>
          <button className="btn" disabled={scheduling} onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            if (selectedDepts.length === 0) return alert("Select at least one department");
            setScheduling(true);
            try {
              const res = await fetch(apiUrl("/api/inter-dept-meets"), { method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when, departments: selectedDepts }) });
              const data = await res.json();
              if (data.success) { setTitle(""); setLink(""); setWhen(""); setSelectedDepts([]); load(); alert("Meet scheduled successfully."); } else alert(data.error);
            } finally { setScheduling(false); }
          }}>Schedule Inter-Dept Meet</button>
        </div>
      )}
    </div>
  );
}
