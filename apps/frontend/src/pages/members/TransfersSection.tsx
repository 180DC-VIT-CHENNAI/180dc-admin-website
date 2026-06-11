import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function TransfersSection({ authToken }: { authToken: string }) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(apiUrl("/api/my-role-transfers"), { headers: { Authorization: `Bearer ${authToken}` } });
      const d = await res.json();
      if (d.success) setTransfers(d.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [authToken]);

  if (loading) return <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>Checking for transfers...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {transfers.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--outline-variant)", borderRadius: 12 }}>
          No pending role transfers involving you.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {transfers.map((t: any) => (
          <div key={t.id} style={{ 
            padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1rem }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                 <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-bg)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined">swap_horiz</span>
                 </div>
                 <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "14px", fontWeight: 700 }}>
                       <span>{t.from_name}</span>
                       <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>arrow_forward</span>
                       <span>{t.to_name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--primary-green)", fontWeight: 600, marginTop: 4 }}>Role Transfer: {t.role_name}</div>
                 </div>
              </div>
              
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ padding: "8px 16px", fontSize: 13 }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/accept`), { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); } else alert(d.error);
                }}>Accept</button>
                <button className="btn outline" style={{ padding: "8px 16px", fontSize: 13, borderColor: "#ef4444", color: "#ef4444" }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/decline`), { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); } else alert(d.error);
                }}>Decline</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
