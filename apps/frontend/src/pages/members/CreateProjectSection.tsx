import { useState } from "react";
import { apiUrl } from "../../lib/api";
import FullPageLoader from "./FullPageLoader";

export default function CreateProjectSection({ authToken, departments, onCreated }: { authToken: string; departments: any[]; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyOrg, setCompanyOrg] = useState("");
  const [projectYear, setProjectYear] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleDept(id: string) {
    setSelectedDepts((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {busy && <FullPageLoader message="Creating project and sending emails..." />}
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div style={{ flex: 1 }}>
           <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase" }}>Project Name</label>
           <input className="input" placeholder="e.g. Website Redesign" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
           <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase" }}>Company / Org</label>
           <input className="input" placeholder="e.g. 180DC VIT" value={companyOrg} onChange={(e) => setCompanyOrg(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div>
           <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase" }}>Year</label>
           <input className="input" placeholder="e.g. 2025" value={projectYear} onChange={(e) => setProjectYear(e.target.value)} />
        </div>
        <div>
           <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 6, textTransform: "uppercase" }}>Deadline</label>
           <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>

      <div>
         <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 8, textTransform: "uppercase" }}>Description</label>
         <textarea className="input" placeholder="Detailed project scope and objectives..." rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "none" }} />
      </div>

      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 12, textTransform: "uppercase" }}>Assigned Departments</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {departments.map((d: any) => (
            <label key={d.id} style={{ 
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer", 
              padding: "6px 12px", background: selectedDepts.includes(d.id) ? "var(--accent-bg)" : "var(--bg-card)", 
              border: `1px solid ${selectedDepts.includes(d.id) ? "var(--primary-green)" : "var(--border-light)"}`, 
              borderRadius: 8, transition: "all 0.2s" 
            }}>
              <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} style={{ accentColor: "var(--primary-green)" }} />
              <span style={{ fontSize: 13, fontWeight: selectedDepts.includes(d.id) ? 700 : 500 }}>{d.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn" style={{ marginTop: "0.5rem", padding: "12px" }} disabled={busy} onClick={async () => {
        if (!name.trim()) return alert("Project name required");
        if (selectedDepts.length === 0) return alert("Select at least one department");
        if (!projectYear.trim() && !deadline) return alert("Provide either a year or a deadline date");
        setBusy(true);
        try {
          const res = await fetch(apiUrl("/api/projects"), {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ name: name.trim(), description: description.trim() || null, companyOrg: companyOrg.trim() || null, year: projectYear.trim() || null, deadline: deadline || null, departmentIds: selectedDepts }),
          });
          const data = await res.json();
          if (data.success) { setName(""); setDescription(""); setCompanyOrg(""); setProjectYear(""); setDeadline(""); setSelectedDepts([]); if (onCreated) onCreated(); alert("Project created successfully."); }
          else alert(data.error);
        } finally { setBusy(false); }
      }}>
        <span className="material-symbols-outlined">rocket_launch</span>
        Launch Project
      </button>
    </div>
  );
}
