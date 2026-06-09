import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function InstructionsSection({ authToken, departmentId }: { authToken: string; departmentId: string }) {
  const [instructions, setInstructions] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl(`/api/departments/${departmentId}/instructions`), { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setInstructions(d.data || []); })
      .catch(() => { /* ignore */ });
  }, [departmentId]);

  return (
    <div>
      {instructions.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No instructions for your department.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {instructions.map((inst) => (
          <div key={inst.id} className="card-doodle" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: 15 }}>{inst.title}</strong>
              <span className="floating-note" style={{ fontSize: 11, padding: "0.15rem 0.5rem", transform: "none" }}>
                {inst.priority}
              </span>
            </div>
            <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", fontSize: 14 }}>{inst.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
