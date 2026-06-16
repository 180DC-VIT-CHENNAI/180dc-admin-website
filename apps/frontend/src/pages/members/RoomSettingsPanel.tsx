import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

// fallow-ignore-next-line complexity
export default function RoomSettingsPanel({ authToken, powerLevel, departmentId, roleId, departments }: { authToken: string; powerLevel: number; departmentId: string | null; roleId: string | null; departments: any[] }) {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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
    { id: "general", label: "General Chat", icon: "forum" },
    { id: "advisory", label: "Advisory Chat", icon: "admin_panel_settings" },
    { id: "board", label: "Board Chat", icon: "shield_person" },
    ...departments.map((d: any) => ({ id: `dept-${d.id}`, label: `${d.name} Chat`, icon: "chat_bubble" })),
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

  async function lockAll() {
    setBulkBusy(true);
    try {
      const res = await fetch(apiUrl("/api/chat/rooms/lock-all"), {
        method: "POST", headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        const allOff: Record<string, boolean> = {};
        rooms.forEach(r => { allOff[r.id] = false; });
        setSettings(allOff);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function unlockAll() {
    setBulkBusy(true);
    try {
      const res = await fetch(apiUrl("/api/chat/rooms/unlock-all"), {
        method: "POST", headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        const allOn: Record<string, boolean> = {};
        rooms.forEach(r => { allOn[r.id] = true; });
        setSettings(allOn);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="dashboard-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
           <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>tune</span>
           <h3 style={{ margin: 0 }}>Chat Management</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: "1.5rem" }}>
          Control which chat rooms are active and visible in the portal. Disabled rooms will be hidden from all members.
        </p>

        {canManageAll && (
          <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
            <button onClick={lockAll} disabled={bulkBusy} className="btn" style={{ padding: "6px 16px", fontSize: 12, gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
              {bulkBusy ? "Working..." : "Lock All"}
            </button>
            <button onClick={unlockAll} disabled={bulkBusy} className="btn outline" style={{ padding: "6px 16px", fontSize: 12, gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_open</span>
              {bulkBusy ? "Working..." : "Unlock All"}
            </button>
          </div>
        )}
        
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rooms.map(r => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "1rem 1.25rem", background: "var(--surface)",
              borderRadius: 16, border: "1px solid var(--border-light)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                 <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{r.icon}</span>
                 </div>
                 <span style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</span>
              </div>
              
              <button
                onClick={() => toggle(r.id)}
                disabled={busy === r.id}
                className={`btn ${settings[r.id] === false ? "outline" : ""}`}
                style={{
                  padding: "6px 16px", fontSize: 12, minWidth: 100, gap: 8,
                  background: settings[r.id] === false ? "transparent" : "var(--primary-green)",
                  color: settings[r.id] === false ? "var(--text-secondary)" : "#fff",
                  borderColor: settings[r.id] === false ? "var(--outline-variant)" : "transparent"
                }}
              >
                {busy === r.id ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: "spin 2s linear infinite" }}>sync</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{settings[r.id] === false ? "toggle_off" : "toggle_on"}</span>
                )}
                {settings[r.id] === false ? "Disabled" : "Active"}
              </button>
            </div>
          ))}
        </div>
        {rooms.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--outline-variant)", borderRadius: 16 }}>
             <p style={{ color: "var(--text-secondary)", margin: 0 }}>No rooms available to manage with your current permissions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
