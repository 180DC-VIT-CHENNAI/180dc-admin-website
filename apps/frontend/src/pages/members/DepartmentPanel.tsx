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

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadOverview() }, [departmentId]);

  if (loading) return <div className="card-doodle">Loading department...</div>;

  return (
    <div>
      <header
        style={{
          borderBottom: "1px solid var(--border-light)",
          paddingBottom: "1rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: 0 }}>{departmentName} Department</h2>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
          Manage meets, documents, instructions, and projects
        </p>
      </header>

      <div className="members-grid">
        {/* DEPARTMENT MEMBERS */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Department Members ({members.length})</h3>
          {members.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No members in this department.</p>}
          <div style={{ display: "grid", gap: 6 }}>
            {members.map((m) => (
              <div key={m.id} className="card-doodle" style={{ padding: "0.6rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{m.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--primary-green)" }}>{m.role_name}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.email}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SCHEDULED MEETS */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Scheduled Google Meets</h3>
          {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No meets scheduled yet.</p>}
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {meets.map((m) => (
              <div key={m.id} className="card-doodle" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{m.title}</strong>
                  <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
                  {m.description && <div style={{ fontSize: 14, marginTop: 4 }}>{m.description}</div>}
                  {m.meet_link && (
                    <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => window.open(m.meet_link, "_blank", "noopener,noreferrer")}>
                      Open Link
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                    setSendingEmail(m.id);
                    const res = await fetch(apiUrl(`/api/meets/department_meet/${m.id}/send-notification`), { method: "POST", headers });
                    const data = await res.json();
                    setSendingEmail(null);
                    if (data.success) alert(`Email sent to ${data.emailsSent} members${data.emailsQueued > 0 ? ` (${data.emailsQueued} queued for tomorrow)` : ""}`);
                    else alert(data.error);
                  }} disabled={sendingEmail === m.id}>{sendingEmail === m.id ? "Sending..." : "Send Email"}</button>
                  <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={async () => {
                    await fetch(apiUrl(`/api/departments/${departmentId}/meets/${m.id}`), { method: "DELETE", headers });
                    setMeets(meets.filter((x) => x.id !== m.id));
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div className="admin-grid-4" style={{ marginTop: 0 }}>
            <input className="input" placeholder="Meet title" value={newMeetTitle} onChange={(e) => setNewMeetTitle(e.target.value)} />
            <input className="input" placeholder="Meet link (optional)" value={newMeetLink} onChange={(e) => setNewMeetLink(e.target.value)} />
            <input className="input" type="datetime-local" value={newMeetWhen} onChange={(e) => setNewMeetWhen(e.target.value)} />
            <button className="btn" disabled={scheduling} onClick={async () => {
              if (!newMeetTitle || !newMeetWhen) return alert("Title and date required");
              setScheduling(true);
              try {
                const res = await fetch(apiUrl(`/api/departments/${departmentId}/meets`), {
                  method: "POST", headers, body: JSON.stringify({ title: newMeetTitle, meetLink: newMeetLink, scheduledAt: newMeetWhen }),
                });
                const data = await res.json();
                if (data.success) { setNewMeetTitle(""); setNewMeetLink(""); setNewMeetWhen(""); loadOverview(); alert("Meet created. Emails sent."); }
                else alert(data.error);
              } finally { setScheduling(false); }
            }}>{scheduling ? "Adding..." : "Add Meet"}</button>
            {scheduling && <FullPageLoader message="Creating meet and sending emails..." />}
          </div>
        </div>

        {/* INSTRUCTIONS */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Instructions</h3>
          {instructions.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No instructions yet.</p>}
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {instructions.map((inst) => (
              <div key={inst.id} className="card-doodle" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <strong>{inst.title}</strong>
                  <span className={`floating-note`} style={{ marginLeft: 8, fontSize: 12, padding: "0.2rem 0.6rem", transform: "none" }}>
                    {inst.priority}
                  </span>
                  <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{inst.content}</div>
                </div>
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13, marginLeft: 12 }} onClick={async () => {
                  await fetch(apiUrl(`/api/departments/${departmentId}/instructions/${inst.id}`), { method: "DELETE", headers });
                  setInstructions(instructions.filter((x) => x.id !== inst.id));
                }}>Delete</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
            <div className="admin-grid-4" style={{ marginTop: 0 }}>
              <input className="input" placeholder="Instruction title" value={newInstTitle} onChange={(e) => setNewInstTitle(e.target.value)} />
              <select className="input" value={newInstPriority} onChange={(e) => setNewInstPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <textarea className="input" placeholder="Instruction content" rows={3} value={newInstContent} onChange={(e) => setNewInstContent(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (!newInstTitle || !newInstContent) return alert("Title and content required");
              const res = await fetch(apiUrl(`/api/departments/${departmentId}/instructions`), {
                method: "POST", headers, body: JSON.stringify({ title: newInstTitle, content: newInstContent, priority: newInstPriority }),
              });
              const data = await res.json();
              if (data.success) { setNewInstTitle(""); setNewInstContent(""); setNewInstPriority("medium"); loadOverview(); }
              else alert(data.error);
            }}>Add Instruction</button>
          </div>
        </div>


      </div>
    </div>
  );
}
