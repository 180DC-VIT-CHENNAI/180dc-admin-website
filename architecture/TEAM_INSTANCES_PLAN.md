# Team Instances — Feature Plan

## Goal

Allow directors and board members to create **instances** (an event, case comp, or an application being built like a recruitment website) and split work into **teams** (e.g. Frontend, Backend, Design) with an optional per-team member cap. Everyone (except advisory) can view; only authorized people can edit.

## Data Model (D1, added to `ensureDbReady` in `apps/admin-api/index.ts`)

```sql
team_instances         (id, name, description, created_by, created_at)
instance_departments   (instance_id, department_id)  -- PK(instance_id, department_id)
instance_teams         (id, instance_id, name, description, member_limit, min_members, created_by, created_at)
instance_team_members  (team_id, user_id, added_by, created_at)  -- PK(team_id, user_id)
```

Note: named `instance_teams` / `instance_team_members` because the legacy public-site `team_members` table (leadership page) already exists.

### Team size rules

- `min_members` (optional): minimum required members. `member_limit` (optional): max cap. "Exactly N" = min = max = N.
- Max is enforced on every member add; min is **not** blocking — teams below min are flagged in the API response (`requirement_met: false`) and rendered with a **red card** + "NEEDS N MORE MEMBERS" badge.
- Lowering max below current member count is rejected; setting min above current count is allowed (that's how you mark a team as under-staffed).

- `member_limit` is `NULL` = unlimited.
- Mirrors the existing `projects` / `project_departments` / `project_roles` pattern.

## Permissions

| Action | Power 100 (Board) | Power 50 (Director) | Members (< 50) | Advisory |
|---|---|---|---|---|
| View instances & teams | Yes | Yes | Yes | **No (403)** |
| Create instance | Yes, any depts | Yes, own dept only | No | No |
| Edit/delete instance | Yes | Own dept's instance | No | No |
| Create/edit/delete teams | Yes, all instances | Own dept's instances | No | No |
| Add/remove team members | Any registered, non-advisory user | Own dept members only (incl. self) | No | No |

Rules enforced server-side:
- Team members **must be registered users** (exist in `users`).
- Advisory users cannot be added to teams.
- Directors can only manage instances where their `department_id` is in `instance_departments`.
- `member_limit` (if set) is enforced on every add — rejects when team is full; lowering the limit below current size is rejected.

## API Endpoints (all under `/api`, envelope `{ success, data | error }`)

| Method | Path | Access |
|---|---|---|
| GET | `/api/team-instances` | All except advisory. Returns instances + departments + teams + members |
| POST | `/api/team-instances` | ≥ 50. `{ name, description?, departmentIds? }` (board: any; director: forced to own dept) |
| PUT | `/api/team-instances/:id` | Instance manager. `{ name?, description? }` |
| DELETE | `/api/team-instances/:id` | Instance manager. Cascades teams + members |
| POST | `/api/team-instances/:id/teams` | Instance manager. `{ name, description?, minMembers?, maxMembers?, memberIds? }` |
| PUT | `/api/team-instances/:id/teams/:teamId` | Instance manager. `{ name?, description?, minMembers?, maxMembers? }` |
| DELETE | `/api/team-instances/:id/teams/:teamId` | Instance manager |
| POST | `/api/team-instances/:id/teams/:teamId/members` | Instance manager. `{ userId }` |
| DELETE | `/api/team-instances/:id/teams/:teamId/members/:userId` | Instance manager |

Plus rate limiting (`checkRateLimit`) and audit logging (`addAuditLog`) on mutations.

## Frontend

- New panel: `apps/frontend/src/pages/members/TeamInstancesSection.tsx`
  - **Search bar** — filters instances by name/description, and filters teams inside them by team name/description/member names; instances with no match are hidden
  - Create-instance card (board picks departments via checkboxes; director implicitly own dept)
  - Instance cards → nested team cards with member chips, size badge (`n / cap`, `n (min X, max Y)`, `n / N required`), add-member dropdown, inline create-team form (name, optional description, size requirement: none / range min–max / exactly N, multi-select members from `allUsers`)
  - Teams below their minimum render with a **red border/background** + "NEEDS N MORE MEMBERS" badge
  - Read-only view for members (< 50)
- Nav: `{ id: "team-instances", label: "Teams", minPower: 0, icon: "diversity_3" }` in the Management section of `MembersLayout.tsx` (advisory already excluded — they get a separate nav).
- Conventions: raw `fetch` + Bearer token, `dashboard-card` / `btn` / `input` classes, `alert`/`confirm`, no new deps.

## Verification

- `pnpm --filter admin-api exec tsc --noEmit` (typecheck)
- `pnpm --filter frontend run build` (Vite build)
