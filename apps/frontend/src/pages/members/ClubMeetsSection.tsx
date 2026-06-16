import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import FullPageLoader from "./FullPageLoader";

export default function ClubMeetsSection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };
  const canManage = powerLevel >= 100;

  async function load() {
    const res = await fetch(apiUrl("/api/club-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {scheduling && <FullPageLoader message="Creating meet and sending emails..." />}
      
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meets.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--outline-variant)", borderRadius: 12 }}>No upcoming club-wide meets.</div>}
        meets.map((m) => (
          <div key={m.id} style={{ 
            padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 12, flexWrap: "wrap", gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
               <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-light)", color: "var(--primary-green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="material-symbols-outlined">groups</span>
               </div>
               <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                    {new Date(m.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
               </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {m.meet_link && (
                <button className="btn outline" style={{ padding: "6px 12px", fontSize: 12, gap: 6 }} onClick={() => window.open(m.meet_link, "_blank")}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                  Join Meet
                </button>
              )}
              {canManage && (
                <button className="header-action-btn" title="Notify Members" onClick={async () => {
                  setSendingEmail(m.id);
                  const res = await fetch(apiUrl(`/api/meets/club_meet/${m.id}/send-notification`), { method: "POST", headers });
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
                  await fetch(apiUrl(`/api/club-meets/${m.id}`), { method: "DELETE", headers });
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)" }}>SCHEDULE NEW CLUB MEET</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" placeholder="Meet Link" value={link} onChange={(e) => setLink(e.target.value)} />
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button className="btn" style={{ height: "100%" }} disabled={scheduling} onClick={async () => {
              if (!title || !when) return alert("Title and date required");
              setScheduling(true);
              try {
                const res = await fetch(apiUrl("/api/club-meets"), { method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when }) });
                const data = await res.json();
                if (data.success) { setTitle(""); setLink(""); setWhen(""); load(); alert("Meet scheduled successfully."); } else alert(data.error);
              } finally { setScheduling(false); }
            }}>Schedule</button>
          </div>
        </div>
      )}
    </div>
  );
}
