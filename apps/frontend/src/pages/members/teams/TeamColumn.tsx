/* eslint-disable @typescript-eslint/no-explicit-any */
import PersonCard from "./PersonCard";
import { startDrag, finishDrag, useDropTarget } from "./useTeamDrag";
import type { DragPayload } from "./useTeamDrag";
import { memberKey, memberName, memberEmail } from "./treeUtils";

function sizeBadge(team: any) {
  const n = team.member_count ?? (team.members || []).length;
  const min = team.min_members ?? null;
  const max = team.member_limit ?? null;
  if (min != null && max != null && min === max) return `${n}/${min}`;
  if (min != null && max != null) return `${n} · ${min}–${max}`;
  if (max != null) return `${n}/${max}`;
  if (min != null) return `${n} · min ${min}`;
  return `${n}`;
}

/** One team, rendered as a Kanban column that people can be dropped into. */
export default function TeamColumn({
  team, instance, canManage, onDropMember, onReorderTeam, onRemoveMember, onEdit, onDelete, onQuickAdd,
}: {
  team: any;
  instance: any;
  canManage: boolean;
  onDropMember: (p: DragPayload & { type: "member" }, toTeamId: string) => void;
  onReorderTeam: (teamId: string, beforeTeamId: string) => void;
  onRemoveMember: (team: any, member: any) => void;
  onEdit: (team: any) => void;
  onDelete: (team: any) => void;
  onQuickAdd: (team: any) => void;
}) {
  const members = team.members || [];
  const memberN = team.member_count ?? members.length;
  const needsMore = team.requirement_met != null ? !team.requirement_met : (team.min_members != null && memberN < team.min_members);
  const isFull = team.is_full != null ? team.is_full : (team.member_limit != null && memberN >= team.member_limit);
  const deficit = team.min_members != null ? Math.max(0, team.min_members - memberN) : 0;
  const present = new Set(members.map((m: any) => `${m.kind}:${memberKey(m)}`));

  const drop = useDropTarget(
    (p) => {
      if (!canManage || p.instanceId !== instance.id) return false;
      if (p.type === "team") return p.teamId !== team.id && p.fromGroupId === (team.group_id || null);
      if (p.type !== "member") return false;
      // A person can be dropped here unless they're already on this team, or it's full.
      if (p.fromTeamId === team.id) return false;
      if (present.has(`${p.kind}:${p.memberId}`)) return false;
      return !isFull;
    },
    (p) => {
      if (p.type === "team") { onReorderTeam(p.teamId, team.id); return; }
      if (p.type !== "member") return;
      onDropMember(p, team.id);
    },
  );

  const classes = [
    "kb-col",
    drop.isOver ? "kb-col--over" : "",
    needsMore ? "kb-col--short" : "",
    isFull ? "kb-col--full" : "",
    drop.activeType === "member" && !drop.canAccept ? "kb-col--blocked" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} {...drop.handlers}>
      <div
        className="kb-col__head"
        draggable={canManage}
        onDragStart={(e) => startDrag(e, {
          type: "team", teamId: team.id, fromGroupId: team.group_id || null,
          instanceId: instance.id, name: team.name,
        })}
        onDragEnd={finishDrag}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {canManage && (
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>drag_indicator</span>
          )}
          <strong style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {team.name}
          </strong>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 5, flexShrink: 0,
            background: isFull ? "rgba(239, 68, 68, 0.12)" : needsMore ? "rgba(239, 68, 68, 0.12)" : "var(--accent-bg)",
            color: isFull || needsMore ? "#ef4444" : "var(--primary-green)",
          }}>
            {sizeBadge(team)}
          </span>
          {canManage && (
            <>
              <button className="kb-card__remove" style={{ opacity: 1, marginLeft: 0 }} aria-label="Edit team" onClick={() => onEdit(team)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              </button>
              <button className="kb-card__remove" style={{ opacity: 1, marginLeft: 0 }} aria-label="Delete team" onClick={() => onDelete(team)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </>
          )}
        </div>

        {needsMore && (
          <div style={{ marginTop: 5, fontSize: 10, fontWeight: 800, color: "#ef4444", letterSpacing: "0.03em" }}>
            NEEDS {deficit} MORE
          </div>
        )}
        {isFull && !needsMore && (
          <div style={{ marginTop: 5, fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.03em" }}>
            FULL
          </div>
        )}
        {team.description && (
          <div style={{ marginTop: 5, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{team.description}</div>
        )}
      </div>

      <div className="kb-col__body">
        {members.map((m: any) => (
          <PersonCard
            key={`${m.kind}:${memberKey(m)}`}
            name={memberName(m)}
            subtitle={m.kind === "external" ? (m.organization || "Outside") : memberEmail(m)}
            kind={m.kind === "external" ? "external" : "internal"}
            memberId={memberKey(m)}
            fromTeamId={team.id}
            instanceId={instance.id}
            draggable={canManage}
            onRemove={canManage ? () => onRemoveMember(team, m) : undefined}
          />
        ))}

        {drop.isOver && <div className="kb-slot">DROP HERE</div>}

        {members.length === 0 && !drop.isOver && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", textAlign: "center", padding: "12px 4px" }}>
            {canManage ? "Drag people here" : "Empty"}
          </div>
        )}
      </div>

      {canManage && (
        <div className="kb-col__foot">
          <button
            className="btn outline"
            style={{ width: "100%", padding: "5px 8px", fontSize: 12, justifyContent: "center" }}
            disabled={isFull}
            onClick={() => onQuickAdd(team)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
            {isFull ? "Full" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
