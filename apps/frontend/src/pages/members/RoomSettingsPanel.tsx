import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function RoomSettingsPanel({ authToken, powerLevel, departmentId, roleId, departments }: { authToken: string; powerLevel: number; departmentId: string | null; roleId: string | null; departments: any[] }) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/chat/rooms"), { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const map: Record<string, boolean> = {};
          (d.data || []).forEach((r: any) => { map[r.room] = !!r.enabled; });
          setSettings(map);
        }
      })
      .catch((err) => console.error("Failed to fetch settings:", err));
  }, [authToken]);

  const canManageAll = powerLevel >= 100;

  const rooms = [
    { id: "general", label: "General Chat" },
    { id: "advisory", label: "Advisory Chat" },
    { id: "board", label: "Board Chat" },
    ...departments.map((d: any) => ({ id: `dept-${d.id}`, label: `${d.name} Chat` })),
  ].filter(r => {
    if (canManageAll) return true;
    if (!r.id.startsWith("dept-")) return false;
    const deptId = r.id.replace("dept-", "");
    if (powerLevel >= 50 && deptId === departmentId) return true;
    const roleDeptAccess: Record<string, string[]> = { marketing_director: ["marketing", "social_media"] };
    const allowedDepts = roleDeptAccess[roleId || ""];
    if (allowedDepts && allowedDepts.includes(deptId)) return true;
    return false;
  });

  async function toggle(room: string) {
    setBusy(room);
    try {
      const res = await fetch(apiUrl(`/api/chat/rooms/${room}/toggle`), {
        method: "POST", headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, [room]: data.enabled }));
      } else {
        alert(data.error || "Failed to toggle");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Chat Room Settings</h2>
      <div className="card-doodle">
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
          Enable or disable chat rooms. Disabled rooms are hidden from the sidebar.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {rooms.map(r => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.6rem 0.8rem", background: "var(--bg-secondary)",
              borderRadius: 8, border: "1px solid var(--border-light)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</span>
              <button
                onClick={() => toggle(r.id)}
                disabled={busy === r.id}
                style={{
                  padding: "0.3rem 0.8rem", fontSize: 12, minWidth: 64,
                  background: settings[r.id] === false ? "transparent" : "var(--primary-green)",
                  color: settings[r.id] === false ? "var(--text-secondary)" : "#fff",
                  border: `1px solid ${settings[r.id] === false ? "var(--border-light)" : "var(--primary-green)"}`,
                  borderRadius: 6, cursor: busy === r.id ? "default" : "pointer",
                  fontWeight: 500,
                }}
              >
                {busy === r.id ? "..." : settings[r.id] === false ? "Disabled" : "Enabled"}
              </button>
            </div>
          ))}
        </div>
        {rooms.length === 0 && (
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No rooms available to manage.</p>
        )}
      </div>
    </div>
  );
}
