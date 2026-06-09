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
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <div className="admin-grid-3">
        <input className="input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="input" placeholder="Company / Org" value={companyOrg} onChange={(e) => setCompanyOrg(e.target.value)} />
      </div>
      <div className="admin-grid-2">
        <input className="input" placeholder="Year (e.g. 2025, 2026, 2027)" value={projectYear} onChange={(e) => setProjectYear(e.target.value)} />
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -8 }}>
        Fill either year OR date. If both are provided, the date takes precedence.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {departments.map((d: any) => (
          <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} />
            {d.name}
          </label>
        ))}
      </div>
      <div>
        {busy && <FullPageLoader message="Creating project and sending emails..." />}
        <button className="btn" disabled={busy} onClick={async () => {
          if (!name.trim()) return alert("Project name required");
          if (selectedDepts.length === 0) return alert("Select at least one department");
          if (!projectYear.trim() && !deadline) return alert("Provide either a year or a deadline date");
          if (projectYear.trim() && !/^\d{4}$/.test(projectYear.trim())) return alert("Year must be a 4-digit year (e.g. 2025, 2026, 2027)");
          setBusy(true);
          try {
            const res = await fetch(apiUrl("/api/projects"), {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ name: name.trim(), description: description.trim() || null, companyOrg: companyOrg.trim() || null, year: projectYear.trim() || null, deadline: deadline || null, departmentIds: selectedDepts }),
            });
            const data = await res.json();
            if (data.success) { setName(""); setDescription(""); setCompanyOrg(""); setProjectYear(""); setDeadline(""); setSelectedDepts([]); if (onCreated) onCreated(); alert("Project created. Emails sent to department leads."); }
            else alert(data.error);
          } finally { setBusy(false); }
        }}>{busy ? "Creating..." : "Create Project"}</button>
      </div>
    </div>
  );
}
