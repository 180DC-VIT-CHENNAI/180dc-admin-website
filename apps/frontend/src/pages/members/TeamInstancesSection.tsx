/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import { DEPT_NAMES } from "./constants";

export default function TeamInstancesSection({ authToken, powerLevel, departmentId, departments, allUsers }: {
  authToken: string;
  powerLevel: number;
  departmentId: string | null;
  departments: any[];
  allUsers: any[];
}) {
  const [instances, setInstances] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isBoard = powerLevel >= 100;
  const canCreate = powerLevel >= 50;

  // Create-instance form
  const [instName, setInstName] = useState("");
  const [instDesc, setInstDesc] = useState("");
  const [instDeptIds, setInstDeptIds] = useState<string[]>([]);
  const [instBusy, setInstBusy] = useState(false);

  // Per-instance create-team form
  const [teamFormInstanceId, setTeamFormInstanceId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamSizeMode, setTeamSizeMode] = useState<"none" | "range" | "exact">("none");
  const [teamMin, setTeamMin] = useState("");
  const [teamMax, setTeamMax] = useState("");
  const [teamExact, setTeamExact] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);

  // Per-team edit form
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSizeMode, setEditSizeMode] = useState<"none" | "range" | "exact">("none");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editExact, setEditExact] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // Per-team add-member
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [addMemberBusy, setAddMemberBusy] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };

  async function load() {
    const res = await fetch(apiUrl("/api/team-instances"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setInstances(data.data || []);
    else if (data.error) alert(data.error);
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  const eligibleUsers = allUsers
    .filter((u: any) => u.role_id !== "advisory")
    .filter((u: any) => isBoard || u.department_id === departmentId);

  const search = teamMemberSearch.toLowerCase();
  const filteredEligible = search
    ? eligibleUsers.filter((u: any) => (u.name || "").toLowerCase().includes(search) || (u.email || "").toLowerCase().includes(search))
    : eligibleUsers;

  function canManageInstance(inst: any) {
    if (powerLevel >= 100) return true;
    if (powerLevel >= 50 && departmentId) {
      return (inst.departments || []).some((d: any) => d.id === departmentId);
    }
    return false;
  }

  async function createInstance() {
    if (!instName.trim()) return alert("Enter an instance name");
    if (isBoard && instDeptIds.length === 0) return alert("Select at least one department");
    setInstBusy(true);
    try {
      const res = await fetch(apiUrl("/api/team-instances"), {
        method: "POST", headers,
        body: JSON.stringify({ name: instName, description: instDesc, departmentIds: isBoard ? instDeptIds : undefined }),
      });
      const data = await res.json();
      if (data.success) { setInstName(""); setInstDesc(""); setInstDeptIds([]); load(); alert("Instance created."); }
      else alert(data.error);
    } finally { setInstBusy(false); }
  }

  async function deleteInstance(inst: any) {
    if (!confirm(`Delete instance "${inst.name}" and all its teams?`)) return;
    const res = await fetch(apiUrl(`/api/team-instances/${inst.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setInstances(instances.filter((x: any) => x.id !== inst.id));
    else alert(data.error);
  }

  function resolveSizePayload(mode: "none" | "range" | "exact", min: string, max: string, exact: string): { minMembers?: number; maxMembers?: number } | null {
    if (mode === "none") return {};
    if (mode === "exact") {
      if (!Number.isInteger(Number(exact)) || Number(exact) < 1) return null;
      return { minMembers: Number(exact), maxMembers: Number(exact) };
    }
    const payload: { minMembers?: number; maxMembers?: number } = {};
    if (min !== "") {
      if (!Number.isInteger(Number(min)) || Number(min) < 1) return null;
      payload.minMembers = Number(min);
    }
    if (max !== "") {
      if (!Number.isInteger(Number(max)) || Number(max) < 1) return null;
      payload.maxMembers = Number(max);
    }
    if (payload.minMembers != null && payload.maxMembers != null && payload.minMembers > payload.maxMembers) return null;
    return payload;
  }

  async function createTeam(instanceId: string) {
    if (!teamName.trim()) return alert("Enter a team name");
    const size = resolveSizePayload(teamSizeMode, teamMin, teamMax, teamExact);
    if (size === null) return alert("Invalid size settings — values must be positive integers, and min cannot exceed max");
    setTeamBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/teams`), {
        method: "POST", headers,
        body: JSON.stringify({ name: teamName, description: teamDesc || undefined, ...size, memberIds: teamMemberIds }),
      });
      const data = await res.json();
      if (data.success) { setTeamName(""); setTeamDesc(""); setTeamSizeMode("none"); setTeamMin(""); setTeamMax(""); setTeamExact(""); setTeamMemberIds([]); setTeamMemberSearch(""); setTeamFormInstanceId(null); load(); alert("Team created."); }
      else alert(data.error);
    } finally { setTeamBusy(false); }
  }

  async function saveTeamEdit(instanceId: string, teamId: string) {
    if (!editName.trim()) return alert("Team name cannot be empty");
    const size = resolveSizePayload(editSizeMode, editMin, editMax, editExact);
    if (size === null) return alert("Invalid size settings — values must be positive integers, and min cannot exceed max");
    setEditBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/teams/${teamId}`), {
        method: "PUT", headers,
        body: JSON.stringify({ name: editName, description: editDesc, ...size }),
      });
      const data = await res.json();
      if (data.success) { setEditTeamId(null); load(); }
      else alert(data.error);
    } finally { setEditBusy(false); }
  }

  async function deleteTeam(instanceId: string, team: any) {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/teams/${team.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) load();
    else alert(data.error);
  }

  async function addMember(instanceId: string, team: any) {
    if (!addMemberUserId) return alert("Select a member");
    setAddMemberBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/teams/${team.id}/members`), {
        method: "POST", headers, body: JSON.stringify({ userId: addMemberUserId }),
      });
      const data = await res.json();
      if (data.success) { setAddMemberUserId(""); setAddMemberTeamId(null); load(); }
      else alert(data.error);
    } finally { setAddMemberBusy(false); }
  }

  async function removeMember(instanceId: string, team: any, userId: string, userName: string) {
    if (!confirm(`Remove ${userName} from this team?`)) return;
    const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/teams/${team.id}/members/${userId}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) load();
    else alert(data.error);
  }

  function deptName(id: string) {
    return DEPT_NAMES[id] || departments.find((d: any) => d.id === id)?.name || id;
  }

  function memberCountBadge(team: any) {
    const n = team.member_count != null ? team.member_count : (team.members || []).length;
    const min = team.min_members != null ? team.min_members : null;
    const max = team.member_limit != null ? team.member_limit : null;
    if (min != null && max != null && min === max) return `${n} / ${min} required`;
    if (min != null && max != null) return `${n} (min ${min}, max ${max})`;
    if (max != null) return `${n} / ${max}`;
    if (min != null) return `${n} (min ${min})`;
    return `${n}`;
  }

  const q = searchQuery.toLowerCase().trim();
  const visibleInstances = q
    ? instances.map((inst: any) => {
        const instMatch = (inst.name || "").toLowerCase().includes(q) || (inst.description || "").toLowerCase().includes(q);
        if (instMatch) return inst;
        const teams = (inst.teams || []).filter((t: any) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.members || []).some((m: any) => (m.user_name || "").toLowerCase().includes(q) || (m.user_email || "").toLowerCase().includes(q))
        );
        return teams.length > 0 ? { ...inst, teams } : null;
      }).filter(Boolean)
    : instances;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {canCreate && (
        <div className="dashboard-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>add_circle</span>
            <h3 style={{ margin: 0 }}>Create New Instance</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="input" placeholder="Instance name (e.g. Recruitment Website 2026)" value={instName} onChange={(e) => setInstName(e.target.value)} />
            <textarea className="input" placeholder="Description (optional)" rows={2} value={instDesc} onChange={(e) => setInstDesc(e.target.value)} />
            {isBoard ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>DEPARTMENTS INVOLVED</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {departments.map((d: any) => (
                    <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px", background: "var(--surface-container-low)", border: "1px solid var(--border-light)", borderRadius: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={instDeptIds.includes(d.id)} onChange={(e) => {
                        setInstDeptIds(e.target.checked ? [...instDeptIds, d.id] : instDeptIds.filter((x) => x !== d.id));
                      }} />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                This instance will be scoped to your department ({departmentId ? deptName(departmentId) : "no department assigned"}).
              </p>
            )}
            <div>
              <button className="btn" disabled={instBusy} onClick={createInstance}>
                <span className="material-symbols-outlined">rocket_launch</span>
                {instBusy ? "Creating..." : "Create Instance"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "var(--text-tertiary)" }}>search</span>
          <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search instances, teams, or members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {q && (
          <button className="btn outline" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setSearchQuery("")}>
            <span className="material-symbols-outlined">close</span>
            Clear
          </button>
        )}
      </div>

      {loaded && instances.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>diversity_3</span>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>No team instances yet. An instance is an event, case comp, or application split into teams.</p>
        </div>
      )}

      {loaded && instances.length > 0 && visibleInstances.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>search_off</span>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>No instances or teams match "{searchQuery}".</p>
        </div>
      )}

      {visibleInstances.map((inst: any) => {
        const manage = canManageInstance(inst);
        return (
          <div key={inst.id} className="dashboard-card" style={{ gridColumn: "1 / -1", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>{inst.name}</h3>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "2px 10px", borderRadius: 20, background: "var(--accent-bg)", color: "var(--primary-green)", border: "1px solid var(--border-light)" }}>
                    Instance
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {inst.created_by_name && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>{inst.created_by_name}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>{inst.created_at?.slice(0, 10)}</span>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(inst.departments || []).map((d: any) => (
                    <span key={d.id} style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 6, background: "var(--surface-container-low)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
              {manage && (
                <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={() => deleteInstance(inst)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
            </div>

            {inst.description && (
              <div style={{ marginTop: "1.25rem", padding: "1rem", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-light)", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6 }}>
                {inst.description}
              </div>
            )}

            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {(inst.teams || []).length === 0 && (
                <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>No teams created yet.</span>
              )}
              {(inst.teams || []).map((team: any) => {
                const memberN = team.member_count != null ? team.member_count : (team.members || []).length;
                const needsMore = team.requirement_met != null
                  ? !team.requirement_met
                  : (team.min_members != null && memberN < team.min_members);
                const isFull = team.is_full != null
                  ? team.is_full
                  : (team.member_limit != null && memberN >= team.member_limit);
                const deficit = team.min_members != null ? Math.max(0, team.min_members - memberN) : 0;
                const memberIdsInTeam = new Set((team.members || []).map((m: any) => m.user_id));
                const addableUsers = eligibleUsers.filter((u: any) => !memberIdsInTeam.has(u.id) && !isFull);
                return (
                  <div key={team.id} style={{
                    padding: "1rem",
                    background: needsMore ? "rgba(239, 68, 68, 0.06)" : "var(--surface)",
                    borderRadius: 12,
                    border: needsMore ? "2px solid #ef4444" : "1px solid var(--border-light)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: needsMore ? "#ef4444" : "var(--primary-green)" }}>{needsMore ? "error" : "group_work"}</span>
                        <strong>{team.name}</strong>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: isFull ? "rgba(239, 68, 68, 0.1)" : "var(--accent-bg)", color: isFull ? "#ef4444" : "var(--primary-green)" }}>
                          {memberCountBadge(team)}
                        </span>
                        {needsMore && (
                          <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                            NEEDS {deficit} MORE MEMBER{deficit === 1 ? "" : "S"}
                          </span>
                        )}
                      </div>
                      {manage && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn outline" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => {
                            if (editTeamId === team.id) { setEditTeamId(null); return; }
                            setEditTeamId(team.id); setEditName(team.name); setEditDesc(team.description || "");
                            const tMin = team.min_members != null ? team.min_members : null;
                            const tMax = team.member_limit != null ? team.member_limit : null;
                            setEditMin(""); setEditMax(""); setEditExact("");
                            if (tMin == null && tMax == null) setEditSizeMode("none");
                            else if (tMin != null && tMax != null && tMin === tMax) { setEditSizeMode("exact"); setEditExact(String(tMin)); }
                            else { setEditSizeMode("range"); setEditMin(tMin != null ? String(tMin) : ""); setEditMax(tMax != null ? String(tMax) : ""); }
                          }}>{editTeamId === team.id ? "Cancel" : "Edit"}</button>
                          <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={() => deleteTeam(inst.id, team)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {team.description && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{team.description}</div>
                    )}

                    {editTeamId === team.id && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-container-low)", border: "1px dashed var(--outline-variant)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <input className="input" placeholder="Team name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <textarea className="input" placeholder="Task description (optional)" rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <select className="input" style={{ width: "auto" }} value={editSizeMode} onChange={(e) => setEditSizeMode(e.target.value as "none" | "range" | "exact")}>
                            <option value="none">No size requirement</option>
                            <option value="range">Range (min–max)</option>
                            <option value="exact">Exactly (required)</option>
                          </select>
                          {editSizeMode === "range" && (
                            <>
                              <input className="input" type="number" min={1} placeholder="Min" style={{ width: 100 }} value={editMin} onChange={(e) => setEditMin(e.target.value)} />
                              <input className="input" type="number" min={1} placeholder="Max" style={{ width: 100 }} value={editMax} onChange={(e) => setEditMax(e.target.value)} />
                            </>
                          )}
                          {editSizeMode === "exact" && (
                            <input className="input" type="number" min={1} placeholder="Required count" style={{ width: 140 }} value={editExact} onChange={(e) => setEditExact(e.target.value)} />
                          )}
                        </div>
                        <div>
                          <button className="btn" disabled={editBusy} onClick={() => saveTeamEdit(inst.id, team.id)}>
                            <span className="material-symbols-outlined">save</span>
                            {editBusy ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(team.members || []).length > 0 ? team.members.map((m: any) => (
                        <div key={m.user_id} style={{ padding: "6px 12px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8, boxShadow: "var(--shadow-sm)" }}>
                          <div className="avatar-circle" style={{ width: 24, height: 24, fontSize: 10, background: "var(--accent-bg)", color: "var(--accent)" }}>{m.user_name?.[0]?.toUpperCase()}</div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.user_name}</span>
                          {manage && (
                            <button style={{ border: "none", background: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", padding: 0 }} onClick={() => removeMember(inst.id, team, m.user_id, m.user_name)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                            </button>
                          )}
                        </div>
                      )) : <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>No members yet.</span>}
                    </div>

                    {manage && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-container-low)", border: "1px dashed var(--outline-variant)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>ADD MEMBER</div>
                        {isFull ? (
                          <span style={{ fontSize: 13, color: "#ef4444" }}>Team is full (limit {team.member_limit}).</span>
                        ) : (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <select className="input" style={{ flex: 2, minWidth: 200 }} value={addMemberTeamId === team.id ? addMemberUserId : ""} onChange={(e) => { setAddMemberTeamId(team.id); setAddMemberUserId(e.target.value); }}>
                              <option value="">Select a member...</option>
                              {addableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                            </select>
                            <button className="btn" style={{ gap: 8 }} disabled={addMemberBusy} onClick={() => addMember(inst.id, team)}>
                              <span className="material-symbols-outlined">person_add</span>
                              Add
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {manage && (
              <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: 12, background: "var(--surface-container-low)", border: "1px dashed var(--outline-variant)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--primary-green)" }}>add_circle</span>
                  <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Create Team</strong>
                </div>
                {teamFormInstanceId === inst.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input className="input" placeholder="Team name (e.g. Frontend, Backend, Design)" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                    <textarea className="input" placeholder="Task description (optional)" rows={2} value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <select className="input" style={{ width: "auto" }} value={teamSizeMode} onChange={(e) => setTeamSizeMode(e.target.value as "none" | "range" | "exact")}>
                        <option value="none">No size requirement</option>
                        <option value="range">Range (min–max)</option>
                        <option value="exact">Exactly (required)</option>
                      </select>
                      {teamSizeMode === "range" && (
                        <>
                          <input className="input" type="number" min={1} placeholder="Min members" style={{ width: 130 }} value={teamMin} onChange={(e) => setTeamMin(e.target.value)} />
                          <input className="input" type="number" min={1} placeholder="Max members" style={{ width: 130 }} value={teamMax} onChange={(e) => setTeamMax(e.target.value)} />
                        </>
                      )}
                      {teamSizeMode === "exact" && (
                        <input className="input" type="number" min={1} placeholder="Required no. of members" style={{ width: 190 }} value={teamExact} onChange={(e) => setTeamExact(e.target.value)} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
                        MEMBERS {isBoard ? "(any registered member)" : `(your department — ${departmentId ? deptName(departmentId) : "none"})`}
                      </div>
                      <input className="input" placeholder="Search members..." value={teamMemberSearch} onChange={(e) => setTeamMemberSearch(e.target.value)} style={{ marginBottom: 8 }} />
                      <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, background: "var(--bg-card)" }}>
                        {filteredEligible.length === 0 && <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>No eligible members found.</span>}
                        {filteredEligible.map((u: any) => (
                          <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>
                            <input type="checkbox" checked={teamMemberIds.includes(u.id)} onChange={(e) => {
                              setTeamMemberIds(e.target.checked ? [...teamMemberIds, u.id] : teamMemberIds.filter((x) => x !== u.id));
                            }} />
                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                            <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{u.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn" disabled={teamBusy} onClick={() => createTeam(inst.id)}>
                        <span className="material-symbols-outlined">group_add</span>
                        {teamBusy ? "Creating..." : "Create Team"}
                      </button>
                      <button className="btn outline" onClick={() => { setTeamFormInstanceId(null); setTeamMemberIds([]); setTeamMemberSearch(""); setTeamSizeMode("none"); setTeamMin(""); setTeamMax(""); setTeamExact(""); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn outline" onClick={() => { setTeamFormInstanceId(inst.id); setTeamName(""); setTeamDesc(""); setTeamSizeMode("none"); setTeamMin(""); setTeamMax(""); setTeamExact(""); setTeamMemberIds([]); }}>
                    <span className="material-symbols-outlined">add</span>
                    New Team
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
