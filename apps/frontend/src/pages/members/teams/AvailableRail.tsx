/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import PersonCard from "./PersonCard";
import { useDropTarget } from "./useTeamDrag";
import type { DragPayload } from "./useTeamDrag";
import { allTeams, memberKey } from "./treeUtils";

/**
 * The pool you drag people OUT of, and drop them back into to unassign.
 * Holds every eligible club member plus the instance's outside members, with a
 * ×N badge on anyone already placed (they can still be added to another team).
 */
export default function AvailableRail({
  instance, canManage, eligibleUsers, onUnassign, onAddOutside,
}: {
  instance: any;
  canManage: boolean;
  eligibleUsers: any[];
  onUnassign: (p: DragPayload & { type: "member" }) => void;
  onAddOutside: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hidePlaced, setHidePlaced] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // How many teams each person currently sits on, keyed by `kind:id`.
  const placement = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTeams(instance)) {
      for (const m of t.members || []) {
        const k = `${m.kind === "external" ? "external" : "internal"}:${memberKey(m)}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    return counts;
  }, [instance]);

  const people = useMemo(() => {
    const club = eligibleUsers.map((u: any) => ({
      kind: "internal" as const, id: u.id, name: u.name || u.email,
      subtitle: u.email, placed: placement.get(`internal:${u.id}`) || 0,
    }));
    const outside = (instance.externals || []).map((e: any) => ({
      kind: "external" as const, id: e.id, name: e.name,
      subtitle: e.organization || e.email || "Outside",
      placed: placement.get(`external:${e.id}`) || 0,
    }));
    return [...outside, ...club];
  }, [eligibleUsers, instance.externals, placement]);

  const q = query.toLowerCase().trim();
  const visible = people.filter((p: any) => {
    if (hidePlaced && p.placed > 0) return false;
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.subtitle || "").toLowerCase().includes(q);
  });

  // Dropping a card from a team back here removes them from that team.
  const drop = useDropTarget(
    (p: DragPayload) => canManage && p.type === "member" && p.instanceId === instance.id && p.fromTeamId !== null,
    (p) => { if (p.type === "member") onUnassign(p); },
  );

  const unplaced = people.filter((p: any) => p.placed === 0).length;

  return (
    <div className={`kb-rail ${drop.isOver ? "kb-rail--over" : ""}`} {...drop.handlers}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", flexWrap: "wrap" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 0, color: "var(--text-secondary)" }}
          aria-label={collapsed ? "Expand people" : "Collapse people"}
        >
          <span className="material-symbols-outlined" style={{ transition: "transform 140ms ease", transform: collapsed ? "rotate(-90deg)" : "none" }}>expand_more</span>
        </button>
        <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>groups</span>
        <strong style={{ fontSize: 14 }}>People</strong>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "var(--accent-bg)", color: "var(--primary-green)" }}>
          {unplaced} unassigned
        </span>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {drop.isOver ? "Drop to remove from that team" : "Drag onto a team to add"}
        </span>

        {!collapsed && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ width: 190, padding: "5px 10px", fontSize: 12 }}
              placeholder="Search people..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input type="checkbox" checked={hidePlaced} onChange={(e) => setHidePlaced(e.target.checked)} />
              Hide assigned
            </label>
            {canManage && (
              <button className="btn outline" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onAddOutside}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                Outside person
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: "0 10px 10px" }}>
          {visible.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", margin: "4px 0 0" }}>
              {people.length === 0 ? "Nobody eligible yet." : "Everyone matching is already assigned."}
            </p>
          ) : (
            <div className="kb-rail__cards">
              {visible.map((p: any) => (
                <PersonCard
                  key={`${p.kind}:${p.id}`}
                  name={p.name}
                  subtitle={p.subtitle}
                  kind={p.kind}
                  memberId={p.id}
                  fromTeamId={null}
                  instanceId={instance.id}
                  draggable={canManage}
                  placedOn={p.placed}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
