import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "../../lib/api";

function FullPageLoader({ message }: { message: string }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="card-doodle" style={{ padding: 24, textAlign: "center", transition: "none", transform: "none" }}>
        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{message}</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait, this may take a moment.</p>
      </div>
    </div>,
    document.body,
  );
}

interface Props {
  authToken: string;
  departmentId: string;
  departmentName: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function DepartmentPanel({ authToken, departmentId, departmentName }: Props) {
  const [meets, setMeets] = useState<any[]>([]);
  const [instructions, setInstructions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [newMeetLink, setNewMeetLink] = useState("");
  const [newMeetTitle, setNewMeetTitle] = useState("");
  const [newMeetWhen, setNewMeetWhen] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const [newInstTitle, setNewInstTitle] = useState("");
  const [newInstContent, setNewInstContent] = useState("");
  const [newInstPriority, setNewInstPriority] = useState("medium");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  async function loadOverview() {
    try {
      setLoading(true);
      const [overviewRes, membersRes] = await Promise.all([
        fetch(apiUrl(`/api/departments/${departmentId}/overview`), { headers }),
        fetch(apiUrl(`/api/departments/${departmentId}/members`), { headers }),
      ]);
      const overview = await overviewRes.json();
      const membersData = await membersRes.json();
      if (overview.success) {
        setMeets(overview.meets || []);
        setInstructions(overview.instructions || []);
      }
      if (membersData.success) setMembers(membersData.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOverview() }, [departmentId]);

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-tertiary)" }}>Loading {departmentName} Panel...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="members-grid">
        {/* DEPARTMENT MEMBERS */}
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>groups</span>
             <h3 style={{ margin: 0 }}>Team Directory ({members.length})</h3>
          </div>
          
          <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {members.map((m) => (
              <div key={m.id} style={{ 
                padding: "1rem", borderRadius: 16, background: "var(--surface)", 
                border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12
              }}>
                <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: 12 }}>{m.name[0]}</div>
                <div style={{ minWidth: 0 }}>
                   <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                   <div style={{ fontSize: 11, fontWeight: 600, color: "var(--primary-green)", textTransform: "uppercase" }}>{m.role_name}</div>
                </div>
              </div>
            ))}
          </div>
          {members.length === 0 && <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "2rem" }}>No members found in this department.</p>}
        </div>

        {/* SCHEDULED MEETS */}
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>videocam</span>
             <h3 style={{ margin: 0 }}>Department Meetings</h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "1.5rem" }}>
            {meets.map((m) => (
              <div key={m.id} style={{ 
                padding: "1.25rem", borderRadius: 16, background: "var(--surface)", 
                border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                   <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-light)" }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>event</span>
                   </div>
                   <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{new Date(m.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                   </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {m.meet_link && <button className="btn outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => window.open(m.meet_link, "_blank")}>Join</button>}
                  <button className="header-action-btn" title="Notify Team" onClick={async () => {
                    setSendingEmail(m.id);
                    const res = await fetch(apiUrl(`/api/meets/department_meet/${m.id}/send-notification`), { method: "POST", headers });
                    const data = await res.json();
                    setSendingEmail(null);
                    if (data.success) alert(`Email sent.`);
                    else alert(data.error);
                  }} disabled={sendingEmail === m.id}><span className="material-symbols-outlined">mail</span></button>
                  <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
                    if (!confirm("Delete meet?")) return;
                    await fetch(apiUrl(`/api/departments/${departmentId}/meets/${m.id}`), { method: "DELETE", headers });
                    setMeets(meets.filter((x) => x.id !== m.id));
                  }}><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>
            ))}
            {meets.length === 0 && <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "1.5rem", border: "1px dashed var(--outline-variant)", borderRadius: 16 }}>No meetings scheduled.</p>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-container-low)", padding: "1.25rem", borderRadius: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Schedule New Meet</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <input className="input" placeholder="Meet title" value={newMeetTitle} onChange={(e) => setNewMeetTitle(e.target.value)} />
              <input className="input" placeholder="Google Meet link" value={newMeetLink} onChange={(e) => setNewMeetLink(e.target.value)} />
              <input className="input" type="datetime-local" value={newMeetWhen} onChange={(e) => setNewMeetWhen(e.target.value)} />
              <button className="btn" disabled={scheduling} onClick={async () => {
                if (!newMeetTitle || !newMeetWhen) return alert("Title and date required");
                setScheduling(true);
                try {
                  const res = await fetch(apiUrl(`/api/departments/${departmentId}/meets`), { method: "POST", headers, body: JSON.stringify({ title: newMeetTitle, meetLink: newMeetLink, scheduledAt: newMeetWhen }) });
                  const data = await res.json();
                  if (data.success) { setNewMeetTitle(""); setNewMeetLink(""); setNewMeetWhen(""); loadOverview(); alert("Meet created."); } else alert(data.error);
                } finally { setScheduling(false); }
              }}>{scheduling ? "Adding..." : "Add Meet"}</button>
            </div>
            {scheduling && <FullPageLoader message="Scheduling..." />}
          </div>
        </div>

        {/* INSTRUCTIONS */}
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>menu_book</span>
             <h3 style={{ margin: 0 }}>Team Instructions</h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "1.5rem" }}>
            {instructions.map((inst) => (
              <div key={inst.id} style={{ 
                padding: "1.25rem", borderRadius: 16, background: "var(--surface)", 
                border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "flex-start"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                     <strong style={{ fontSize: 15 }}>{inst.title}</strong>
                     <span style={{ 
                       fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "2px 8px", borderRadius: 4,
                       background: inst.priority === "high" || inst.priority === "urgent" ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                       color: inst.priority === "high" || inst.priority === "urgent" ? "#ef4444" : "#3b82f6"
                     }}>{inst.priority}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{inst.content}</div>
                </div>
                <button className="header-action-btn" style={{ color: "#ef4444", marginLeft: 12 }} onClick={async () => {
                  if (!confirm("Delete instruction?")) return;
                  await fetch(apiUrl(`/api/departments/${departmentId}/instructions/${inst.id}`), { method: "DELETE", headers });
                  setInstructions(instructions.filter((x) => x.id !== inst.id));
                }}><span className="material-symbols-outlined">delete</span></button>
              </div>
            ))}
            {instructions.length === 0 && <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "1.5rem", border: "1px dashed var(--outline-variant)", borderRadius: 16 }}>No instructions published.</p>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-container-low)", padding: "1.25rem", borderRadius: 20 }}>
             <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Create Instruction</div>
             <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <input className="input" placeholder="Brief title" value={newInstTitle} onChange={(e) => setNewInstTitle(e.target.value)} />
                <select className="input" value={newInstPriority} onChange={(e) => setNewInstPriority(e.target.value)} style={{ width: "auto" }}>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
             </div>
             <textarea className="input" placeholder="Write detailed instructions for your team members..." rows={4} value={newInstContent} onChange={(e) => setNewInstContent(e.target.value)} style={{ resize: "none" }} />
             <button className="btn" onClick={async () => {
               if (!newInstTitle || !newInstContent) return alert("Title and content required");
               const res = await fetch(apiUrl(`/api/departments/${departmentId}/instructions`), { method: "POST", headers, body: JSON.stringify({ title: newInstTitle, content: newInstContent, priority: newInstPriority }) });
               const data = await res.json();
               if (data.success) { setNewInstTitle(""); setNewInstContent(""); setNewInstPriority("medium"); loadOverview(); } else alert(data.error);
             }}>Publish Instruction</button>
          </div>
        </div>
      </div>
    </div>
  );
}
