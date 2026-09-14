# Current State — 180DC VIT Chennai Platform

This document describes the repository as it exists on the `main` branch. It is the descriptive source of truth for an agent starting work.

## Overall status

The project is a **brownfield** Cloudflare-native monorepo. The `admin-api` Worker and the Vite/React frontend are the production system. The `public-api` and `job-processor` Workers are placeholders. Several documents in `architecture/` and `REPORT.md` describe aspirational features that do not exist in code.

## What is implemented

### `apps/admin-api/index.ts`

This single file is the entire production backend. It is a Hono Worker with:

- Route handlers for public and authenticated endpoints.
- D1 schema creation and runtime migrations (`ensureTables` and `runMigrations`).
- R2 object storage for case-study images, source files, club files, and static completed-projects JSON.
- KV for auth sessions (bound as `AUTH_SESSIONS` but not actively used in `main`; the token registry lives in D1).
- Queue producer binding (`QUEUE`) configured but unused.
- Resend-based email sending.
- Rate limiting in D1.
- HTML sanitization (`sanitizeBlogHtml`).
- Password hashing (PBKDF2) but no password login flow currently used.

### `apps/frontend`

A Vite + React + TypeScript SPA with React Router.

- Public landing page (`/`).
- `/members` members portal with Clerk gate.
- `/subscriber` public newsletter subscription page with Clerk.
- `/subscriber/newsletter` OTP-based newsletter editor.
- `/unsubscribe` public unsubscribe page.
- `/recruitments` and `/request-account` public pages.
- Cloudflare Pages `_middleware.ts` proxies `/api/*` to `admin-api.technical-vitc.workers.dev` and adds security headers.

### D1 data

Live data is in the `180dc-db` D1 database. Schema creation and migrations are run by the Worker on first request via `ensureDbReady`.

### Cloudflare Pages

The frontend is deployed as a Cloudflare Pages project named `180dc-admin-frontend` (per root `package.json` and `_middleware.ts`).

### Worker routes

- `admin-api` Worker route pattern: `*180dcvitc.org/api/*`.
- `public-api` Worker route pattern: no routes configured in `wrangler.toml`.
- `job-processor` Worker: queue consumer for `jobs-queue`, no message producers.

## What is a placeholder or not implemented

| Component | File | Status |
|-----------|------|--------|
| `public-api` Worker | `apps/public-api/index.ts` | Returns "Hello from public-api!" only. No routes or logic. |
| `job-processor` Worker | `apps/job-processor/index.ts` | Returns `{ success: true }` only. Queue consumer configured but no messages are produced. |
| `packages/db` | `packages/db/schema.sql` | Contains destructive `DROP TABLE` statements and a partial schema. Not used at runtime. |
| `architecture/backend-architecture-cloudflare.txt` | `architecture/` | Historical/aspirational design. Mentions Cloudflare Access, Next.js, Zod, KV caching, and presigned R2 uploads that do not exist in code. |
| Recruitment system | Mentioned in `REPORT.md` | Removed from code. `runMigrations` drops recruitment tables. |
| Real-time chat | Mentioned in `REPORT.md` | Not implemented in `main`. |
| AI chatbot (ConsultAI) | Mentioned in `REPORT.md` | Not implemented in `main`. |
| Amazon SES | `SES_SETUP.md`, `architecture/NEWSLETTER_BULK_SEND_DECISION.md` | Decision made, not implemented. Resend is still used. |

## Important discrepancies between documentation and code

| Document/code | Claims | Reality | Classification |
|---------------|--------|---------|----------------|
| `architecture/backend-architecture-cloudflare.txt` | Cloudflare Access enforces Google OAuth before admin requests. | Auth is custom token-based; Clerk is only used for Google login in the frontend, not Cloudflare Access. | ACCIDENTAL/HISTORICAL |
| `architecture/backend-architecture-cloudflare.txt` | Public API is a separate Hono Worker at `api.180dc-vit.in`. | `public-api` is a placeholder. All API calls are served by `admin-api`. | ACCIDENTAL/HISTORICAL |
| `architecture/backend-architecture-cloudflare.txt` | KV caching for public API. | KV is bound but not used for caching. | ACCIDENTAL/HISTORICAL |
| `architecture/backend-architecture-cloudflare.txt` | Zod validation. | No Zod schemas in code. | ACCIDENTAL/HISTORICAL |
| `REPORT.md` | Recruitment, chat, AI chatbot features. | Not implemented in `main`. | UNKNOWN/PLANNED |
| `packages/db/schema.sql` | "Placeholder for D1 schema and migrations." | File is dangerous and out of sync with runtime schema. | BUG (for documentation only) |
| `NEWSLETTER_EDITOR.md` | Describes newsletter editor accurately. | Current and accurate. | REQUIRED |
| `TEAM_INSTANCES_PLAN.md` | Describes team instances feature. | Implemented in `admin-api/index.ts` and `TeamInstancesSection.tsx`. | REQUIRED |

## Deployment topology

```
Public DNS 180dcvitc.org
  → Cloudflare Pages (180dc-admin-frontend)
      → Vite React SPA
      → _middleware.ts proxies /api/* to admin-api.technical-vitc.workers.dev

admin-api Worker
  → Deployed from apps/admin-api/index.ts
  → D1 database 180dc-db
  → R2 buckets CLUB_FILES, BLOG_IMAGES, CASE_STUDIES
  → KV namespace AUTH_SESSIONS
  → Queue binding QUEUE (unused)
  → Resend API for email

job-processor Worker
  → Queue consumer for jobs-queue (no producers)

public-api Worker
  → Placeholder
```

## Environment and secrets

The following bindings and secrets are used by `admin-api`:

| Name | Type | Purpose |
|------|------|---------|
| `DB` | D1 database | Main application database. |
| `CLUB_FILES` | R2 bucket | File manager uploads. |
| `BLOG_IMAGES` | R2 bucket | Static completed projects JSON and case-study source files. |
| `CASE_STUDIES` | R2 bucket | Case study images and newsletter source files. |
| `AUTH_SESSIONS` | KV namespace | Bound but not actively used in `main`. |
| `QUEUE` | Queue producer | Bound but not used in `main`. |
| `RESEND_API_KEY` | Secret | Resend email API. |
| `CLERK_SECRET_KEY` | Secret | Clerk JWT verification. |
| `ENVIRONMENT` | Var | Set to `production` on the deployed worker. |

The following are used by the frontend:

| Name | Type | Purpose |
|------|------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Env var | Clerk public key for Google sign-in. |
| `VITE_API_BASE_URL` | Env var | Optional override for local API base. Defaults to `http://127.0.0.1:8787` in dev and same-origin in production. |

## Known current behavior that must be preserved

- All API routes are served by `admin-api`. The frontend relies on this.
- Token auth uses the `admin_tokens` table. Tokens are created by board members and emailed.
- Rate limits and daily email cap are enforced.
- Meet link visibility is hidden after the scheduled time.
- `runMigrations` is idempotent and drops legacy recruitment tables.
- `ensureTables` creates tables only if they do not exist.

## Known gaps and accepted debt

- No automated tests.
- No formal migration files; schema evolution is in `admin-api/index.ts`.
- `public-api` and `job-processor` are not used.
- `packages/db` is a placeholder and misleading.
- `architecture/backend-architecture-cloudflare.txt` is historical and may confuse new agents.
