/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { apiUrl } from "../../lib/api";
import { DEPT_NAMES } from "./constants";
import RosterView from "./teams/RosterView";
import ActivityFeed from "./teams/ActivityFeed";
import ExternalMembersPanel from "./teams/ExternalMembersPanel";
import AvailableRail from "./teams/AvailableRail";
import TeamColumn from "./teams/TeamColumn";
import LevelBoard from "./teams/LevelBoard";
import "./teams/kanban.css";
import {
  allTeams, findTeam, memberKey, memberName, moveMemberLocal, removeMemberLocal, addMemberLocal,
  moveTeamLocal, reorderTeamLocal, mapTeams,
} from "./teams/treeUtils";
import type { DragPayload } from "./teams/useTeamDrag";

type ViewMode = "teams" | "roster" | "activity";
type BoardMode = "staffing" | "progress";

// Stands in for "teams with no group" so the drill-down can address that bucket
// the same way it addresses a real category.
const UNGROUPED = "__ungrouped__";

function teamFormGroupName(inst: any, groupId: string | null, label: string) {
  if (!groupId) return "(ungrouped)";
  return `in ${(inst.groups || []).find((g: any) => g.id === groupId)?.name || label}`;
}

export default function TeamInstancesSection({ authToken, powerLevel, departmentId, departments, allUsers }: {
  authToken: string;
  powerLevel: number;
  departmentId: string | null;
  departments: any[];
  allUsers: any[];
}) {
  const [instances, setInstances] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [views, setViews] = useState<Record<string, ViewMode>>({});
  const [outsidePanelFor, setOutsidePanelFor] = useState<string | null>(null);
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [boardMode, setBoardMode] = useState<Record<string, BoardMode>>({});
  // Instance settings panel (name, description, what groups are called, ladder)
  const [editingInstance, setEditingInstance] = useState(false);
  const [siName, setSiName] = useState("");
  const [siDesc, setSiDesc] = useState("");
  const [siLabel, setSiLabel] = useState("Company");
  const [siLevelCount, setSiLevelCount] = useState(1);
  const [siLevelNames, setSiLevelNames] = useState<string[]>([]);
  const [siBusy, setSiBusy] = useState(false);

  // Category settings panel
  const [editingCategory, setEditingCategory] = useState(false);
  const [scName, setScName] = useState("");
  const [scOrg, setScOrg] = useState("");
  const [scDesc, setScDesc] = useState("");
  const [scBusy, setScBusy] = useState(false);

  const isBoard = powerLevel >= 100;
  const canCreate = powerLevel >= 50;

  // Create-instance form
  const [instName, setInstName] = useState("");
  const [instDesc, setInstDesc] = useState("");
  const [instGroupLabel, setInstGroupLabel] = useState("Company");
  const [instLevelCount, setInstLevelCount] = useState(1);
  const [instLevelNames, setInstLevelNames] = useState<string[]>([]);
  const [instDeptIds, setInstDeptIds] = useState<string[]>([]);
  const [instBusy, setInstBusy] = useState(false);

  // Create-group form, keyed by instance
  const [groupFormInstanceId, setGroupFormInstanceId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupOrg, setGroupOrg] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);

  // Per-team side panel: "edit" tweaks the team, "add" is the keyboard/a11y
  // route to adding people for anyone not using drag-and-drop.
  const [teamPanel, setTeamPanel] = useState<{ instanceId: string; teamId: string; mode: "edit" | "add" } | null>(null);
  const [panelName, setPanelName] = useState("");
  const [panelDesc, setPanelDesc] = useState("");
  const [panelSizeMode, setPanelSizeMode] = useState<"none" | "range" | "exact">("none");
  const [panelMin, setPanelMin] = useState("");
  const [panelMax, setPanelMax] = useState("");
  const [panelExact, setPanelExact] = useState("");
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");

  // Create-team form — targets one (instance, group) pair
  const [teamForm, setTeamForm] = useState<{ instanceId: string; groupId: string | null } | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamSizeMode, setTeamSizeMode] = useState<"none" | "range" | "exact">("none");
  const [teamMin, setTeamMin] = useState("");
  const [teamMax, setTeamMax] = useState("");
  const [teamExact, setTeamExact] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [teamExternalIds, setTeamExternalIds] = useState<string[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };

  async function request(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(apiUrl(path), {
        ...init,
        headers: init?.body ? headers : { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) return { ok: true, data };
      return { ok: false, error: data.error || `Request failed (${res.status})` };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" };
    }
  }

  async function load() {
    const res = await request("/api/team-instances");
    if (res.ok) setInstances(res.data.data || []);
    else alert(res.error);
    setLoaded(true);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  useEffect(() => { load(); }, []);

  /**
   * Apply a change locally first so the UI responds instantly, then confirm it
   * with the server and roll the whole tree back if the server disagrees. This
   * is what makes dragging feel immediate — the old code refetched every
   * instance after every mutation.
   */
  async function optimistic(instanceId: string, mutate: (inst: any) => any, path: string, init?: RequestInit): Promise<boolean> {
    const snapshot = instances;
    setInstances((prev) => prev.map((i: any) => (i.id === instanceId ? mutate(i) : i)));
    const res = await request(path, init);
    if (!res.ok) {
      setInstances(snapshot);
      alert(res.error);
      return false;
    }
    return true;
  }

  const eligibleUsers = useMemo(
    () => allUsers
      .filter((u: any) => u.role_id !== "advisory")
      .filter((u: any) => isBoard || u.department_id === departmentId),
    [allUsers, isBoard, departmentId],
  );

  function canManageInstance(inst: any) {
    if (powerLevel >= 100) return true;
    if (powerLevel >= 50 && departmentId) {
      return (inst.departments || []).some((d: any) => d.id === departmentId);
    }
    return false;
  }

  function deptName(id: string) {
    return DEPT_NAMES[id] || departments.find((d: any) => d.id === id)?.name || id;
  }

  // ---------- instances ----------

  async function createInstance() {
    if (!instName.trim()) return alert("Enter an instance name");
    if (isBoard && instDeptIds.length === 0) return alert("Select at least one department");
    setInstBusy(true);
    const res = await request("/api/team-instances", {
      method: "POST",
      body: JSON.stringify({
        name: instName,
        description: instDesc,
        groupLabel: instGroupLabel.trim() || "Company",
        levelCount: instLevelCount,
        levelNames: instLevelNames.slice(0, instLevelCount),
        departmentIds: isBoard ? instDeptIds : undefined,
      }),
    });
    setInstBusy(false);
    if (!res.ok) return alert(res.error);
    setInstName(""); setInstDesc(""); setInstGroupLabel("Company"); setInstDeptIds([]);
    setInstLevelCount(1); setInstLevelNames([]);
    load();
  }

  async function deleteInstance(inst: any) {
    if (!confirm(`Delete instance "${inst.name}", its ${inst.stats?.group_count || 0} group(s) and ${inst.stats?.team_count || 0} team(s)?`)) return;
    const snapshot = instances;
    setInstances((prev) => prev.filter((x: any) => x.id !== inst.id));
    if (openInstanceId === inst.id) { setOpenInstanceId(null); setOpenCategoryId(null); }
    const res = await request(`/api/team-instances/${inst.id}`, { method: "DELETE" });
    if (!res.ok) { setInstances(snapshot); alert(res.error); }
  }

  function openInstanceSettings(inst: any) {
    setSiName(inst.name || "");
    setSiDesc(inst.description || "");
    setSiLabel(inst.group_label || "Company");
    const levels: any[] = inst.levels || [];
    setSiLevelCount(Math.max(1, levels.length));
    setSiLevelNames(levels.map((l: any) => l.name));
    setEditingInstance(true);
  }

  async function saveInstanceSettings(inst: any) {
    const name = siName.trim();
    if (!name) return alert("Instance name cannot be empty");
    const label = siLabel.trim() || "Company";
    const count = Math.max(1, Math.min(20, siLevelCount));
    const names = Array.from({ length: count }, (_, i) => (siLevelNames[i] || "").trim() || `Level ${i + 1}`);

    // Shrinking the ladder pulls stranded teams down — say so before doing it.
    const highest = Math.max(1, ...allTeams(inst).map((t: any) => t.current_level || 1));
    if (count < highest && !confirm(`Some teams are at level ${highest}. Shrinking to ${count} level(s) will move them down to level ${count}. Continue?`)) return;

    setSiBusy(true);
    const ok = await optimistic(
      inst.id,
      (i: any) => mapTeams(
        {
          ...i,
          name,
          description: siDesc,
          group_label: label,
          level_count: count,
          levels: names.map((n, idx) => ({ position: idx + 1, name: n })),
        },
        (t: any) => ((t.current_level || 1) > count ? { ...t, current_level: count } : t),
      ),
      `/api/team-instances/${inst.id}`,
      { method: "PUT", body: JSON.stringify({ name, description: siDesc, groupLabel: label, levelCount: count, levelNames: names }) },
    );
    setSiBusy(false);
    if (ok) setEditingInstance(false);
  }

  // ---------- groups ----------

  async function createGroup(inst: any) {
    if (!groupName.trim()) return alert(`Enter a ${(inst.group_label || "Company").toLowerCase()} name`);
    setGroupBusy(true);
    const res = await request(`/api/team-instances/${inst.id}/groups`, {
      method: "POST",
      body: JSON.stringify({ name: groupName.trim(), organization: groupOrg.trim() || undefined, description: groupDesc.trim() || undefined }),
    });
    setGroupBusy(false);
    if (!res.ok) return alert(res.error);
    setGroupName(""); setGroupOrg(""); setGroupDesc(""); setGroupFormInstanceId(null);
    load();
  }

  async function updateGroup(inst: any, group: any, patch: any): Promise<boolean> {
    return optimistic(
      inst.id,
      (i: any) => ({ ...i, groups: (i.groups || []).map((g: any) => (g.id === group.id ? { ...g, ...patch } : g)) }),
      `/api/team-instances/${inst.id}/groups/${group.id}`,
      { method: "PUT", body: JSON.stringify(patch) },
    );
  }

  async function deleteGroup(inst: any, group: any) {
    const n = (group.teams || []).length;
    if (!confirm(`Delete "${group.name}"?${n > 0 ? `\n\nIts ${n} team(s) will move to Ungrouped — they are not deleted.` : ""}`)) return;
    await optimistic(
      inst.id,
      (i: any) => {
        const orphans = ((i.groups || []).find((g: any) => g.id === group.id)?.teams || []).map((t: any) => ({ ...t, group_id: null }));
        return mapTeams({
          ...i,
          groups: (i.groups || []).filter((g: any) => g.id !== group.id),
          ungrouped_teams: [...(i.ungrouped_teams || []), ...orphans],
        }, (t: any) => t);
      },
      `/api/team-instances/${inst.id}/groups/${group.id}`,
      { method: "DELETE" },
    );
  }

  async function moveTeam(inst: any, teamId: string, toGroupId: string | null) {
    await optimistic(
      inst.id,
      (i: any) => moveTeamLocal(i, teamId, toGroupId),
      `/api/team-instances/${inst.id}/teams/${teamId}`,
      { method: "PUT", body: JSON.stringify({ groupId: toGroupId }) },
    );
  }

  // ---------- teams ----------

  function resolveSizePayload(): { minMembers: number | null; maxMembers: number | null } | null {
    if (teamSizeMode === "none") return { minMembers: null, maxMembers: null };
    if (teamSizeMode === "exact") {
      const n = Number(teamExact);
      if (!Number.isInteger(n) || n < 1) return null;
      return { minMembers: n, maxMembers: n };
    }
    const min = teamMin === "" ? null : Number(teamMin);
    const max = teamMax === "" ? null : Number(teamMax);
    if (min !== null && (!Number.isInteger(min) || min < 1)) return null;
    if (max !== null && (!Number.isInteger(max) || max < 1)) return null;
    if (min !== null && max !== null && min > max) return null;
    return { minMembers: min, maxMembers: max };
  }

  function resetTeamForm() {
    setTeamForm(null); setTeamName(""); setTeamDesc(""); setTeamSizeMode("none");
    setTeamMin(""); setTeamMax(""); setTeamExact("");
    setTeamMemberIds([]); setTeamExternalIds([]);
  }

  async function createTeam() {
    if (!teamForm) return;
    if (!teamName.trim()) return alert("Enter a team name");
    const size = resolveSizePayload();
    if (!size) return alert("Sizes must be positive whole numbers, and min cannot exceed max");
    setTeamBusy(true);
    const res = await request(`/api/team-instances/${teamForm.instanceId}/teams`, {
      method: "POST",
      body: JSON.stringify({
        name: teamName.trim(),
        description: teamDesc || undefined,
        groupId: teamForm.groupId,
        ...size,
        memberIds: teamMemberIds,
        externalIds: teamExternalIds,
      }),
    });
    setTeamBusy(false);
    if (!res.ok) return alert(res.error);
    resetTeamForm();
    load();
  }

  async function saveTeamEdit(inst: any, team: any, patch: any): Promise<boolean> {
    return optimistic(
      inst.id,
      (i: any) => mapTeams(i, (t: any) => (t.id === team.id ? { ...t, ...patch, min_members: patch.minMembers, member_limit: patch.maxMembers } : t)),
      `/api/team-instances/${inst.id}/teams/${team.id}`,
      { method: "PUT", body: JSON.stringify(patch) },
    );
  }

  async function deleteTeam(inst: any, team: any) {
    if (!confirm(`Delete team "${team.name}"?`)) return;
    await optimistic(
      inst.id,
      (i: any) => mapTeams({
        ...i,
        groups: (i.groups || []).map((g: any) => ({ ...g, teams: (g.teams || []).filter((t: any) => t.id !== team.id) })),
        ungrouped_teams: (i.ungrouped_teams || []).filter((t: any) => t.id !== team.id),
      }, (t: any) => t),
      `/api/team-instances/${inst.id}/teams/${team.id}`,
      { method: "DELETE" },
    );
  }

  async function reorderTeam(inst: any, teamId: string, beforeTeamId: string) {
    const snapshot = instances;
    setInstances((prev) => prev.map((i: any) => (i.id === inst.id ? reorderTeamLocal(i, teamId, beforeTeamId) : i)));

    // Persist the new ordering for the affected group as a sequence of indexes.
    const updated = reorderTeamLocal(inst, teamId, beforeTeamId);
    const moved = allTeams(updated).find((t: any) => t.id === teamId);
    const siblings = moved?.group_id
      ? ((updated.groups || []).find((g: any) => g.id === moved.group_id)?.teams || [])
      : (updated.ungrouped_teams || []);

    for (let idx = 0; idx < siblings.length; idx++) {
      const res = await request(`/api/team-instances/${inst.id}/teams/${siblings[idx].id}`, {
        method: "PUT", body: JSON.stringify({ sortOrder: idx }),
      });
      if (!res.ok) { setInstances(snapshot); alert(res.error); return; }
    }
  }

  // ---------- members ----------

  async function addMember(inst: any, team: any, userId: string) {
    const u = allUsers.find((x: any) => x.id === userId);
    await optimistic(
      inst.id,
      (i: any) => addMemberLocal(i, team.id, {
        kind: "internal", user_id: userId, user_name: u?.name || "Member",
        user_email: u?.email || "", user_department_id: u?.department_id || null,
        user_role_name: u?.role_name || null,
      }),
      `/api/team-instances/${inst.id}/teams/${team.id}/members`,
      { method: "POST", body: JSON.stringify({ userId }) },
    );
  }

  async function addExternalToTeam(inst: any, team: any, externalId: string) {
    const ext = (inst.externals || []).find((e: any) => e.id === externalId);
    await optimistic(
      inst.id,
      (i: any) => addMemberLocal(i, team.id, {
        kind: "external", external_id: externalId,
        name: ext?.name || "Outside member", email: ext?.email || "", organization: ext?.organization || "",
      }),
      `/api/team-instances/${inst.id}/teams/${team.id}/external-members`,
      { method: "POST", body: JSON.stringify({ externalId }) },
    );
  }

  async function removeMember(inst: any, team: any, member: any, ask = true) {
    const id = memberKey(member);
    const isExternal = member.kind === "external";
    if (ask && !confirm(`Remove ${memberName(member)} from ${team.name}?`)) return;
    await optimistic(
      inst.id,
      (i: any) => removeMemberLocal(i, isExternal ? "external" : "internal", id, team.id),
      isExternal
        ? `/api/team-instances/${inst.id}/teams/${team.id}/external-members/${id}`
        : `/api/team-instances/${inst.id}/teams/${team.id}/members/${id}`,
      { method: "DELETE" },
    );
  }

  async function moveMember(inst: any, p: DragPayload & { type: "member" }, toTeamId: string) {
    const fromTeamId = p.fromTeamId;
    if (!fromTeamId) return; // rail drops are adds, handled by dropOnTeam
    await optimistic(
      inst.id,
      (i: any) => moveMemberLocal(i, p.kind, p.memberId, fromTeamId, toTeamId),
      `/api/team-instances/${inst.id}/move-member`,
      { method: "POST", body: JSON.stringify({ kind: p.kind, memberId: p.memberId, fromTeamId, toTeamId }) },
    );
  }

  /**
   * A person card was dropped on a team column. Coming from the people rail
   * (fromTeamId null) it's an add; coming from another column it's a move.
   */
  async function dropOnTeam(inst: any, p: DragPayload & { type: "member" }, toTeamId: string) {
    const team = findTeam(inst, toTeamId);
    if (!team) return;
    if (p.fromTeamId === null) {
      if (p.kind === "external") await addExternalToTeam(inst, team, p.memberId);
      else await addMember(inst, team, p.memberId);
      return;
    }
    await moveMember(inst, p, toTeamId);
  }

  /** A person card was dropped back on the rail — take them off that team. */
  async function unassign(inst: any, p: DragPayload & { type: "member" }) {
    if (!p.fromTeamId) return;
    const team = findTeam(inst, p.fromTeamId);
    if (!team) return;
    const member = (team.members || []).find(
      (m: any) => (m.kind === "external" ? "external" : "internal") === p.kind && memberKey(m) === p.memberId,
    );
    if (!member) return;
    await removeMember(inst, team, member, false);
  }

  function openTeamPanel(inst: any, team: any, mode: "edit" | "add") {
    const cur = teamPanel;
    if (cur && cur.teamId === team.id && cur.mode === mode) { setTeamPanel(null); return; }
    setTeamPanel({ instanceId: inst.id, teamId: team.id, mode });
    setPanelSearch("");
    setPanelName(team.name);
    setPanelDesc(team.description || "");
    const tMin = team.min_members ?? null;
    const tMax = team.member_limit ?? null;
    setPanelMin(""); setPanelMax(""); setPanelExact("");
    if (tMin == null && tMax == null) setPanelSizeMode("none");
    else if (tMin != null && tMax != null && tMin === tMax) { setPanelSizeMode("exact"); setPanelExact(String(tMin)); }
    else { setPanelSizeMode("range"); setPanelMin(tMin != null ? String(tMin) : ""); setPanelMax(tMax != null ? String(tMax) : ""); }
  }

  async function savePanelEdit(inst: any, team: any) {
    if (!panelName.trim()) return alert("Team name cannot be empty");
    let size: { minMembers: number | null; maxMembers: number | null };
    if (panelSizeMode === "none") size = { minMembers: null, maxMembers: null };
    else if (panelSizeMode === "exact") {
      const n = Number(panelExact);
      if (!Number.isInteger(n) || n < 1) return alert("Required count must be a positive whole number");
      size = { minMembers: n, maxMembers: n };
    } else {
      const min = panelMin === "" ? null : Number(panelMin);
      const max = panelMax === "" ? null : Number(panelMax);
      if (min !== null && (!Number.isInteger(min) || min < 1)) return alert("Min must be a positive whole number");
      if (max !== null && (!Number.isInteger(max) || max < 1)) return alert("Max must be a positive whole number");
      if (min !== null && max !== null && min > max) return alert("Min cannot exceed max");
      size = { minMembers: min, maxMembers: max };
    }
    setPanelBusy(true);
    const ok = await saveTeamEdit(inst, team, { name: panelName.trim(), description: panelDesc, ...size });
    setPanelBusy(false);
    if (ok) setTeamPanel(null);
  }

  // ---------- outside member pool ----------

  async function createExternal(inst: any, payload: any): Promise<boolean> {
    const res = await request(`/api/team-instances/${inst.id}/externals`, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) { alert(res.error); return false; }
    setInstances((prev) => prev.map((i: any) => (i.id === inst.id
      ? { ...i, externals: [...(i.externals || []), { id: res.data.externalId, ...payload }] }
      : i)));
    return true;
  }

  async function updateExternal(inst: any, ext: any, patch: any): Promise<boolean> {
    return optimistic(
      inst.id,
      (i: any) => mapTeams({
        ...i,
        externals: (i.externals || []).map((e: any) => (e.id === ext.id ? { ...e, ...patch } : e)),
      }, (t: any) => ({
        ...t,
        members: (t.members || []).map((m: any) => (m.kind === "external" && m.external_id === ext.id ? { ...m, ...patch } : m)),
      })),
      `/api/team-instances/${inst.id}/externals/${ext.id}`,
      { method: "PUT", body: JSON.stringify(patch) },
    );
  }

  async function deleteExternal(inst: any, ext: any) {
    if (!confirm(`Remove ${ext.name} from this instance entirely? They'll be taken off every team here.`)) return;
    await optimistic(
      inst.id,
      (i: any) => mapTeams({ ...i, externals: (i.externals || []).filter((e: any) => e.id !== ext.id) },
        (t: any) => ({ ...t, members: (t.members || []).filter((m: any) => !(m.kind === "external" && m.external_id === ext.id)) })),
      `/api/team-instances/${inst.id}/externals/${ext.id}`,
      { method: "DELETE" },
    );
  }

  // ---------- levels ----------

  async function moveTeamLevel(inst: any, teamId: string, toLevel: number) {
    await optimistic(
      inst.id,
      (i: any) => mapTeams(i, (t: any) => (t.id === teamId ? { ...t, current_level: toLevel } : t)),
      `/api/team-instances/${inst.id}/teams/${teamId}`,
      { method: "PUT", body: JSON.stringify({ currentLevel: toLevel }) },
    );
  }

  async function setTeamStatus(inst: any, team: any, status: string) {
    await optimistic(
      inst.id,
      (i: any) => mapTeams(i, (t: any) => (t.id === team.id ? { ...t, status } : t)),
      `/api/team-instances/${inst.id}/teams/${team.id}`,
      { method: "PUT", body: JSON.stringify({ status }) },
    );
  }

  // ---------- search + totals ----------

  const q = searchQuery.toLowerCase().trim();
  const visibleInstances = useMemo(() => {
    if (!q) return instances;
    const teamMatches = (t: any) =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      (t.members || []).some((m: any) => memberName(m).toLowerCase().includes(q) || (m.user_email || m.email || "").toLowerCase().includes(q));

    return instances.map((inst: any) => {
      if ((inst.name || "").toLowerCase().includes(q) || (inst.description || "").toLowerCase().includes(q)) return inst;
      const groups = (inst.groups || [])
        .map((g: any) => {
          if ((g.name || "").toLowerCase().includes(q) || (g.organization || "").toLowerCase().includes(q)) return g;
          const teams = (g.teams || []).filter(teamMatches);
          return teams.length > 0 ? { ...g, teams } : null;
        })
        .filter(Boolean);
      const ungrouped = (inst.ungrouped_teams || []).filter(teamMatches);
      return groups.length > 0 || ungrouped.length > 0 ? { ...inst, groups, ungrouped_teams: ungrouped } : null;
    }).filter(Boolean);
  }, [instances, q]);

  const totals = useMemo(() => instances.reduce((acc: any, i: any) => ({
    groups: acc.groups + (i.stats?.group_count || 0),
    teams: acc.teams + (i.stats?.team_count || 0),
    internal: acc.internal + (i.stats?.internal_count || 0),
    external: acc.external + (i.stats?.external_count || 0),
    understaffed: acc.understaffed + (i.stats?.understaffed_count || 0),
  }), { groups: 0, teams: 0, internal: 0, external: 0, understaffed: 0 }), [instances]);

  const kpis = [
    { icon: "diversity_3", label: "Instances", value: instances.length, bg: "rgba(141, 198, 63, 0.15)", color: "var(--primary-green)" },
    { icon: "corporate_fare", label: "Groups", value: totals.groups, bg: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" },
    { icon: "group_work", label: "Teams", value: totals.teams, bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
    { icon: "groups", label: "People placed", value: totals.internal + totals.external, bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
    { icon: "error", label: "Teams under min", value: totals.understaffed, bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
  ];


  // ---------- inline panels ----------

  /** Edit a team, or add people to it without dragging (keyboard route). */
  function renderTeamPanel(panel: any, team: any, inst: any) {
    const present = new Set((team.members || []).map((m: any) => `${m.kind === "external" ? "external" : "internal"}:${memberKey(m)}`));
    const pq = panelSearch.toLowerCase().trim();
    const options = [
      ...(inst.externals || []).map((e: any) => ({ kind: "external" as const, id: e.id, name: e.name, sub: e.organization || e.email || "Outside" })),
      ...eligibleUsers.map((u: any) => ({ kind: "internal" as const, id: u.id, name: u.name || u.email, sub: u.email })),
    ].filter((o) => !present.has(`${o.kind}:${o.id}`))
     .filter((o) => !pq || o.name.toLowerCase().includes(pq) || (o.sub || "").toLowerCase().includes(pq));

    return (
      <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--primary-green)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>
            {panel.mode === "edit" ? "edit" : "person_add"}
          </span>
          <strong style={{ fontSize: 14 }}>
            {panel.mode === "edit" ? `Edit ${team.name}` : `Add people to ${team.name}`}
          </strong>
          <button className="btn outline" style={{ padding: "4px 12px", fontSize: 12, marginLeft: "auto" }} onClick={() => setTeamPanel(null)}>Close</button>
        </div>

        {panel.mode === "edit" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input" placeholder="Team name" value={panelName} onChange={(e) => setPanelName(e.target.value)} />
            <textarea className="input" placeholder="Task description (optional)" rows={2} value={panelDesc} onChange={(e) => setPanelDesc(e.target.value)} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input" style={{ width: "auto" }} value={panelSizeMode} onChange={(e) => setPanelSizeMode(e.target.value as any)}>
                <option value="none">No size requirement</option>
                <option value="range">Range (min–max)</option>
                <option value="exact">Exactly (required)</option>
              </select>
              {panelSizeMode === "range" && (
                <>
                  <input className="input" type="number" min={1} placeholder="Min" style={{ width: 100 }} value={panelMin} onChange={(e) => setPanelMin(e.target.value)} />
                  <input className="input" type="number" min={1} placeholder="Max" style={{ width: 100 }} value={panelMax} onChange={(e) => setPanelMax(e.target.value)} />
                </>
              )}
              {panelSizeMode === "exact" && (
                <input className="input" type="number" min={1} placeholder="Required count" style={{ width: 140 }} value={panelExact} onChange={(e) => setPanelExact(e.target.value)} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>
                MOVE TO ANOTHER {(inst.group_label || "COMPANY").toUpperCase()}
              </div>
              <select
                className="input"
                style={{ width: "auto", minWidth: 200 }}
                value={team.group_id || UNGROUPED}
                onChange={async (e) => {
                  const target = e.target.value === UNGROUPED ? null : e.target.value;
                  await moveTeam(inst, team.id, target);
                  setTeamPanel(null);
                  setOpenCategoryId(target || UNGROUPED);
                }}
              >
                {(inst.groups || []).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                <option value={UNGROUPED}>Ungrouped</option>
              </select>
            </div>
            <div>
              <button className="btn" disabled={panelBusy} onClick={() => savePanelEdit(inst, team)}>
                <span className="material-symbols-outlined">save</span>
                {panelBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input className="input" placeholder="Search people..." value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} style={{ marginBottom: 10 }} />
            {team.is_full ? (
              <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>Team is full (limit {team.member_limit}).</p>
            ) : options.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", margin: 0 }}>Nobody left to add.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {options.map((o) => (
                  <button
                    key={`${o.kind}:${o.id}`}
                    className="btn outline"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    onClick={async () => {
                      if (o.kind === "external") await addExternalToTeam(inst, team, o.id);
                      else await addMember(inst, team, o.id);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    {o.name}
                    <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>{o.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderCreateTeamForm(inst: any) {
    if (!teamForm) return null;
    return (
      <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--primary-green)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
          New team {teamFormGroupName(inst, teamForm.groupId, inst.group_label || "Company")}
        </div>
        <input className="input" placeholder="Team name (e.g. Research, Deck, Finance)" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        <textarea className="input" placeholder="Task description (optional)" rows={2} value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select className="input" style={{ width: "auto" }} value={teamSizeMode} onChange={(e) => setTeamSizeMode(e.target.value as any)}>
            <option value="none">No size requirement</option>
            <option value="range">Range (min–max)</option>
            <option value="exact">Exactly (required)</option>
          </select>
          {teamSizeMode === "range" && (
            <>
              <input className="input" type="number" min={1} placeholder="Min members" style={{ width: 130 }} value={teamMin} onChange={(e) => setTeamMin(e.target.value)} />
              <input className="input" type="number" min={1} placeholder="Max members" style={{ width: 130 }} value={teamMax} onChange={(e) => setTeamMax(e.target.value)} />
            </>
          )}
          {teamSizeMode === "exact" && (
            <input className="input" type="number" min={1} placeholder="Required no. of members" style={{ width: 190 }} value={teamExact} onChange={(e) => setTeamExact(e.target.value)} />
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={teamBusy} onClick={createTeam}>
            <span className="material-symbols-outlined">group_add</span>
            {teamBusy ? "Creating..." : "Create Team"}
          </button>
          <button className="btn outline" onClick={resetTeamForm}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---------- drill-down navigation ----------

  const openInstance = openInstanceId ? instances.find((i: any) => i.id === openInstanceId) || null : null;
  const openCategory = openInstance && openCategoryId && openCategoryId !== UNGROUPED
    ? (openInstance.groups || []).find((g: any) => g.id === openCategoryId) || null
    : null;
  const categoryTeams: any[] = openInstance
    ? (openCategoryId === UNGROUPED ? (openInstance.ungrouped_teams || []) : (openCategory?.teams || []))
    : [];

  function renderBreadcrumb() {
    const label = openInstance?.group_label || "Company";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, marginBottom: "1rem" }}>
        <button className="btn outline" style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => { setOpenInstanceId(null); setOpenCategoryId(null); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>arrow_back</span>
          All instances
        </button>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>chevron_right</span>
        {openCategoryId ? (
          <>
            <button
              onClick={() => setOpenCategoryId(null)}
              style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 700, color: "var(--primary-green)" }}
            >
              {openInstance?.name}
            </button>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>chevron_right</span>
            <strong>{openCategory ? openCategory.name : `Ungrouped ${label.toLowerCase()}`}</strong>
          </>
        ) : (
          <strong>{openInstance?.name}</strong>
        )}
      </div>
    );
  }

  // ============ VIEW 3: one category — the boards ============
  if (openInstance && openCategoryId) {
    const manage = canManageInstance(openInstance);
    const board = boardMode[openCategoryId] || "staffing";
    const teamHandlers = {
      onDropMember: (p: DragPayload & { type: "member" }, toTeamId: string) => dropOnTeam(openInstance, p, toTeamId),
      onReorderTeam: (teamId: string, beforeTeamId: string) => reorderTeam(openInstance, teamId, beforeTeamId),
      onRemoveMember: (team: any, member: any) => removeMember(openInstance, team, member),
      onEdit: (team: any) => openTeamPanel(openInstance, team, "edit"),
      onQuickAdd: (team: any) => openTeamPanel(openInstance, team, "add"),
      onDelete: (team: any) => deleteTeam(openInstance, team),
    };

    const memberTotal = categoryTeams.reduce((n: number, t: any) => n + (t.member_count || 0), 0);
    const short = categoryTeams.filter((t: any) => !t.requirement_met).length;

    return (
      <div>
        {renderBreadcrumb()}

        <div className="dashboard-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>corporate_fare</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem" }}>{openCategory ? openCategory.name : "Ungrouped"}</h3>
                {openCategory?.organization && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>· {openCategory.organization}</span>}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>{categoryTeams.length} team{categoryTeams.length === 1 ? "" : "s"}</span>
                <span>{memberTotal} {memberTotal === 1 ? "person" : "people"}</span>
                {short > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>{short} under minimum</span>}
              </div>
              {openCategory?.description && (
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{openCategory.description}</p>
              )}
            </div>
            {manage && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => { resetTeamForm(); setTeamForm({ instanceId: openInstance.id, groupId: openCategoryId === UNGROUPED ? null : openCategoryId }); }}>
                  <span className="material-symbols-outlined">add</span>
                  New team
                </button>
                {openCategory && (
                  <>
                    <button className="btn outline" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => {
                      if (editingCategory) { setEditingCategory(false); return; }
                      setScName(openCategory.name || "");
                      setScOrg(openCategory.organization || "");
                      setScDesc(openCategory.description || "");
                      setEditingCategory(true);
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                      {editingCategory ? "Cancel" : "Edit"}
                    </button>
                    <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
                      await deleteGroup(openInstance, openCategory);
                      setOpenCategoryId(null);
                    }}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {manage && editingCategory && openCategory && (
            <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: 12, background: "var(--surface-container-low)", border: "1px solid var(--primary-green)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                EDIT {(openInstance.group_label || "COMPANY").toUpperCase()}
              </div>
              <input className="input" placeholder={`${openInstance.group_label || "Company"} name`} value={scName} onChange={(e) => setScName(e.target.value)} />
              <input className="input" placeholder="Organisation (optional)" value={scOrg} onChange={(e) => setScOrg(e.target.value)} />
              <textarea className="input" rows={2} placeholder="Description (optional)" value={scDesc} onChange={(e) => setScDesc(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" disabled={scBusy} onClick={async () => {
                  if (!scName.trim()) return alert("Name cannot be empty");
                  setScBusy(true);
                  const ok = await updateGroup(openInstance, openCategory, { name: scName.trim(), organization: scOrg.trim(), description: scDesc.trim() });
                  setScBusy(false);
                  if (ok) setEditingCategory(false);
                }}>
                  <span className="material-symbols-outlined">save</span>
                  {scBusy ? "Saving..." : "Save"}
                </button>
                <button className="btn outline" onClick={() => setEditingCategory(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["staffing", "progress"] as BoardMode[]).map((m) => (
              <button
                key={m}
                className={board === m ? "btn" : "btn outline"}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setBoardMode({ ...boardMode, [openCategoryId]: m })}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{m === "staffing" ? "groups" : "trending_up"}</span>
                {m === "staffing" ? "Staffing" : "Progress"}
              </button>
            ))}
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>
              {board === "staffing" ? "Drag people onto teams" : "Drag teams to the next level"}
            </span>
          </div>

          {board === "staffing" ? (
            <>
              <div style={{ marginTop: "1rem" }}>
                <AvailableRail
                  instance={openInstance}
                  canManage={manage}
                  eligibleUsers={eligibleUsers}
                  onUnassign={(p) => unassign(openInstance, p)}
                  onAddOutside={() => setOutsidePanelFor(outsidePanelFor === openInstance.id ? null : openInstance.id)}
                />
              </div>

              {teamPanel !== null && teamPanel.instanceId === openInstance.id && (() => {
                const panel = teamPanel;
                const team = findTeam(openInstance, panel.teamId);
                if (!team) return null;
                return renderTeamPanel(panel, team, openInstance);
              })()}

              {categoryTeams.length === 0 ? (
                <p style={{ marginTop: "1rem", fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  No teams here yet. {manage ? "Create one above." : ""}
                </p>
              ) : (
                <div className="kb-row" style={{ marginTop: "1rem" }}>
                  {categoryTeams.map((team: any) => (
                    <TeamColumn key={team.id} team={team} instance={openInstance} canManage={manage} {...teamHandlers} />
                  ))}
                </div>
              )}

              <ExternalMembersPanel
                instance={openInstance}
                canManage={manage}
                open={outsidePanelFor === openInstance.id}
                setOpen={(v: boolean) => setOutsidePanelFor(v ? openInstance.id : null)}
                onCreate={(payload) => createExternal(openInstance, payload)}
                onUpdate={(ext, patch) => updateExternal(openInstance, ext, patch)}
                onDelete={(ext) => deleteExternal(openInstance, ext)}
              />
            </>
          ) : (
            <LevelBoard
              instance={openInstance}
              teams={categoryTeams}
              canManage={manage}
              onMoveLevel={(teamId, toLevel) => moveTeamLevel(openInstance, teamId, toLevel)}
              onSetStatus={(team, status) => setTeamStatus(openInstance, team, status)}
            />
          )}
        </div>

        {teamForm !== null && teamForm.instanceId === openInstance.id && renderCreateTeamForm(openInstance)}
      </div>
    );
  }

  // ============ VIEW 2: one instance — its categories ============
  if (openInstance) {
    const manage = canManageInstance(openInstance);
    const label = openInstance.group_label || "Company";
    const s = openInstance.stats || {};
    const view = views[openInstance.id] || "teams";
    const cats: any[] = [
      ...(openInstance.groups || []),
      ...((openInstance.ungrouped_teams || []).length > 0 || (openInstance.groups || []).length === 0
        ? [{ id: UNGROUPED, name: "Ungrouped", teams: openInstance.ungrouped_teams || [], synthetic: true }]
        : []),
    ];

    return (
      <div>
        {renderBreadcrumb()}

        <div className="dashboard-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{openInstance.name}</h3>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>{s.group_count || 0} {label.toLowerCase()}{(s.group_count || 0) === 1 ? "" : "s"}</span>
                <span>{s.team_count || 0} teams</span>
                <span>{s.member_count || 0} people{(s.external_count || 0) > 0 ? ` (${s.external_count} outside)` : ""}</span>
                <span>{(openInstance.levels || []).length} level{(openInstance.levels || []).length === 1 ? "" : "s"}</span>
                {(s.understaffed_count || 0) > 0 && <span style={{ color: "#ef4444", fontWeight: 700 }}>{s.understaffed_count} under min</span>}
              </div>
              {openInstance.description && (
                <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{openInstance.description}</p>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(openInstance.levels || []).map((l: any, i: number) => (
                  <span key={l.position} style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 6,
                    background: i === (openInstance.levels || []).length - 1 ? "rgba(245, 158, 11, 0.16)" : "var(--surface-container-low)",
                    color: i === (openInstance.levels || []).length - 1 ? "#b45309" : "var(--text-secondary)",
                    border: "1px solid var(--border-light)",
                  }}>
                    {l.position}. {l.name}
                  </span>
                ))}
              </div>
            </div>
            {manage && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn outline" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => (editingInstance ? setEditingInstance(false) : openInstanceSettings(openInstance))}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>settings</span>
                  {editingInstance ? "Cancel" : "Edit instance"}
                </button>
                <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={() => deleteInstance(openInstance)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            )}
          </div>

          {manage && editingInstance && (
            <div style={{ marginTop: "1.25rem", padding: "1rem", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--primary-green)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>settings</span>
                <strong style={{ fontSize: 14 }}>Instance settings</strong>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>NAME</div>
                <input className="input" placeholder="Instance name" value={siName} onChange={(e) => setSiName(e.target.value)} />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>DESCRIPTION</div>
                <textarea className="input" rows={2} placeholder="Description (optional)" value={siDesc} onChange={(e) => setSiDesc(e.target.value)} />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>
                  WHAT ARE THE GROUPS INSIDE CALLED? <span style={{ fontWeight: 500, textTransform: "none" }}>— currently "{label}"</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {["Company", "Competition", "Track", "Client"].map((l) => (
                    <button key={l} className={siLabel === l ? "btn" : "btn outline"} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setSiLabel(l)}>
                      {l}
                    </button>
                  ))}
                  <input className="input" style={{ width: 160 }} placeholder="or type your own" value={siLabel} onChange={(e) => setSiLabel(e.target.value)} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>
                  LEVELS <span style={{ fontWeight: 500, textTransform: "none" }}>— rounds teams progress through</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={siLevelCount === n ? "btn" : "btn outline"} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setSiLevelCount(n)}>
                      {n}
                    </button>
                  ))}
                  <input
                    className="input" type="number" min={1} max={20} style={{ width: 90 }}
                    value={siLevelCount}
                    onChange={(e) => setSiLevelCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
                {siLevelCount > 1 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Array.from({ length: siLevelCount }, (_, i) => (
                      <input
                        key={i}
                        className="input"
                        style={{ width: 150 }}
                        placeholder={`Level ${i + 1} name`}
                        value={siLevelNames[i] || ""}
                        onChange={(e) => {
                          const next = [...siLevelNames];
                          next[i] = e.target.value;
                          setSiLevelNames(next);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" disabled={siBusy} onClick={() => saveInstanceSettings(openInstance)}>
                  <span className="material-symbols-outlined">save</span>
                  {siBusy ? "Saving..." : "Save settings"}
                </button>
                <button className="btn outline" onClick={() => setEditingInstance(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: "1.25rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["teams", "roster", "activity"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                className={view === mode ? "btn" : "btn outline"}
                style={{ padding: "6px 14px", fontSize: 13, textTransform: "capitalize" }}
                onClick={() => setViews({ ...views, [openInstance.id]: mode })}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {mode === "teams" ? "grid_view" : mode === "roster" ? "list_alt" : "history"}
                </span>
                {mode === "teams" ? label + "s" : mode === "activity" ? "What happened" : mode}
              </button>
            ))}
          </div>

          {view === "roster" && <RosterView instance={openInstance} />}
          {view === "activity" && <ActivityFeed instanceId={openInstance.id} authToken={authToken} />}

          {view === "teams" && (
            <>
              <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
                {cats.map((cat: any) => {
                  const catTeams = cat.teams || [];
                  const people = catTeams.reduce((n: number, t: any) => n + (t.member_count || 0), 0);
                  const shortN = catTeams.filter((t: any) => !t.requirement_met).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setOpenCategoryId(cat.id)}
                      style={{
                        textAlign: "left", cursor: "pointer", padding: "1rem", borderRadius: 12,
                        border: "1px solid var(--border-light)", background: "var(--surface)",
                        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.10)"; e.currentTarget.style.borderColor = "var(--primary-green)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ color: cat.synthetic ? "var(--text-tertiary)" : "var(--primary-green)" }}>
                          {cat.synthetic ? "inbox" : "corporate_fare"}
                        </span>
                        <strong style={{ fontSize: 15, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</strong>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-tertiary)" }}>chevron_right</span>
                      </div>
                      {cat.organization && <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-secondary)" }}>{cat.organization}</div>}
                      <div style={{ marginTop: 10, display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
                        <span>{catTeams.length} team{catTeams.length === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span>{people} {people === 1 ? "person" : "people"}</span>
                      </div>
                      {shortN > 0 && (
                        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, color: "#ef4444" }}>
                          {shortN} TEAM{shortN === 1 ? "" : "S"} UNDER MINIMUM
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {manage && (
                <div style={{ marginTop: "1.25rem", padding: "1rem", borderRadius: 12, background: "var(--surface-container-low)", border: "1px dashed var(--outline-variant)" }}>
                  {groupFormInstanceId === openInstance.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>New {label}</div>
                      <input className="input" placeholder={`${label} name (e.g. Deloitte)`} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                      <input className="input" placeholder="Organisation (optional)" value={groupOrg} onChange={(e) => setGroupOrg(e.target.value)} />
                      <textarea className="input" placeholder="Description (optional)" rows={2} value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" disabled={groupBusy} onClick={() => createGroup(openInstance)}>
                          <span className="material-symbols-outlined">add</span>
                          {groupBusy ? "Creating..." : `Create ${label}`}
                        </button>
                        <button className="btn outline" onClick={() => { setGroupFormInstanceId(null); setGroupName(""); setGroupOrg(""); setGroupDesc(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn outline" onClick={() => { setGroupFormInstanceId(openInstance.id); setGroupName(""); setGroupOrg(""); setGroupDesc(""); }}>
                      <span className="material-symbols-outlined">corporate_fare</span>
                      Add a {label.toLowerCase()}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ============ VIEW 1: all instances ============
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {loaded && instances.length > 0 && (
        <div className="dashboard-grid">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon-wrapper" style={{ background: kpi.bg, color: kpi.color }}>
                  <span className="material-symbols-outlined">{kpi.icon}</span>
                </div>
              </div>
              <span className="kpi-label">{kpi.label}</span>
              <span className="kpi-value">{kpi.value}</span>
              {kpi.label === "People placed" && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {totals.internal} club · {totals.external} outside
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {canCreate && (
        <div className="dashboard-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>add_circle</span>
            <h3 style={{ margin: 0 }}>Create New Instance</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="input" placeholder="Instance name (e.g. Case Comp Season 2026)" value={instName} onChange={(e) => setInstName(e.target.value)} />
            <textarea className="input" placeholder="Description (optional)" rows={2} value={instDesc} onChange={(e) => setInstDesc(e.target.value)} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>WHAT DO YOU CALL THE GROUPS INSIDE?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {["Company", "Competition", "Track", "Client"].map((l) => (
                  <button key={l} className={instGroupLabel === l ? "btn" : "btn outline"} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setInstGroupLabel(l)}>
                    {l}
                  </button>
                ))}
                <input className="input" style={{ width: 160 }} placeholder="or type your own" value={instGroupLabel} onChange={(e) => setInstGroupLabel(e.target.value)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
                HOW MANY LEVELS? <span style={{ fontWeight: 500, textTransform: "none" }}>— rounds teams progress through</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={instLevelCount === n ? "btn" : "btn outline"} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setInstLevelCount(n)}>
                    {n}
                  </button>
                ))}
                <input
                  className="input" type="number" min={1} max={20} style={{ width: 90 }}
                  value={instLevelCount}
                  onChange={(e) => setInstLevelCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </div>
              {instLevelCount > 1 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Array.from({ length: instLevelCount }, (_, i) => (
                    <input
                      key={i}
                      className="input"
                      style={{ width: 150 }}
                      placeholder={`Level ${i + 1} name`}
                      value={instLevelNames[i] || ""}
                      onChange={(e) => {
                        const next = [...instLevelNames];
                        next[i] = e.target.value;
                        setInstLevelNames(next);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {isBoard ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>DEPARTMENTS INVOLVED</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {departments.map((d: any) => (
                    <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px", background: "var(--surface-container-low)", border: "1px solid var(--border-light)", borderRadius: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={instDeptIds.includes(d.id)} onChange={(e) => {
                        setInstDeptIds(e.target.checked ? [...instDeptIds, d.id] : instDeptIds.filter((x) => x !== d.id));
                      }} />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
                This instance will be scoped to your department ({departmentId ? deptName(departmentId) : "no department assigned"}).
              </p>
            )}
            <div>
              <button className="btn" disabled={instBusy} onClick={createInstance}>
                <span className="material-symbols-outlined">rocket_launch</span>
                {instBusy ? "Creating..." : "Create Instance"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
          <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "var(--text-tertiary)" }}>search</span>
          <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search instances, groups, teams, or people..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {q && (
          <button className="btn outline" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setSearchQuery("")}>
            <span className="material-symbols-outlined">close</span>
            Clear
          </button>
        )}
      </div>

      {loaded && instances.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>diversity_3</span>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
            No instances yet. An instance is an event, case comp, or application — split into groups, then teams, progressing through levels.
          </p>
        </div>
      )}

      {loaded && instances.length > 0 && visibleInstances.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>search_off</span>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>Nothing matches "{searchQuery}".</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {visibleInstances.map((inst: any) => {
          const s = inst.stats || {};
          const lv = inst.levels || [];
          return (
            <button
              key={inst.id}
              onClick={() => { setOpenInstanceId(inst.id); setOpenCategoryId(null); }}
              style={{
                textAlign: "left", cursor: "pointer", padding: "1.25rem", borderRadius: 14,
                border: "1px solid var(--border-light)", background: "var(--bg-card)",
                transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.12)"; e.currentTarget.style.borderColor = "var(--primary-green)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border-light)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>diversity_3</span>
                <strong style={{ fontSize: 16, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inst.name}</strong>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--text-tertiary)" }}>chevron_right</span>
              </div>
              {inst.description && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {inst.description}
                </p>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
                <span>{s.group_count || 0} {(inst.group_label || "Company").toLowerCase()}s</span>
                <span>·</span>
                <span>{s.team_count || 0} teams</span>
                <span>·</span>
                <span>{s.member_count || 0} people</span>
              </div>
              {lv.length > 1 && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--text-tertiary)" }}>stairs</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {lv.length} levels · {lv[0].name} → {lv[lv.length - 1].name}
                  </span>
                </div>
              )}
              {(s.understaffed_count || 0) > 0 && (
                <div style={{ marginTop: 10, fontSize: 10, fontWeight: 800, color: "#ef4444" }}>
                  {s.understaffed_count} TEAM{s.understaffed_count === 1 ? "" : "S"} UNDER MINIMUM
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
