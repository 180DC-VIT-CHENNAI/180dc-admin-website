# Newsletter Editor System

## Overview

Separate newsletter creation/sending system at `/subscriber/newsletter`, independent from the members portal. Uses OTP-based auth (not Clerk).

## Architecture

```
Members Board (/members)                 /subscriber/newsletter
─────────────────────────                 ──────────────────────
Newsletter panel (power >= 100):          OTP login → editor:
- Add/remove authorized emails            - Create/edit/delete drafts
- Manages WHO can access the editor       - Upload PDF/Word → extract text
                                          - Send to all subscribers
```

## Auth Flow (OTP)

1. User enters email at `/subscriber/newsletter`
2. Backend checks authorization:
   - Is email in `newsletter_authorized_emails` table? → allowed
   - Is email a registered member with power_level != 30? → allowed
   - Otherwise → 403
3. 6-digit OTP sent via Resend (expires 5 min)
4. User enters OTP → verified → 24h session token created
5. Session stored in `localStorage` as `nl_editor_session`

## Database Tables (D1)

```sql
newsletter_authorized_emails (email TEXT PRIMARY KEY, added_by TEXT, created_at DATETIME)
newsletter_otp_codes (id TEXT, email TEXT, code TEXT, expires_at DATETIME, used INTEGER)
newsletter_sessions (id TEXT, email TEXT, expires_at DATETIME)
newsletter_subscribers (id TEXT, email TEXT UNIQUE, active INTEGER)  -- existing
newsletters (id TEXT, title TEXT, description TEXT, content TEXT, source_file_url TEXT, sent_at DATETIME)  -- existing
```

## Backend Endpoints

All under `apps/admin-api/index.ts`.

### Public (no auth)
- `POST /api/newsletter-editor/otp/send` — send OTP to email
- `POST /api/newsletter-editor/otp/verify` — verify OTP, return session token

### OTP Session Auth (Bearer: session token)
- `GET /api/newsletter-editor/me` — check session
- `POST /api/newsletter-editor/logout` — destroy session
- `GET /api/newsletter-editor/drafts` — list own drafts
- `POST /api/newsletter-editor/drafts` — create/update draft
- `DELETE /api/newsletter-editor/drafts/:id` — delete own draft
- `POST /api/newsletter-editor/upload-source` — upload PDF/DOCX to R2
- `POST /api/newsletter-editor/send` — send newsletter to all subscribers

### Admin (requires board power_level >= 100, uses admin token auth)
- `GET /api/newsletter-editor/admin/authorized-emails` — list authorized emails
- `POST /api/newsletter-editor/admin/authorized-emails` — add email
- `DELETE /api/newsletter-editor/admin/authorized-emails/:email` — remove email

### Existing Public Newsletter Endpoints (were broken, now fixed)
- `GET /api/newsletter` — list published newsletters (landing page)
- `POST /api/newsletter/subscribe` — subscribe to newsletter
- `GET /api/newsletter/unsubscribe` — unsubscribe
- `GET /api/newsletter/subscribers/count` — public count

## Frontend Files

| File | Purpose |
|------|---------|
| `apps/frontend/src/pages/NewsletterEditorPage.tsx` | OTP login + newsletter editor page |
| `apps/frontend/src/pages/SubscriberPage.tsx` | Public subscriber page (Clerk Google auth) |
| `apps/frontend/src/sections/NewsletterSection.tsx` | Landing page newsletter section |
| `apps/frontend/src/pages/members/NewsletterSection.tsx` | Members board — authorized email management only |
| `apps/frontend/src/main.tsx` | Routes: `/subscriber`, `/subscriber/newsletter` |

## Routes (main.tsx)

- `/subscriber` — Clerk-based subscriber page (Google sign-in)
- `/subscriber/newsletter` — OTP-based newsletter editor (no Clerk)

## Key Fixes Applied

### Auth Middleware (index.ts)
1. Added newsletter public routes to `isPublicRoute()`:
   - `POST /api/newsletter/subscribe`
   - `GET /api/newsletter/unsubscribe`
   - `GET /api/newsletter/subscribers/count`
2. Added `GET /api/newsletter` to public GET routes
3. OTP endpoints bypass admin token auth:
   ```typescript
   if (url.pathname.startsWith("/api/newsletter-editor/") && !url.pathname.startsWith("/api/newsletter-editor/admin/")) {
     await next(); return;
   }
   ```
4. Admin endpoints (`/api/newsletter-editor/admin/*`) still require board auth

### Wrangler Migration (wrangler.toml)
- Removed `[[migrations]]` block for ChatRoomDO — it was already deleted via dashboard
- Migration tags conflict with dashboard-deployed versions

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `RESEND_API_KEY` | Cloudflare Workers secret + `.dev.vars` | Sending OTP and newsletter emails |
| `VITE_CLERK_PUBLISHABLE_KEY` | `apps/frontend/.env` | Clerk auth for subscriber page |

## Resend Configuration

- Domain: `180dcvitc.org` (verified in Resend)
- From address: `team@180dcvitc.org`
- Used for: OTP emails, newsletter sends, admin token emails

## Deploy Commands

```bash
# Backend
cd apps/admin-api
npx wrangler deploy

# Frontend
cd apps/frontend
npm run build
# Then deploy to Cloudflare Pages
```

## Known Gotchas

1. **ChatRoomDO migration error**: Don't use migration tags if class was already deleted via Cloudflare Dashboard. Remove `[[migrations]]` block.
2. **Newsletter public routes**: Must be explicitly in `isPublicRoute()` or the auth middleware returns 401.
3. **Newsletter editor admin routes**: Must NOT bypass auth middleware — they need board-level auth for `requireBoard()`.
4. **Power level 30 exclusion**: OTP access is denied to members with power_level == 30. Everyone else (including non-members in the authorized list) can access.
