/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { buildRoster, teamCountByPerson } from "./treeUtils";
import { DEPT_NAMES } from "../constants";

/** Flat "who is actually involved" table for one instance — every person, every team. */
export default function RosterView({ instance }: { instance: any }) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "internal" | "external">("all");

  const rows = useMemo(() => buildRoster(instance), [instance]);
  const multi = useMemo(() => teamCountByPerson(rows), [rows]);

  const q = query.toLowerCase().trim();
  const visible = rows.filter((r: any) => {
    if (only !== "all" && r.kind !== only) return false;
    if (!q) return true;
    return [r.name, r.email, r.affiliation, r.groupName, r.teamName].some((v: string) => (v || "").toLowerCase().includes(q));
  });

  const distinctPeople = new Set(rows.map((r: any) => `${r.kind}:${r.memberId}`)).size;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Filter roster..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ width: "auto" }} value={only} onChange={(e) => setOnly(e.target.value as any)}>
          <option value="all">Everyone</option>
          <option value="internal">Club members only</option>
          <option value="external">Outside members only</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {visible.length} placement{visible.length === 1 ? "" : "s"} · {distinctPeople} {distinctPeople === 1 ? "person" : "people"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>Nobody matches that filter.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-light)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
            <thead>
              <tr style={{ background: "var(--surface-container-low)" }}>
                {["Name", "Type", "Department / Org", "Group", "Team"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r: any) => {
                const teams = multi.get(`${r.kind}:${r.memberId}`) || 1;
                return (
                  <tr key={r.key} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                        {teams > 1 && (
                          <span title={`On ${teams} teams in this instance`} style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: "rgba(59, 130, 246, 0.14)", color: "#3b82f6" }}>
                            ×{teams}
                          </span>
                        )}
                      </div>
                      {r.email && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.email}</div>}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "2px 8px", borderRadius: 6,
                        background: r.kind === "external" ? "rgba(245, 158, 11, 0.14)" : "var(--accent-bg)",
                        color: r.kind === "external" ? "#b45309" : "var(--primary-green)",
                      }}>
                        {r.kind === "external" ? "Outside" : r.role}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {r.kind === "external" ? r.affiliation : (DEPT_NAMES[r.affiliation] || r.affiliation)}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{r.groupName}</td>
                    <td style={{ padding: "10px 12px" }}>{r.teamName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
