import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import { DEPT_NAMES } from "./constants";

export default function MembersSection({ authToken }: { authToken: string; powerLevel: number }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/members-directory"), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.success) setMembers(data.data || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authToken]);

  const testAccounts = new Set(["kevindaniel.2025@vitstudent.ac.in", "admin@vitstudent.ac.in"]);

  async function handleExport() {
    const res = await fetch(apiUrl("/api/members/export"), {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const roleOrder: Record<string, number> = {
    president: 0,
    vice_president: 1,
    secretary: 2,
    lead: 3,
    member: 4,
  };

  const q = query.toLowerCase();
  const filtered = members.filter((m: any) => {
    if (!q) return true;
    const deptName = m.department_id ? (DEPT_NAMES[m.department_id] || m.department_id) : "";
    return (
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      (m.role_name || "").toLowerCase().includes(q) ||
      deptName.toLowerCase().includes(q)
    );
  });

  const deptGroups: Record<string, any[]> = {};
  for (const m of filtered) {
    const key = m.department_id || "__none";
    if (!deptGroups[key]) deptGroups[key] = [];
    deptGroups[key].push(m);
  }

  const deptKeys = Object.keys(deptGroups).sort((a, b) => {
    if (a === "__none") return 1;
    if (b === "__none") return -1;
    return (DEPT_NAMES[a] || a).localeCompare(DEPT_NAMES[b] || b);
  });

  for (const key of deptKeys) {
    deptGroups[key].sort((a: any, b: any) => {
      const orderA = roleOrder[a.role_id] ?? 99;
      const orderB = roleOrder[b.role_id] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div style={{ textAlign: "center" }}>
          <div className="avatar-circle" style={{ margin: "0 auto 1rem", animation: "pulse 2s infinite" }}>
            <span className="material-symbols-outlined">hourglass_empty</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Loading members directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ 
        display: "flex", flexWrap: "wrap", alignItems: "center", 
        justifyContent: "space-between", gap: "1rem" 
      }}>
        <div style={{ flex: 1, minWidth: 300, position: "relative" }}>
          <span className="material-symbols-outlined" style={{ 
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-tertiary)", fontSize: 20
          }}>search</span>
          <input
            className="input"
            placeholder="Search by name, email, role, or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "2.75rem" }}
          />
        </div>
        <button className="btn outline" onClick={handleExport} style={{ gap: 8 }}>
          <span className="material-symbols-outlined">download</span>
          Export CSV
        </button>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        Showing {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== members.length && ` (filtered from ${members.length})`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {deptKeys.length === 0 && (
          <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>person_search</span>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 15 }}>No members match your search criteria.</p>
          </div>
        )}
        {deptKeys.map((key) => (
          <div key={key}>
            <div style={{ 
              display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem",
              paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-light)"
            }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {key === "__none" ? "Unassigned Members" : (DEPT_NAMES[key] || key)}
              </h3>
              <span style={{ 
                fontSize: 11, fontWeight: 800, background: "var(--surface-container-high)", 
                color: "var(--text-secondary)", padding: "2px 8px", borderRadius: 12,
                textTransform: "uppercase"
              }}>
                {deptGroups[key].length}
              </span>
            </div>
            
            <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {deptGroups[key].map((m: any) => (
                <div
                  key={m.id}
                  className="dashboard-card"
                  style={{ 
                    display: "flex", gap: "1rem", alignItems: "center",
                    padding: "1rem", transition: "all 0.2s"
                  }}
                >
                  <div className="avatar-circle" style={{ 
                    width: 44, height: 44, flexShrink: 0, 
                    fontSize: 14, background: "var(--surface-container-high)", color: "var(--text-primary)" 
                  }}>
                    {m.name?.[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{m.name}</span>
                      {testAccounts.has(m.email) && (
                        <span style={{ 
                          fontSize: 9, padding: "1px 6px", borderRadius: 4, 
                          background: "var(--accent-bg)", color: "var(--accent)", 
                          fontWeight: 800, textTransform: "uppercase" 
                        }}>Test</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                  </div>
                  <div style={{ 
                    fontSize: 11, fontWeight: 700, color: "var(--primary-green)", 
                    background: "rgba(141, 198, 63, 0.1)", padding: "4px 8px", 
                    borderRadius: 6, whiteSpace: "nowrap" 
                  }}>
                    {m.role_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
