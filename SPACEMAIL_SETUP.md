# Spacemail Setup for 180DC

## Why this document exists

180DC is migrating email sending from Resend to Spacemail (Spaceship/Namecheap business
email) to finish the newsletter system. During Spacemail onboarding, only `@180dcvitc.org`
mailbox addresses could be created — `@mail.180dcvitc.org` addresses were not available.
This document explains why that happened, what the current DNS state means, and exactly
how to fix it so `From: team@180dcvitc.org` sends authenticate correctly.

## TL;DR

- **It is NOT a Resend configuration problem.** Resend has no control over what Spacemail
  accepts or how its DNS verification works.
- The Spacemail DNS verification records (MX + SPF) were created on the **subdomain**
  `mail.180dcvitc.org`, but the mailbox addresses are at the **root** domain
  `@180dcvitc.org`. Sending from `@180dcvitc.org` therefore fails SPF/DKIM.
- The root domain `180dcvitc.org` currently has **no MX records and no SPF record** at
  all, so moving Spacemail onto the root domain breaks nothing and is the correct fix.

## Current DNS state (verified live)

| Domain | Record type | Value | Status |
|--------|-------------|-------|--------|
| `180dcvitc.org` | TXT | `fbf0abfa-cc4f-4339-833f-357bd3b40167` (Cloudflare verification) | Present |
| `180dcvitc.org` | MX | *(none)* | **Missing** |
| `180dcvitc.org` | TXT (SPF) | *(none)* | **Missing** |
| `mail.180dcvitc.org` | MX | `mx1.spacemail.com` (pref 0), `mx2.spacemail.com` (pref 0) | Present |
| `mail.180dcvitc.org` | TXT (SPF) | `v=spf1 include:spf.spacemail.com ~all` | Present |
| `_dmarc.180dcvitc.org` | TXT | `v=DMARC1; p=none;` | Present |

## Root cause: why `mail.180dcvitc.org` "doesn't work" as a From domain

1. During Spacemail onboarding, the domain was added in a way that placed Spacemail's
   required DNS records (MX + SPF) on the **subdomain** `mail.180dcvitc.org`.
2. Spacemail mailbox addresses, however, are created at the **parent** domain — the
   account owns `180dcvitc.org`, so addresses look like `team@180dcvitc.org`, not
   `team@mail.180dcvitc.org`.
3. The result is a mismatch:
   - Mail *delivered* to `mail.180dcvitc.org` routes to Spacemail, but
   - Mail *sent* `From: team@180dcvitc.org` cannot authenticate, because the root domain
     has no SPF record and no DKIM key pointing at Spacemail.
4. Resend is unrelated to this. Resend only affects what Resend itself accepts as a
   `from` address; it cannot restrict which domains Spacemail verifies.

## The fix: move Spacemail DNS to the root domain

The root domain is currently "free" — it has no MX records, no SPF, and no mail service
of its own — so this change is safe and does not disrupt any existing mail flow.

### 1. Add MX records at the root (`180dcvitc.org`)

| Type | Name | Value | Priority |
|------|------|-------|----------|
| `MX` | `@` | `mx1.spacemail.com` | 0 |
| `MX` | `@` | `mx2.spacemail.com` | 0 |

> DNS-only (grey cloud) — never proxy MX records.

### 2. Add SPF at the root

| Type | Name | Value |
|------|------|-------|
| `TXT` | `@` | `v=spf1 include:spf.spacemail.com ~all` |

> If Resend is kept as a fallback sender, combine both includes instead:
> `v=spf1 include:spf.spacemail.com include:resend.com ~all`

### 3. Add DKIM at the root

Get the exact DKIM CNAME record(s) from **Spacemail Manager → Mailbox → domain settings**
(selector, e.g. `smd._domainkey.180dcvitc.org`) and add them at the root domain.

### 4. Clean up the subdomain records (optional)

The `mail.180dcvitc.org` MX + SPF records are no longer needed once the root domain is
configured. They are harmless if left in place, but removing them avoids confusion.

### 5. Verify

- Wait 5–30 minutes for Cloudflare DNS propagation.
- Spacemail Manager should show the domain as verified at `180dcvitc.org`.
- Send a test email `From: team@180dcvitc.org` and check SPF/DKIM pass (e.g. via the
  test mailbox's headers or an SPF/DKIM checker).
- Keep DMARC at `p=none` for at least a week after switching, then consider
  `p=quarantine`.

## What this enables

Once the root domain is verified in Spacemail:

- `From: 180DC Newsletter <team@180dcvitc.org>` sends authenticate correctly through
  Spacemail SMTP (`mail.spacemail.com:465` SSL, or `:587` STARTTLS; auth = full mailbox
  address + mailbox password).
- No `@mail.180dcvitc.org`-style From addresses are needed.
- The existing codebase can keep all its current `From` addresses
  (`team@180dcvitc.org`) unchanged.

## Spacemail sending limits (for planning the newsletter send)

- **500 emails per hour per mailbox** on paid plans (trial plans: 20/hour).
- **Up to 50 recipients per email**, including To, CC and BCC combined.
- Max message size 50 MB.
- Limits are per mailbox; aliases share the same quota.

Implication for the newsletter: ~500 subscribers = 10 messages (50 BCC recipients each),
well inside the hourly cap. Because the body is shared across a BCC batch, the
per-recipient unsubscribe link must become a link to the unsubscribe page
(`https://180dcvitc.org/unsubscribe`) where the user enters their email.

## Related changes tracked elsewhere

- Backend email refactor (single SMTP `sendEmail()` choke point replacing all Resend
  calls in `apps/admin-api/index.ts`) — implementation plan pending.
- The Ken-style web-hosted newsletter viewer — implementation plan pending.