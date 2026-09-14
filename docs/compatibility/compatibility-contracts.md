# Compatibility Contracts — 180DC VIT Chennai Platform

These contracts are the surfaces that external systems, the frontend, and club members depend on. Do not break them without an explicit migration plan.

## COMP-API-01 Public API routes must remain functional

The following routes are called by the public website without authentication. They must continue to return the same JSON shape and status codes.

- `GET /api/content/case-studies`
- `GET /api/content/team-members`
- `GET /api/content/partners`
- `GET /api/newsletter`
- `POST /api/newsletter/subscribe`
- `GET /api/newsletter/unsubscribe`
- `GET /api/newsletter/subscribers/count`
- `GET /api/departments`
- `GET /api/projects/completed`
- `GET /api/case-studies/images/*`
- `GET /api/admin/maintenance`
- `POST /api/signup-requests`
- `POST /api/consulting-request`
- `POST /api/dev-login`
- `POST /api/auth/clerk-login`
- `POST /api/auth/forgot-token`
- `POST /api/newsletter-editor/otp/send`
- `POST /api/newsletter-editor/otp/verify`

## COMP-API-02 Authenticated API response shape

All authenticated endpoints must return a top-level `success: boolean` and use consistent error fields:

```json
{ "success": true, "data": [...] }
{ "success": true, "message": "..." }
{ "error": "...", "retryAfter": 120 }
```

Do not change the status code conventions:

- `200` — success.
- `400` — client error / validation.
- `401` — missing or invalid token.
- `403` — forbidden (insufficient power).
- `404` — not found.
- `429` — rate limit or quota.
- `500` — server error.
- `503` — maintenance mode enabled.

## COMP-AUTH-01 Token contract

- Members log in with a UUID token stripped of dashes.
- Tokens are stored in `admin_tokens.token` (PRIMARY KEY) and looked up by `email`.
- Tokens are sent via `Authorization: Bearer <token>`.
- Tokens have `created_at`, optional `revoked_at`, and optional `expires_at`.
- Token validity requires `revoked_at IS NULL` and `expires_at` in the future or null.
- `POST /api/auth/rotate-token` creates a new token and deletes the old one.
- The `/api/forgot-token` behavior must return `200` with `success: true` even if the email does not exist, to prevent enumeration.

## COMP-AUTH-02 Role and permission contract

- `roles.power_level` is the source of truth for access control.
- Board threshold is `>= 100`.
- Director threshold is `>= 50`.
- Member threshold is `>= 10`.
- Advisory role `power_level = 30`.
- `users.department_id` is used to scope director access.
- The `requireBoard`, `requireMember`, `canAccessDept`, `canManageInstanceTeams`, and `canManageProjectTasks` helpers must not be changed without auditing all dependent endpoints.

## COMP-UI-01 Frontend storage keys

The frontend stores the following keys. Do not change key names or value shapes without a migration plan and frontend update.

- `sessionStorage.authToken`
- `sessionStorage.authEmail`
- `sessionStorage.authPowerLevel`
- `sessionStorage.authDepartmentId`
- `sessionStorage.authRoleId`
- `localStorage.authExpiresAt`
- `localStorage.membersSidebarCollapsed`

## COMP-UI-02 Frontend page structure

The public and members portal routes are defined by `react-router-dom`. The following path semantics must be preserved:

- `/` — public landing.
- `/members` — members portal (Clerk gate).
- `/members/*` — members portal sub-pages.
- `/subscriber` — newsletter subscriber page with Clerk.
- `/subscriber/newsletter` — newsletter editor (OTP).
- `/unsubscribe` — unsubscribe.
- `/request-account` — account request.
- `/recruitments` — recruitment placeholder.

## COMP-DEPLOY-01 Cloudflare Pages middleware

`apps/frontend/functions/_middleware.ts` proxies `/api/*` to `admin-api.technical-vitc.workers.dev`. Any change to the backend origin must be mirrored here and tested on a preview deployment.

## COMP-DEPLOY-02 Wrangler bindings

The following binding names are referenced in code. Changing them requires updates to `wrangler.toml`, `worker-configuration.d.ts`, and the local `.dev.vars` files.

- `DB`
- `CLUB_FILES`
- `BLOG_IMAGES`
- `CASE_STUDIES`
- `AUTH_SESSIONS`
- `QUEUE`
- `RESEND_API_KEY`
- `CLERK_SECRET_KEY`
- `ENVIRONMENT`

## COMP-DATA-01 Table and column names

The D1 table and column names in `docs/contracts/data-model.md` are a compatibility surface. Any rename requires a migration that preserves old names as views or a coordinated frontend/backend rollout.

Special attention:

- `users.email` must remain unique.
- `admin_tokens.token` is the primary key and `email` is unique.
- `project_departments` and `instance_departments` composite keys.
- `daily_email_count.date` is the primary key.

## COMP-EMAIL-01 Resend address and signature

Emails are sent from these addresses and use the 180DC VIT Chennai branded template. Changing the from address or template shape may affect deliverability.

- `180DC Admin <team@180dcvitc.org>`
- `180DC Consulting <team@180dcvitc.org>`
- `180DC Newsletter <team@180dcvitc.org>`
- `180DC Events <team@180dcvitc.org>`

## COMP-EMAIL-02 Daily quota

The daily email cap is 100. Any raise or removal must be coordinated with the email provider and documented.

## COMP-R2-01 Bucket keys

The following key patterns are used in R2. Do not change them without a data migration.

- `BLOG_IMAGES`: `static/completedProjects.json`
- `CLUB_FILES`: `<category>/<uuid>.<ext>`
- `CASE_STUDIES`: `images/<uuid>.<ext>`, `source/<uuid>.<ext>`

## COMP-CLERK-01 Frontend public key

The frontend relies on `VITE_CLERK_PUBLISHABLE_KEY`. The backend relies on `CLERK_SECRET_KEY`. Clerk JWTs issued by `@clerk/react` must continue to be verifiable by `@clerk/backend` in `admin-api`.

## COMP-CLERK-02 Linked account contract

A Clerk login is valid only when:

1. The Clerk JWT is valid.
2. The `users.clerk_user_id` or `users.email` matches the token.
3. `users.oauth_enabled = 1`.

Do not change this logic without updating the frontend linking flow.
