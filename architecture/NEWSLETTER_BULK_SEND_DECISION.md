# Newsletter Bulk Send — Decision Record

Date: 2026-08-21

## Question

For sending newsletters to hundreds (eventually 1000+) of subscribers:

1. n8n or Amazon SES?
2. Separate Cloudflare D1 database for subscribers alone?

## Decision

**1. Amazon SES. Not n8n.**

- n8n is a workflow automation platform, not an email provider. It still needs SES/Resend underneath to actually send, plus a server (or ~€20+/mo n8n Cloud) to run it. Adding a service to avoid a one-time SES setup is not worth it.
- SES cost: $0.10 per 1,000 emails. Built for bulk.
- Newsletter send logic already lives in the Worker (`apps/admin-api/index.ts`), no orchestration layer needed.
- Use `SendBulkTemplatedEmail` (50 recipients/call): 1,000 subscribers = 20 subrequests, well within Worker limits. No sequential loop, no 550ms delay per email.
- Keep Resend for transactional emails (OTP, welcome, admin tokens) — as already planned in SES_SETUP.md.

**2. No separate DB. Subscribers stay in the same D1.**

- `newsletter_subscribers` table already exists in the main D1 database.
- SQLite/D1 handles thousands of rows trivially. A separate database buys nothing at this scale — just extra wiring.
- Revisit only if the newsletter becomes its own service with different owners/access.

## Current State (as of this decision)

- SES is **not yet set up**. One-time setup pending, follow SES_SETUP.md:
  1. AWS account → SES → domain `180dcvitc.org` (Mumbai region, ap-south-1)
  2. DNS records in Cloudflare (verification TXT, 3 DKIM CNAMEs, MAIL FROM MX/TXT, SPF, DMARC) — all grey cloud
  3. Request production access (sandbox only sends to verified emails; approval usually <24h)
  4. IAM user with SES send permissions → secrets in Worker (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`)
- Until then, `/api/newsletter-editor/send` uses Resend and works fine — it just stops at 100 recipients/day (quota check at index.ts line ~1961).

## Changes Needed When Migrating to SES

In `apps/admin-api/index.ts`:

- [ ] Remove/raise the `daily_email_count >= 100` cap for the SES send path (lines ~1960-1961, ~1984)
- [ ] Replace the sequential `for` loop + `setTimeout(550)` per-recipient Resend calls with `SendBulkTemplatedEmail` batches of 50 (lines ~1983-2004)
- [ ] Same for `/api/newsletter-editor/send-event`
- [ ] Optional: pre-wire SES code with Resend as automatic fallback until AWS secrets are configured
- [ ] If subscriber count grows past ~5-10k: move sends to Cloudflare Queues or a Cron Trigger processing batches, so a single Worker invocation never hits CPU/duration limits
