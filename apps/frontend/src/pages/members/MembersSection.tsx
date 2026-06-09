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
      <div className="members-grid">
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Members</h2>
        <button className="btn" onClick={handleExport}>
          Export CSV
        </button>
      </div>
      <div className="card-doodle" style={{ marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Search by name, email, role, or department..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%" }}
        />
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 10 }}>
          Showing {filtered.length} member{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== members.length && ` (filtered from ${members.length})`}
        </div>
      </div>
      <div className="members-grid" style={{ gap: 16 }}>
        {deptKeys.length === 0 && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>No members match your search.</p>
          </div>
        )}
        {deptKeys.map((key) => (
          <div key={key} className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {key === "__none" ? "No Department" : (DEPT_NAMES[key] || key)}
              </h3>
              <span style={{ fontSize: 13, color: "var(--text-light)" }}>
                {deptGroups[key].length} member{deptGroups[key].length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {deptGroups[key].map((m: any) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.65rem 0.9rem", background: "var(--bg-secondary)",
                    borderRadius: 10, border: "1px solid var(--border-light)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</span>
                      {testAccounts.has(m.email) && (
                        <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 5, background: "var(--accent)", color: "#fff", fontWeight: 600, lineHeight: "18px" }}>test account</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{m.email}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--primary-green)", textAlign: "right", whiteSpace: "nowrap" }}>
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
