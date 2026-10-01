# ADR-004: Separate newsletter website (Ken-style) in its own repository

- **Status:** decided (pending implementation)
- **Date:** 2026-10-01

## Context

The newsletter system needs to be finished. Two changes are planned:

1. **Email provider:** replace Resend with Spacemail (SMTP) for bulk sends (see
   `docs/operations/SPACEMAIL_SETUP.md`).
2. **Newsletter format:** adopt the "The Ken" model — the email carries a short teaser
   plus a "Read on the website" CTA, and the full newsletter is read as a styled page on
   the web.

The open question: where should the newsletter reading experience live? Two options were
considered:

- **Option A:** add a viewer page + archive to the existing frontend SPA
  (`apps/frontend`, Cloudflare Pages, `180dcvitc.org`).
- **Option B:** host the newsletter site as a **separate repository** deployed to its own
  Cloudflare Pages project at `newsletter.180dcvitc.org`.

## Decision

Choose **Option B — a separate repository and separate Cloudflare Pages site** for the
newsletter viewer and archive.

- New repo (e.g. `180dc-newsletter`): a small Vite React (or plain static) site deployed
  to Cloudflare Pages at `newsletter.180dcvitc.org` (CNAME record in Cloudflare DNS).
- The site reads from the **existing** `admin-api` public endpoints:
  - `GET /api/newsletter` — published newsletter list (exists).
  - `GET /api/newsletter/:id` — full newsletter detail incl. sanitized `content` (new
    endpoint to add to `admin-api`).
  - `POST /api/newsletter/subscribe` + `GET /api/newsletter/unsubscribe` — opt-in/opt-out
    (exist).
- **CORS:** `admin-api` must return `Access-Control-Allow-Origin: https://newsletter.180dcvitc.org`
  on the public newsletter routes (small change in `apps/admin-api/index.ts`).
- Backend stays where it is. `admin-api` remains the single source of truth for
  subscribers, content, and sending. No data is duplicated into the new repo.

## Alternatives considered

### Option A: viewer inside the existing SPA (`apps/frontend`)

- Pros: one repo, one deploy, reuses design system, CSP, and existing `_middleware.ts`.
- Cons: the main site grows with newsletter-only pages; any newsletter visual work is
  coupled to the main site's release cycle; the user explicitly wants the newsletter
  experience decoupled from the main website.

### Option C: standalone Worker serving HTML directly

- Pros: no separate repo needed; Worker can bind D1 directly.
- Cons: still shares admin-api's data, duplicates rendering/design work, adds a second
  deploy pipeline anyway — strictly worse than Option B for the same isolation goal.

## Consequences

**Positive**

- Main website stays lean; no newsletter rendering in its codebase.
- The newsletter site owns its design system, CSP, and deploy pipeline — can be styled
  freely (The Ken-style) without touching the main SPA.
- Clean team boundary: newsletter content/UX can evolve independently.
- The whole newsletter lifecycle (subscribe, archive, viewer, unsubscribe) can live
  outside the main site.

**Negative**

- One more repository + Pages project + DNS record to maintain.
- The new public endpoint `GET /api/newsletter/:id` must be added to `admin-api`
  regardless (it is the data source either way).
- CORS must be configured on `admin-api` for the new origin.

**Risks**

- CSP on the new site must permit the sanitized stored HTML (inline styles) used by
  newsletter content.
- Newsletter content must remain sanitized on write (see `docs/domain/invariants.md`,
  `INV-CONTENT-01`) — never trust the stored HTML.

## Compatibility impact

- Public compatibility surface unchanged: `GET /api/newsletter`, subscribe, and
  unsubscribe keep their contracts. A new read-only endpoint is additive.
- No change to subscriber data or the `newsletters` table.

## Migration impact

1. Add `GET /api/newsletter/:id` (public, rate-limited, sanitized content) + CORS
   headers for `newsletter.180dcvitc.org` in `admin-api`.
2. Create the new repo and Pages project; add CNAME `newsletter.180dcvitc.org`.
3. Rewrite `newsletterEmailHtml()` to a teaser with a CTA pointing at
   `https://newsletter.180dcvitc.org/newsletter/{id}`.
4. Point existing email footers/unsubscribe links at the new site (BCC batches mean the
   unsubscribe link becomes a page with an email-entry form).

## Conditions for reconsideration

- If the newsletter site needs authenticated/personalized content, folding it back into
  the main SPA (which already has auth plumbing) may be simpler.
- If the team prefers a single codebase, Option A remains viable — the API contract is
  identical in both cases.