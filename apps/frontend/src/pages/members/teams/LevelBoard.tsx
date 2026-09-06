/* eslint-disable @typescript-eslint/no-explicit-any */
import { startDrag, finishDrag, useDropTarget } from "./useTeamDrag";
import type { DragPayload } from "./useTeamDrag";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "var(--accent-bg)", fg: "var(--primary-green)", label: "ACTIVE" },
  eliminated: { bg: "rgba(239, 68, 68, 0.14)", fg: "#ef4444", label: "OUT" },
  winner: { bg: "rgba(245, 158, 11, 0.18)", fg: "#b45309", label: "WINNER" },
};

/** A team as it appears on the progress ladder — draggable to the next level. */
function TeamChip({ team, instanceId, canManage, onSetStatus }: {
  team: any; instanceId: string; canManage: boolean;
  onSetStatus: (team: any, status: string) => void;
}) {
  const status = team.status || "active";
  const st = STATUS_STYLE[status] || STATUS_STYLE.active;
  const eliminated = status === "eliminated";

  return (
    <div
      className="kb-card kb-card--draggable"
      draggable={canManage}
      style={{ opacity: eliminated ? 0.55 : 1, flexDirection: "column", alignItems: "stretch", gap: 6 }}
      onDragStart={(e) => startDrag(e, {
        type: "teamLevel", teamId: team.id, fromLevel: team.current_level || 1,
        instanceId, name: team.name,
      })}
      onDragEnd={finishDrag}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {canManage && <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--text-tertiary)" }}>drag_indicator</span>}
        <strong style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: eliminated ? "line-through" : "none" }}>
          {team.name}
        </strong>
        <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: st.bg, color: st.fg }}>
          {st.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
          {team.member_count || 0}
        </span>
        {!team.requirement_met && (
          <span style={{ color: "#ef4444", fontWeight: 700 }}>under min</span>
        )}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 4 }}>
          {(["active", "eliminated", "winner"] as const).map((s) => (
            <button
              key={s}
              title={`Mark ${s}`}
              onClick={() => onSetStatus(team, s)}
              style={{
                flex: 1, fontSize: 9, fontWeight: 800, padding: "2px 0", borderRadius: 4, cursor: "pointer",
                border: `1px solid ${status === s ? STATUS_STYLE[s].fg : "var(--border-light)"}`,
                background: status === s ? STATUS_STYLE[s].bg : "transparent",
                color: status === s ? STATUS_STYLE[s].fg : "var(--text-tertiary)",
              }}
            >
              {STATUS_STYLE[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Progress board: one column per level of the instance's ladder, teams as cards.
 * Dragging a team into the next column advances it.
 */
export default function LevelBoard({ instance, teams, canManage, onMoveLevel, onSetStatus }: {
  instance: any;
  teams: any[];
  canManage: boolean;
  onMoveLevel: (teamId: string, toLevel: number) => void;
  onSetStatus: (team: any, status: string) => void;
}) {
  const levels: any[] = instance.levels || [{ position: 1, name: "Level 1" }];

  if (levels.length <= 1) {
    return (
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", marginTop: "1rem" }}>
        This instance has a single level, so there's no ladder to track. Edit the instance to add more levels.
      </p>
    );
  }

  return (
    <div className="kb-row" style={{ marginTop: "1rem" }}>
      {levels.map((lvl: any) => (
        <LevelColumn
          key={lvl.position}
          level={lvl}
          instance={instance}
          teams={teams.filter((t: any) => (t.current_level || 1) === lvl.position)}
          canManage={canManage}
          onMoveLevel={onMoveLevel}
          onSetStatus={onSetStatus}
          isLast={lvl.position === levels.length}
        />
      ))}
    </div>
  );
}

function LevelColumn({ level, instance, teams, canManage, onMoveLevel, onSetStatus, isLast }: {
  level: any; instance: any; teams: any[]; canManage: boolean; isLast: boolean;
  onMoveLevel: (teamId: string, toLevel: number) => void;
  onSetStatus: (team: any, status: string) => void;
}) {
  const drop = useDropTarget(
    (p: DragPayload) => canManage && p.type === "teamLevel" && p.instanceId === instance.id && p.fromLevel !== level.position,
    (p) => { if (p.type === "teamLevel") onMoveLevel(p.teamId, level.position); },
  );

  const alive = teams.filter((t: any) => (t.status || "active") === "active").length;

  return (
    <div className={`kb-col ${drop.isOver ? "kb-col--over" : ""}`} {...drop.handlers}>
      <div className="kb-col__head" style={{ cursor: "default" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17, color: isLast ? "#b45309" : "var(--primary-green)" }}>
            {isLast ? "trophy" : "flag"}
          </span>
          <strong style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {level.name}
          </strong>
          <span style={{ fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 5, background: "var(--accent-bg)", color: "var(--primary-green)" }}>
            {teams.length}
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.03em" }}>
          LEVEL {level.position}{alive !== teams.length ? ` · ${alive} STILL IN` : ""}
        </div>
      </div>

      <div className="kb-col__body">
        {teams.map((t: any) => (
          <TeamChip key={t.id} team={t} instanceId={instance.id} canManage={canManage} onSetStatus={onSetStatus} />
        ))}
        {drop.isOver && <div className="kb-slot">MOVE HERE</div>}
        {teams.length === 0 && !drop.isOver && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", textAlign: "center", padding: "12px 4px" }}>
            {canManage ? "Drag teams here" : "No teams"}
          </div>
        )}
      </div>
    </div>
  );
}
