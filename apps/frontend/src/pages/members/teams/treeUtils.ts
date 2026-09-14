/* eslint-disable @typescript-eslint/no-explicit-any */

// Helpers for reading and locally mutating the instance tree the API returns:
//   instance -> groups[] -> teams[] -> members[]  (plus instance.ungrouped_teams)
//
// Mutations here are applied optimistically so a drag lands instantly instead of
// waiting on a round-trip; the caller reverts to its previous snapshot on error.

export type MemberKind = "internal" | "external";

export function memberKey(m: any): string {
  return m.kind === "external" ? m.external_id : m.user_id;
}

export function memberName(m: any): string {
  return (m.kind === "external" ? m.name : m.user_name) || "Unknown";
}

export function memberEmail(m: any): string {
  return (m.kind === "external" ? m.email : m.user_email) || "";
}

/** Every team in an instance, grouped and ungrouped alike. */
export function allTeams(inst: any): any[] {
  const grouped = (inst.groups || []).flatMap((g: any) => g.teams || []);
  return [...grouped, ...(inst.ungrouped_teams || [])];
}

export function findTeam(inst: any, teamId: string): any | null {
  return allTeams(inst).find((t: any) => t.id === teamId) || null;
}

function teamCounts(team: any) {
  const members = team.members || [];
  const memberCount = members.length;
  const min = team.min_members != null ? team.min_members : null;
  const max = team.member_limit != null ? team.member_limit : null;
  return {
    member_count: memberCount,
    internal_count: members.filter((m: any) => m.kind !== "external").length,
    external_count: members.filter((m: any) => m.kind === "external").length,
    requirement_met: min == null ? true : memberCount >= min,
    is_full: max != null && memberCount >= max,
  };
}

/**
 * Recompute every derived count in an instance from its `members` arrays, so
 * optimistic edits keep badges and stat tiles honest without a refetch. Mirrors
 * what loadInstanceTree() computes server-side.
 */
export function recomputeInstance(inst: any): any {
  const groups = (inst.groups || []).map((g: any) => {
    const teams = (g.teams || []).map((t: any) => ({ ...t, ...teamCounts(t) }));
    return {
      ...g,
      teams,
      stats: {
        team_count: teams.length,
        member_count: teams.reduce((n: number, t: any) => n + t.member_count, 0),
        understaffed_count: teams.filter((t: any) => !t.requirement_met).length,
      },
    };
  });
  const ungrouped = (inst.ungrouped_teams || []).map((t: any) => ({ ...t, ...teamCounts(t) }));
  const every = [...groups.flatMap((g: any) => g.teams), ...ungrouped];

  return {
    ...inst,
    groups,
    ungrouped_teams: ungrouped,
    stats: {
      group_count: groups.length,
      team_count: every.length,
      member_count: every.reduce((n: number, t: any) => n + t.member_count, 0),
      internal_count: every.reduce((n: number, t: any) => n + t.internal_count, 0),
      external_count: every.reduce((n: number, t: any) => n + t.external_count, 0),
      understaffed_count: every.filter((t: any) => !t.requirement_met).length,
    },
  };
}

/** Apply `fn` to every team in the instance, returning a new instance object. */
export function mapTeams(inst: any, fn: (team: any) => any): any {
  return recomputeInstance({
    ...inst,
    groups: (inst.groups || []).map((g: any) => ({ ...g, teams: (g.teams || []).map(fn) })),
    ungrouped_teams: (inst.ungrouped_teams || []).map(fn),
  });
}

export function moveMemberLocal(inst: any, kind: MemberKind, memberId: string, fromTeamId: string, toTeamId: string): any {
  const source = findTeam(inst, fromTeamId);
  const member = (source?.members || []).find((m: any) => m.kind === kind && memberKey(m) === memberId);
  if (!member) return inst;
  return mapTeams(inst, (team: any) => {
    if (team.id === fromTeamId) {
      return { ...team, members: (team.members || []).filter((m: any) => !(m.kind === kind && memberKey(m) === memberId)) };
    }
    if (team.id === toTeamId) {
      return { ...team, members: [...(team.members || []), member] };
    }
    return team;
  });
}

export function removeMemberLocal(inst: any, kind: MemberKind, memberId: string, teamId: string): any {
  return mapTeams(inst, (team: any) =>
    team.id === teamId
      ? { ...team, members: (team.members || []).filter((m: any) => !(m.kind === kind && memberKey(m) === memberId)) }
      : team,
  );
}

export function addMemberLocal(inst: any, teamId: string, member: any): any {
  return mapTeams(inst, (team: any) =>
    team.id === teamId ? { ...team, members: [...(team.members || []), member] } : team,
  );
}

/** Move a team into another group (`null` = Ungrouped). */
export function moveTeamLocal(inst: any, teamId: string, toGroupId: string | null): any {
  const team = findTeam(inst, teamId);
  if (!team) return inst;
  const moved = { ...team, group_id: toGroupId };
  const strip = (teams: any[]) => teams.filter((t: any) => t.id !== teamId);

  return recomputeInstance({
    ...inst,
    groups: (inst.groups || []).map((g: any) => ({
      ...g,
      teams: g.id === toGroupId ? [...strip(g.teams || []), moved] : strip(g.teams || []),
    })),
    ungrouped_teams: toGroupId === null
      ? [...strip(inst.ungrouped_teams || []), moved]
      : strip(inst.ungrouped_teams || []),
  });
}

/** Reorder a team within its own group, dropping it in front of `beforeTeamId`. */
export function reorderTeamLocal(inst: any, teamId: string, beforeTeamId: string): any {
  const reorder = (teams: any[]) => {
    const from = teams.findIndex((t: any) => t.id === teamId);
    const to = teams.findIndex((t: any) => t.id === beforeTeamId);
    if (from === -1 || to === -1 || from === to) return teams;
    const next = [...teams];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
  return recomputeInstance({
    ...inst,
    groups: (inst.groups || []).map((g: any) => ({ ...g, teams: reorder(g.teams || []) })),
    ungrouped_teams: reorder(inst.ungrouped_teams || []),
  });
}

/** One row per (person, team) pairing across the whole instance — backs the roster view. */
export function buildRoster(inst: any): any[] {
  const rows: any[] = [];
  const groupOf = new Map<string, string>();
  for (const g of inst.groups || []) for (const t of g.teams || []) groupOf.set(t.id, g.name);

  for (const team of allTeams(inst)) {
    for (const m of team.members || []) {
      rows.push({
        key: `${team.id}:${m.kind}:${memberKey(m)}`,
        memberId: memberKey(m),
        kind: m.kind === "external" ? "external" : "internal",
        name: memberName(m),
        email: memberEmail(m),
        affiliation: m.kind === "external" ? (m.organization || "—") : (m.user_department_id || "—"),
        role: m.kind === "external" ? "Outside" : (m.user_role_name || "Member"),
        groupName: groupOf.get(team.id) || "Ungrouped",
        teamName: team.name,
      });
    }
  }
  return rows;
}

/** How many distinct teams each person sits on, keyed by `kind:id`. */
export function teamCountByPerson(rows: any[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.kind}:${r.memberId}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}
