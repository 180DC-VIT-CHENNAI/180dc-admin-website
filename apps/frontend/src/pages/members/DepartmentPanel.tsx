import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

interface Props {
  authToken: string;
  departmentId: string;
  departmentName: string;
}

export default function DepartmentPanel({ authToken, departmentId, departmentName }: Props) {
  const [meets, setMeets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [instructions, setInstructions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newMeetLink, setNewMeetLink] = useState("");
  const [newMeetTitle, setNewMeetTitle] = useState("");
  const [newMeetWhen, setNewMeetWhen] = useState("");

  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocDesc, setNewDocDesc] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");

  const [newInstTitle, setNewInstTitle] = useState("");
  const [newInstContent, setNewInstContent] = useState("");
  const [newInstPriority, setNewInstPriority] = useState("medium");

  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newProjDeadline, setNewProjDeadline] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  async function loadOverview() {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/departments/${departmentId}/overview`), { headers });
      const data = await res.json();
      if (data.success) {
        setMeets(data.meets || []);
        setDocuments(data.documents || []);
        setInstructions(data.instructions || []);
        setProjects(data.projects || []);
      }
    } catch { } finally {
      setLoading(false);
    }
  }

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
                    <a href={m.meet_link} target="_blank" style={{ color: "var(--primary-green)", fontWeight: 700, fontSize: 14 }}>
                      Join Meet ↗
                    </a>
                  )}
                </div>
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={async () => {
                  await fetch(apiUrl(`/api/departments/${departmentId}/meets/${m.id}`), { method: "DELETE", headers });
                  setMeets(meets.filter((x) => x.id !== m.id));
                }}>Delete</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Meet title" value={newMeetTitle} onChange={(e) => setNewMeetTitle(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Google Meet link" value={newMeetLink} onChange={(e) => setNewMeetLink(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={newMeetWhen} onChange={(e) => setNewMeetWhen(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (!newMeetTitle || !newMeetWhen) return alert("Title and date required");
              const res = await fetch(apiUrl(`/api/departments/${departmentId}/meets`), {
                method: "POST", headers, body: JSON.stringify({ title: newMeetTitle, meetLink: newMeetLink, scheduledAt: newMeetWhen }),
              });
              const data = await res.json();
              if (data.success) { setNewMeetTitle(""); setNewMeetLink(""); setNewMeetWhen(""); loadOverview(); }
              else alert(data.error);
            }}>Add Meet</button>
          </div>
        </div>

        {/* DOCUMENTS */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Important Documents</h3>
          {documents.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No documents yet.</p>}
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {documents.map((d) => (
              <div key={d.id} className="card-doodle" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{d.title}</strong>
                  {d.description && <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>{d.description}</div>}
                  {d.file_url && <a href={d.file_url} target="_blank" style={{ color: "var(--primary-green)", fontWeight: 700, fontSize: 14 }}>View ↗</a>}
                  <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 4 }}>Status: {d.status}</div>
                </div>
                <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={async () => {
                  await fetch(apiUrl(`/api/departments/${departmentId}/documents/${d.id}`), { method: "DELETE", headers });
                  setDocuments(documents.filter((x) => x.id !== d.id));
                }}>Delete</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Document title" value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Description" value={newDocDesc} onChange={(e) => setNewDocDesc(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="File URL (Google Drive, etc.)" value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (!newDocTitle) return alert("Title required");
              const res = await fetch(apiUrl(`/api/departments/${departmentId}/documents`), {
                method: "POST", headers, body: JSON.stringify({ title: newDocTitle, description: newDocDesc, fileUrl: newDocUrl }),
              });
              const data = await res.json();
              if (data.success) { setNewDocTitle(""); setNewDocDesc(""); setNewDocUrl(""); loadOverview(); }
              else alert(data.error);
            }}>Add Document</button>
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
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Instruction title" value={newInstTitle} onChange={(e) => setNewInstTitle(e.target.value)} />
              <select className="input" style={{ width: 140 }} value={newInstPriority} onChange={(e) => setNewInstPriority(e.target.value)}>
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

        {/* PROJECTS */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Upcoming Projects</h3>
          {projects.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No projects yet.</p>}
          <div style={{ display: "grid", gap: 8 }}>
            {projects.map((p) => (
              <div key={p.id} className="card-doodle" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{p.name}</strong>
                  <span className={`floating-note`} style={{ marginLeft: 8, fontSize: 12, padding: "0.2rem 0.6rem", transform: "none" }}>
                    {p.status}
                  </span>
                  {p.description && <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{p.description}</div>}
                  {p.deadline && <div style={{ fontSize: 13, marginTop: 2 }}>Deadline: {p.deadline?.slice(0, 10)}</div>}
                </div>
                <select className="input" style={{ width: 130 }} value={p.status} onChange={async (e) => {
                  const res = await fetch(apiUrl(`/api/departments/${departmentId}/projects/${p.id}/status`), {
                    method: "PUT", headers, body: JSON.stringify({ status: e.target.value }),
                  });
                  const data = await res.json();
                  if (data.success) loadOverview();
                }}>
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Project name" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Description" value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} type="date" value={newProjDeadline} onChange={(e) => setNewProjDeadline(e.target.value)} />
            <button className="btn" onClick={async () => {
              if (!newProjName) return alert("Project name required");
              const res = await fetch(apiUrl(`/api/departments/${departmentId}/projects`), {
                method: "POST", headers, body: JSON.stringify({ name: newProjName, description: newProjDesc, deadline: newProjDeadline || null }),
              });
              const data = await res.json();
              if (data.success) { setNewProjName(""); setNewProjDesc(""); setNewProjDeadline(""); loadOverview(); }
              else alert(data.error);
            }}>Add Project</button>
          </div>
        </div>
      </div>
    </div>
  );
}
