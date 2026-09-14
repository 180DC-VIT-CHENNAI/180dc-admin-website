# Deployment — 180DC VIT Chennai Platform

## Environments

- **Local development:** `wrangler dev` for the worker, `pnpm dev` for the Vite frontend.
- **Production:** Cloudflare Pages for the frontend, Cloudflare Worker for `admin-api`.
- **Preview branches:** Cloudflare Pages and Wrangler support preview deployments.

## Repository setup

1. Install pnpm:

   ```bash
   npm install -g pnpm
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Ensure your Cloudflare account is authenticated with Wrangler:

   ```bash
   pnpm wrangler login
   ```

## Required secrets and variables

Create `apps/admin-api/.dev.vars` for local development:

```ini
RESEND_API_KEY=re_...
CLERK_SECRET_KEY=sk_test_...
ENVIRONMENT=development
```

The frontend needs `VITE_CLERK_PUBLISHABLE_KEY` in `apps/frontend/.env.local`:

```ini
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://127.0.0.1:8787
```

In production, these are set via Wrangler secrets and Pages environment variables.

## Running locally

### Admin API

```bash
cd apps/admin-api
pnpm wrangler dev
```

- Default local URL: `http://127.0.0.1:8787`.
- The worker creates the D1 schema on first request if the local database is empty.

### Frontend

```bash
cd apps/frontend
pnpm dev
```

- Vite dev server runs the SPA.
- The local proxy in `vite.config.ts` may route `/api/*` to the local worker.

### Full stack

Run in two terminals:

```bash
cd apps/admin-api && pnpm wrangler dev
cd apps/frontend && pnpm dev
```

## Wrangler configuration

### `apps/admin-api/wrangler.toml`

```toml
name = "admin-api"
compatibility_date = "2024-09-01"
main = "src/index.ts"

[[d1_databases]]
binding = "DB"
database_name = "180dc-db"
database_id = "<D1_DATABASE_ID>"

[[r2_buckets]]
binding = "CLUB_FILES"
bucket_name = "180dc-club-files"

[[r2_buckets]]
binding = "BLOG_IMAGES"
bucket_name = "180dc-blog-images"

[[r2_buckets]]
binding = "CASE_STUDIES"
bucket_name = "180dc-case-studies"

[[kv_namespaces]]
binding = "AUTH_SESSIONS"
id = "<KV_NAMESPACE_ID>"

[[queues.producers]]
binding = "QUEUE"
queue = "jobs-queue"

[vars]
ENVIRONMENT = "production"

# Secrets must be set via `wrangler secret put`
# RESEND_API_KEY
# CLERK_SECRET_KEY
```

The actual `database_id` and KV IDs are stored in `wrangler.toml` and should not be committed if they are sensitive. The repository currently has them in the file; this is a known configuration pattern but should be reviewed.

### `apps/frontend/wrangler.toml`

Cloudflare Pages build settings are configured in this file. The `functions/_middleware.ts` is the Pages middleware.

### `apps/job-processor/wrangler.toml`

Queue consumer binding for `jobs-queue`. Not used in production today.

### `apps/public-api/wrangler.toml`

No routes configured. Placeholder.

## Deployment commands

### Build

```bash
pnpm turbo run build
```

This builds only the frontend in the current configuration.

### Deploy admin-api

```bash
cd apps/admin-api
pnpm wrangler deploy
```

### Deploy frontend

```bash
cd apps/frontend
pnpm run build
pnpm wrangler pages deploy dist --project-name 180dc-admin-frontend
```

### Deploy all

The root `package.json` has helper scripts:

```bash
pnpm run deploy:backend     # deploys admin-api
pnpm run deploy:frontend    # builds and deploys frontend
pnpm run deploy:all         # deploys backend then frontend
```

## Migration procedure

Because `admin-api` manages its own schema, deploying a new version is usually enough. If a migration needs careful control:

1. Deploy the new Worker version.
2. Trigger a single request so `ensureDbReady` and `runMigrations` run.
3. Verify schema with `wrangler d1 execute`.
4. Roll back by reverting the Worker and restoring a D1 backup if necessary.

Do **not** run `packages/db/schema.sql` directly against D1.

## Rollback

- Worker: `wrangler deploy` a previous version using a previous commit.
- Pages: use the Cloudflare Pages dashboard to roll back to a previous deployment.
- D1: restore from a backup if a destructive migration was deployed.

## Observability

- Worker logs are available in the Cloudflare Workers dashboard.
- Email failures are logged to `console.error`.
- Audit log entries are stored in the `audit_log` table.
- No external APM or error tracking is configured.

## Domain and routing

- `180dcvitc.org` is the public site.
- `admin-api.technical-vitc.workers.dev` is the Worker origin used by Pages middleware.
- Worker route pattern in `wrangler.toml`: `*180dcvitc.org/api/*`.

The Pages middleware rewrites `/api/*` requests to the Worker, so the frontend does not call `180dcvitc.org/api/*` directly.
