import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function InstructionsSection({ authToken, departmentId }: { authToken: string; departmentId: string }) {
  const [instructions, setInstructions] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl(`/api/departments/${departmentId}/instructions`), { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setInstructions(d.data || []); })
      .catch(() => { /* ignore */ });
  }, [departmentId, authToken]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {instructions.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--outline-variant)", borderRadius: 12 }}>
          No instructions assigned to your department yet.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {// fallow-ignore-next-line complexity
        instructions.map((inst) => (
          <div key={inst.id} style={{ 
            padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                 <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-bg)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu_book</span>
                 </div>
                 <strong style={{ fontSize: "1rem", fontWeight: 700 }}>{inst.title}</strong>
              </div>
              <span style={{ 
                fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "4px 10px", borderRadius: 20,
                background: inst.priority === "high" ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                color: inst.priority === "high" ? "#ef4444" : "#3b82f6",
                border: `1px solid ${inst.priority === "high" ? "#ef444433" : "#3b82f633"}`
              }}>
                {inst.priority}
              </span>
            </div>
            <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{inst.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
