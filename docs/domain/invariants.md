# Invariants — 180DC VIT Chennai Platform

Invariants are properties that must never become false while the system is running.

## Auth invariants

### INV-AUTH-01: Authenticated requests require a valid, unrevoked, unexpired token

- **Statement:** Every request to a non-public `admin-api` endpoint must present a Bearer token that exists in `admin_tokens`, has `revoked_at IS NULL`, and has `expires_at` in the future or null.
- **Reason:** This is the only authorization boundary between the public internet and member data.
- **Where enforced:** `apps/admin-api/index.ts`, auth middleware starting at `app.use("*", ...)`.
- **How verified:** Inspect `admin_tokens` lookup; attempt a request without a token or with a revoked token and confirm 401.
- **Related business rules:** RULE-AUTH-01.
- **Current status:** ENFORCED.

### INV-AUTH-02: Maintenance mode blocks non-board members

- **Statement:** When `maintenance_mode.enabled = 1`, any authenticated member with `power_level < 100` must receive a 503 error on all authenticated endpoints.
- **Reason:** Board needs a way to take the members portal offline for other users.
- **Where enforced:** Auth middleware in `apps/admin-api/index.ts`.
- **How verified:** Enable maintenance mode and attempt a request with a non-board token.
- **Related business rules:** RULE-AUTH-05, RULE-MAINT-02.
- **Current status:** ENFORCED.

### INV-AUTH-03: Google login cannot bypass token auth

- **Statement:** Clerk/Google login only provides a token if the user's `oauth_enabled = 1` and the Clerk user is linked to a `users` row.
- **Reason:** Google OAuth is an alternative login method, not a separate auth boundary.
- **Where enforced:** `POST /api/auth/clerk-login`.
- **How verified:** Try logging in with an unlinked Clerk account; confirm 403.
- **Related business rules:** RULE-AUTH-02.
- **Current status:** ENFORCED.

## Role and permission invariants

### INV-ROLE-01: Sensitive operations require `power_level >= 100`

- **Statement:** Board-only endpoints (member creation/removal, role creation, global project creation, announcement creation, maintenance toggle, newsletter admin, consulting request management, admin tokens, advisory member creation) require `power_level >= 100`.
- **Reason:** These operations affect global club state and membership.
- **Where enforced:** Individual route handlers in `apps/admin-api/index.ts`.
- **How verified:** Attempt each operation with a director token; confirm 403.
- **Related business rules:** RULE-ROLE-03, RULE-MEMBER-01, RULE-PROJECT-01, RULE-ANN-01.
- **Current status:** ENFORCED.

### INV-ROLE-02: Directors can only act within their own department

- **Statement:** A director (`power_level = 50`) can only create department meets, documents, instructions, projects, and send emails for their assigned department.
- **Reason:** Department autonomy and data isolation.
- **Where enforced:** `canAccessDept` and `canManageInstanceTeams` helpers, plus inline checks in department and project routes.
- **How verified:** Attempt to create a meet for another department; confirm 403.
- **Related business rules:** RULE-DEPT-01, RULE-TEAM-04.
- **Current status:** ENFORCED.

### INV-ROLE-03: Board members cannot be removed

- **Statement:** `DELETE /api/members/:id` must reject if the target user's role has `power_level = 100`.
- **Reason:** Prevents accidental removal of club leadership.
- **Where enforced:** `DELETE /api/members/:id` handler.
- **How verified:** Attempt to delete a board member; confirm 400.
- **Related business rules:** RULE-ROLE-06.
- **Current status:** ENFORCED.

### INV-ROLE-04: Board roles cannot be transferred

- **Statement:** Role transfers where either party has `power_level = 100` must be rejected.
- **Reason:** Board roles are not transferable.
- **Where enforced:** `POST /api/role-transfers/:id/approve` and `POST /api/my-role-transfers/:id/accept`.
- **How verified:** Attempt to transfer a board role; confirm 400.
- **Related business rules:** Role transfer workflow.
- **Current status:** ENFORCED.

### INV-ROLE-05: New custom roles cannot reach board level

- **Statement:** `POST /api/roles` rejects `power_level >= 100`.
- **Reason:** Board-level power must be controlled by system-seeded board roles.
- **Where enforced:** `POST /api/roles`.
- **How verified:** Attempt to create a role with `power_level = 100`; confirm 400.
- **Related business rules:** RULE-ROLE-02.
- **Current status:** ENFORCED.

## Data integrity invariants

### INV-DATA-01: User email is unique

- **Statement:** `users.email` has a `UNIQUE` constraint.
- **Reason:** Email is the primary identifier for login and notifications.
- **Where enforced:** D1 schema (`users` table) and admin-token logic.
- **How verified:** Attempt to insert a duplicate email; confirm unique violation.
- **Related business rules:** All user creation flows.
- **Current status:** ENFORCED.

### INV-DATA-02: `admin_tokens.token` is the primary key

- **Statement:** `admin_tokens.token` is the primary key and `admin_tokens.email` is unique.
- **Reason:** Each email can have at most one active token path.
- **Where enforced:** D1 schema.
- **How verified:** Inspect schema.
- **Related business rules:** RULE-AUTH-01.
- **Current status:** ENFORCED.

### INV-DATA-03: Project-department assignments are unique

- **Statement:** `project_departments` has a composite primary key `(project_id, department_id)`.
- **Reason:** A department is assigned to a project only once.
- **Where enforced:** D1 schema and `INSERT OR IGNORE` in `POST /api/projects`.
- **How verified:** Inspect schema.
- **Related business rules:** RULE-PROJECT-02.
- **Current status:** ENFORCED.

### INV-DATA-04: Newsletter subscriber email is unique

- **Statement:** `newsletter_subscribers.email` is unique.
- **Reason:** A single email cannot subscribe twice.
- **Where enforced:** D1 schema.
- **How verified:** Attempt duplicate subscription.
- **Related business rules:** RULE-NEWS-01.
- **Current status:** ENFORCED.

### INV-DATA-05: Instance team member uniqueness

- **Statement:** `instance_team_members` has a composite primary key `(team_id, user_id)`.
- **Reason:** A user can only be in a team once.
- **Where enforced:** D1 schema and explicit check in `POST /api/team-instances/:id/teams/:teamId/members`.
- **How verified:** Attempt to add the same member twice.
- **Related business rules:** RULE-TEAM-06.
- **Current status:** ENFORCED.

## Rate and quota invariants

### INV-RATE-01: Rate limits per IP and endpoint

- **Statement:** Each endpoint with `checkRateLimit` must allow no more than its configured max requests within the configured window from the same IP.
- **Reason:** Prevent abuse and protect D1/email quotas.
- **Where enforced:** `checkRateLimit` helper and `rate_limits` table.
- **How verified:** Exceed the limit from a single IP; confirm 429.
- **Related business rules:** RULE-RATE-01.
- **Current status:** ENFORCED.

### INV-QUOTA-01: Daily email quota is 100

- **Statement:** No more than 100 emails may be sent per day through Resend. This is checked before each batch send.
- **Reason:** Resend free-tier and deliverability protection.
- **Where enforced:** `getTodayEmailCount`, `daily_email_count` table, and send handlers.
- **How verified:** Attempt to send more than 100 emails; confirm 429.
- **Related business rules:** RULE-QUOTA-01.
- **Current status:** ENFORCED.

## Content and security invariants

### INV-CONTENT-01: HTML content in case studies and newsletters is sanitized

- **Statement:** User-provided HTML is passed through `sanitizeBlogHtml` before storage.
- **Reason:** Prevent XSS and script injection.
- **Where enforced:** Case-study create/edit and newsletter create paths.
- **How verified:** Submit content with `<script>` tags; confirm they are removed.
- **Related business rules:** RULE-CASE-03.
- **Current status:** ENFORCED.

### INV-CONTENT-02: URLs are validated before storage

- **Statement:** `meet_link`, `fileUrl`, and `sourceFileUrl` values must pass `isValidUrl`.
- **Reason:** Prevent broken or malicious links.
- **Where enforced:** Meet, document, and file handlers.
- **How verified:** Submit an invalid URL; confirm 400.
- **Related business rules:** RULE-MEET-05.
- **Current status:** ENFORCED.

### INV-CONTENT-03: Announcement HTML is stripped

- **Statement:** Announcement title and content have all HTML tags removed before storage.
- **Reason:** Announcements are plain text.
- **Where enforced:** `POST /api/announcements`.
- **How verified:** Submit HTML; confirm it is stripped in the response/storage.
- **Related business rules:** RULE-ANN-02.
- **Current status:** ENFORCED.

## Newsletter editor invariants

### INV-NEWS-01: Newsletter editor access is restricted

- **Statement:** An email can use the newsletter editor only if it is in `newsletter_authorized_emails` or is a registered member with `power_level != 30`.
- **Reason:** Prevent unauthorized bulk email.
- **Where enforced:** `POST /api/newsletter-editor/otp/send`.
- **How verified:** Try to send an OTP with an unauthorized email; confirm 403.
- **Related business rules:** RULE-NEWS-04.
- **Current status:** ENFORCED.

### INV-NEWS-02: OTP has a 5-minute expiry

- **Statement:** `newsletter_otp_codes` rows expire 5 minutes after creation and can only be used once.
- **Reason:** Short-lived, single-use OTP.
- **Where enforced:** `POST /api/newsletter-editor/otp/verify`.
- **How verified:** Try to verify an expired or already-used OTP; confirm 400.
- **Related business rules:** RULE-NEWS-05.
- **Current status:** ENFORCED.

## Meet invariants

### INV-MEET-01: Meet links are hidden after the scheduled time

- **Statement:** List endpoints for meets return `meet_link = NULL` when the meet is more than 24 hours in the past.
- **Reason:** Past meet links should not remain visible.
- **Where enforced:** SQL in `GET /api/club-meets`, `GET /api/inter-dept-meets`, `GET /api/department-meets`.
- **How verified:** Create a meet scheduled in the past; list and confirm `meet_link` is null.
- **Related business rules:** RULE-MEET-01.
- **Current status:** ENFORCED.

## Team instance invariants

### INV-TEAM-01: Team member count respects `member_limit`

- **Statement:** A member cannot be added to a team if the team already has `member_limit` members, and `member_limit` cannot be lowered below the current count.
- **Reason:** Enforce team size caps.
- **Where enforced:** `POST /api/team-instances/:id/teams` and `PUT` and `POST .../members`.
- **How verified:** Try to add a member to a full team; confirm 400. Try to lower limit below current count; confirm 400.
- **Related business rules:** RULE-TEAM-07, RULE-TEAM-08.
- **Current status:** ENFORCED.

### INV-TEAM-02: Advisory members cannot be in teams

- **Statement:** A user with `role_id = 'advisory'` cannot be added to an instance team.
- **Reason:** Advisory members are not club operational members.
- **Where enforced:** `validateTeamMemberEligibility`.
- **How verified:** Try to add an advisory user to a team; confirm 400.
- **Related business rules:** RULE-TEAM-06.
- **Current status:** ENFORCED.

### INV-TEAM-03: Team instance management is department-scoped for directors

- **Statement:** Directors can only create/update/delete instances and teams where their department is in `instance_departments`.
- **Reason:** Department-level ownership.
- **Where enforced:** `canManageInstanceTeams` helper.
- **How verified:** Try to update an instance in another department; confirm 403.
- **Related business rules:** RULE-TEAM-04.
- **Current status:** ENFORCED.
