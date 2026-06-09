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

  useEffect(() => { load(); }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {transfers.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No pending role transfers involving you.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {transfers.map((t: any) => (
          <div key={t.id} className="card-doodle" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{t.from_name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>→</span> <strong>{t.to_name}</strong>
                <div style={{ color: "var(--primary-green)", fontSize: 13 }}>Role: {t.role_name}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ padding: "0.4rem 1rem" }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/accept`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); }
                  else alert(d.error);
                }}>Accept</button>
                <button className="btn outline" style={{ padding: "0.4rem 1rem" }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/decline`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); }
                  else alert(d.error);
                }}>Decline</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
