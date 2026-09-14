/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { apiUrl } from "../../../lib/api";

const ACTION_LABELS: Record<string, { text: string; icon: string; color: string }> = {
  team_instance_created: { text: "created the instance", icon: "rocket_launch", color: "var(--primary-green)" },
  team_instance_updated: { text: "updated the instance", icon: "edit", color: "var(--text-secondary)" },
  instance_group_created: { text: "added a group", icon: "corporate_fare", color: "var(--primary-green)" },
  instance_group_updated: { text: "renamed a group", icon: "edit", color: "var(--text-secondary)" },
  instance_group_deleted: { text: "deleted a group", icon: "delete", color: "#ef4444" },
  team_created: { text: "created a team", icon: "group_add", color: "var(--primary-green)" },
  team_updated: { text: "updated a team", icon: "edit", color: "var(--text-secondary)" },
  team_deleted: { text: "deleted a team", icon: "delete", color: "#ef4444" },
  team_member_added: { text: "added a member", icon: "person_add", color: "var(--primary-green)" },
  team_member_removed: { text: "removed a member", icon: "person_remove", color: "#ef4444" },
  team_member_moved: { text: "moved a member", icon: "swap_horiz", color: "#3b82f6" },
  team_outside_member_added: { text: "added an outside member", icon: "person_add", color: "#b45309" },
  team_outside_member_removed: { text: "removed an outside member", icon: "person_remove", color: "#ef4444" },
  outside_member_created: { text: "registered an outside member", icon: "person_pin", color: "#b45309" },
  outside_member_updated: { text: "updated an outside member", icon: "edit", color: "var(--text-secondary)" },
  outside_member_deleted: { text: "deleted an outside member", icon: "delete", color: "#ef4444" },
};

/** Strips the "in instance <id>" suffix the API appends for feed lookup. */
function cleanDetails(details: string | null, instanceId: string): string {
  if (!details) return "";
  return details.replace(new RegExp(`\\s*in instance ${instanceId}\\s*$`), "").trim();
}

export default function ActivityFeed({ instanceId, authToken }: { instanceId: string; authToken: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/team-instances/${instanceId}/activity`), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) setRows(data.data || []);
        else setError(data.error || "Could not load activity");
      } catch {
        if (!cancelled) setError("Could not load activity");
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId, authToken]);

  if (error) return <p style={{ fontSize: 13, color: "#ef4444", marginTop: "1rem" }}>{error}</p>;
  if (rows === null) return <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: "1rem" }}>Loading activity...</p>;
  if (rows.length === 0) return <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", marginTop: "1rem" }}>Nothing has happened here yet.</p>;

  return (
    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((r: any, i: number) => {
        const meta = ACTION_LABELS[r.action] || { text: r.action.replace(/_/g, " "), icon: "history", color: "var(--text-secondary)" };
        const detail = cleanDetails(r.details, instanceId);
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: 8, background: i % 2 === 0 ? "var(--surface-container-low)" : "transparent" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: meta.color, marginTop: 1 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>
                <strong style={{ fontWeight: 600 }}>{r.actor_email || "system"}</strong>
                <span style={{ color: "var(--text-secondary)" }}> {meta.text}</span>
                {detail && <span style={{ color: "var(--text-primary)" }}> — {detail}</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{(r.created_at || "").replace("T", " ").slice(0, 16)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
