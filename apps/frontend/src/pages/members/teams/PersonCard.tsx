import { useState } from "react";
import { startDrag, finishDrag } from "./useTeamDrag";
import type { MemberKind } from "./treeUtils";

/**
 * One draggable person. Lives either in a team column (`fromTeamId` set) or in
 * the available-people rail (`fromTeamId` null, which makes a drop an ADD).
 */
export default function PersonCard({
  name, subtitle, kind, memberId, fromTeamId, instanceId, draggable, placedOn, onRemove,
}: {
  name: string;
  subtitle?: string;
  kind: MemberKind;
  memberId: string;
  fromTeamId: string | null;
  instanceId: string;
  draggable: boolean;
  placedOn?: number;
  onRemove?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const isExternal = kind === "external";

  const classes = [
    "kb-card",
    draggable ? "kb-card--draggable" : "",
    dragging ? "kb-card--dragging" : "",
    isExternal ? "kb-card--external" : "",
    fromTeamId === null && (placedOn || 0) > 0 ? "kb-card--placed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      draggable={draggable}
      title={[name, subtitle].filter(Boolean).join(" · ")}
      onDragStart={(e) => {
        setDragging(true);
        startDrag(e, { type: "member", kind, memberId, fromTeamId, instanceId, name });
      }}
      onDragEnd={() => { setDragging(false); finishDrag(); }}
    >
      <div className="avatar-circle" style={{
        width: 26, height: 26, fontSize: 11, flexShrink: 0,
        background: isExternal ? "rgba(245, 158, 11, 0.22)" : "var(--accent-bg)",
        color: isExternal ? "#b45309" : "var(--accent)",
      }}>
        {name[0]?.toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 11, color: isExternal ? "#b45309" : "var(--text-tertiary)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {(placedOn || 0) > 0 && fromTeamId === null && (
        <span
          title={`Already on ${placedOn} team${placedOn === 1 ? "" : "s"} — drag again to add to another`}
          style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: "rgba(59, 130, 246, 0.16)", color: "#3b82f6", flexShrink: 0 }}
        >
          ×{placedOn}
        </span>
      )}
      {onRemove && (
        <button className="kb-card__remove" aria-label={`Remove ${name}`} onClick={onRemove}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      )}
    </div>
  );
}
