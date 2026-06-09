import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import CreateProjectSection from "./CreateProjectSection";
import ProjectTasksSection from "./ProjectTasksSection";
import FullPageLoader from "./FullPageLoader";

export default function ProjectsSection({ authToken, departments, allUsers, powerLevel, departmentId }: { authToken: string; departments: any[]; allUsers: any[]; powerLevel: number; departmentId: string | null }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);
  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleName, setAssignRoleName] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [yearFilter, setYearFilter] = useState("");

  const canManage = powerLevel >= 50 && departmentId;
  const isBoard = powerLevel >= 100;

  async function load() {
    const [projRes, membersRes] = await Promise.all([
      fetch(apiUrl("/api/projects"), { headers: { Authorization: `Bearer ${authToken}` } }),
      isBoard
        ? fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } })
        : departmentId
          ? fetch(apiUrl(`/api/departments/${departmentId}/members`), { headers: { Authorization: `Bearer ${authToken}` } })
          : Promise.resolve(null),
    ]);
    const projData = await projRes.json();
    if (projData.success) setProjects(projData.data || []);
    if (membersRes) {
      const membersData = await membersRes.json();
      setDeptMembers(membersData.success ? (membersData.data || []) : []);
    }
  }

  useEffect(() => { load(); }, []);

  const availableMembers = isBoard ? allUsers : deptMembers;

  const statusFiltered = showCompleted
    ? projects.filter((p: any) => p.status === "completed")
    : projects.filter((p: any) => p.status !== "completed");

  const query = searchQuery.toLowerCase();
  const searched = query
    ? statusFiltered.filter((p: any) =>
        (p.name || "").toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query) ||
        (p.company_org || "").toLowerCase().includes(query)
      )
    : statusFiltered;

  const yearFiltered = yearFilter
    ? searched.filter((p: any) => (p.year || "Unspecified") === yearFilter)
    : searched;

  const sorted = [...yearFiltered].sort((a: any, b: any) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortOrder === "newest" ? db - da : da - db;
  });

  const yearSet = new Set<string>();
  statusFiltered.forEach((p: any) => yearSet.add(p.year || "Unspecified"));
  const availableYears = Array.from(yearSet).sort((a, b) => {
    if (a === "Unspecified") return 1;
    if (b === "Unspecified") return -1;
    return b.localeCompare(a);
  });

  const grouped: Record<string, any[]> = {};
  for (const p of sorted) {
    const key = p.year || "Unspecified";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Unspecified") return 1;
    if (b === "Unspecified") return -1;
    return b.localeCompare(a);
  });

  return (
    <div className="members-grid">
      {isBoard && (
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Create Project</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Create a new project for a company/org and assign which departments can access it.
          </p>
          <CreateProjectSection authToken={authToken} departments={departments} onCreated={load} />
        </div>
      )}

      <div className="card-doodle" style={{ gridColumn: "1 / -1", padding: "0.6rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {showCompleted ? "Completed Projects" : "Active Projects"}
        </span>
        <button className={`btn ${showCompleted ? "" : "outline"}`} style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? "Show Active" : "Completed Projects"}
        </button>
      </div>

      <div className="card-doodle" style={{ gridColumn: "1 / -1", padding: "0.6rem 1rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <select className="input" style={{ width: "auto", minWidth: 100 }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        <select className="input" style={{ width: "auto", minWidth: 100 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {sorted.length === 0 && (
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <p style={{ color: "var(--text-secondary)" }}>No {showCompleted ? "completed" : "active"} projects match your filters.</p>
        </div>
      )}

      {groupKeys.map((yearKey) => (
        <div key={yearKey} style={{ gridColumn: "1 / -1" }}>
          {yearKey !== "Unspecified" && (
            <h3 style={{ margin: "0 0 8px", color: "var(--text-secondary)", fontSize: 16 }}>
              {yearKey}
            </h3>
          )}
          <div className="members-grid" style={{ gap: 12 }}>
            {grouped[yearKey].map((p: any) => {
              const userDeptAssigned = departmentId && p.departments?.some((d: any) => d.id === departmentId);
              const canAssign = (isBoard || (canManage && userDeptAssigned));
              const canManageTasks = isBoard || (canManage && userDeptAssigned);
              return (
                <div key={p.id} className="card-doodle" style={{ gridColumn: "1 / -1", padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: p.status === "completed" ? "var(--primary-green)" : "var(--accent)", color: "#fff", fontWeight: 600 }}>{p.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {p.company_org && <span>{p.company_org}</span>}
                        {p.year && <span>{p.year}</span>}
                        {p.deadline && <span>Deadline: {p.deadline.slice(0, 10)}</span>}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {p.departments?.map((d: any) => (
                          <span key={d.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {showCompleted && powerLevel >= 100 && (
                        <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                          const res = await fetch(apiUrl(`/api/projects/${p.id}/reopen`), {
                            method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                          });
                          const data = await res.json();
                          if (data.success) {
                            setProjects(projects.filter((x: any) => x.id !== p.id));
                            alert("Project reopened");
                          } else alert(data.error);
                        }}>Reopen</button>
                      )}
                      {isBoard && (
                        <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                          if (!confirm(`Delete project "${p.name}"?`)) return;
                          const res = await fetch(apiUrl(`/api/projects/${p.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                          const data = await res.json();
                          if (data.success) setProjects(projects.filter((x: any) => x.id !== p.id));
                          else alert("Delete failed: " + (data.error || "unknown"));
                        }}>Delete</button>
                      )}
                    </div>
                  </div>

                  {p.description && (
                    <div style={{ marginTop: 10, padding: "0.6rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>{p.description}</div>
                  )}

                  {p.roles?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ fontSize: 13, color: "var(--text-secondary)" }}>Team Roles</strong>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {p.roles.map((r: any) => (
                          <div key={r.id} style={{ padding: "0.3rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 6 }}>
                            <strong style={{ fontSize: 13 }}>{r.user_name}</strong>
                            <span style={{ fontSize: 12, color: "var(--primary-green)" }}>({r.role_name})</span>
                            {canAssign && (
                              <button style={{ border: "none", background: "none", color: "var(--text-light)", cursor: "pointer", fontSize: 14, padding: "0 2px" }} onClick={async () => {
                                await fetch(apiUrl(`/api/projects/${p.id}/roles/${r.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                                load();
                              }}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canAssign && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
                      <select className="input" style={{ flex: 1, minWidth: 140 }} value={assignProjectId === p.id ? assignUserId : ""} onChange={(e) => { setAssignProjectId(p.id); setAssignUserId(e.target.value); }}>
                        <option value="">Select member</option>
                        {availableMembers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                      <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Role name" value={assignProjectId === p.id ? assignRoleName : ""} onChange={(e) => { setAssignProjectId(p.id); setAssignRoleName(e.target.value); }} />
                      <button className="btn" disabled={assignBusy} onClick={async () => {
                        if (!assignUserId || !assignRoleName) return alert("Select member and enter role name");
                        setAssignBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/projects/${p.id}/roles`), {
                            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                            body: JSON.stringify({ userId: assignUserId, roleName: assignRoleName }),
                          });
                          const data = await res.json();
                          if (data.success) { setAssignUserId(""); setAssignRoleName(""); setAssignProjectId(""); load(); alert("Role assigned. Email sent."); }
                          else alert(data.error);
                        } finally { setAssignBusy(false); }
                      }}>{assignBusy ? "Assigning..." : "Assign Role"}</button>
                      {assignBusy && <FullPageLoader message="Assigning role and sending email..." />}
                    </div>
                  )}

                  <ProjectTasksSection
                    authToken={authToken}
                    projectId={p.id}
                    projectStatus={p.status}
                    canManageTasks={canManageTasks}
                    isBoard={isBoard}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
