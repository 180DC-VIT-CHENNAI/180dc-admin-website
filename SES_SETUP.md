# Amazon SES Setup for 180DC

## Why SES

- Replacing Resend for bulk newsletter/event mail sends
- Resend kept for transactional emails (OTP, welcome)
- SES cost: $0.10 per 1,000 emails vs Resend pricing tiers

## AWS Account Setup

1. Go to AWS Console → SES → Get set up
2. Region: **Asia Pacific (Mumbai)**
3. Step 1: Your email (AWS account email)
4. Step 2: Sending domain → `180dcvitc.org`
5. Step 3: **Essentials** plan
6. Step 4: **Disable all VDM features** (Virtual Deliverability Manager, Engagement tracking, Optimized shared delivery, Auto Validation) — extra cost, not needed at our volume
7. Step 5: Dedicated IPs → **Disabled**
8. Step 6: Tenant management → **Disabled**
9. Step 7: Review and submit

## DNS Records to Add in Cloudflare

After SES gives you the verification records, add these in Cloudflare DNS.
**All records must be DNS only (grey cloud) — not proxied.**

### Domain Verification

| Type | Name | Value |
|------|------|-------|
| `TXT` | `_amazonses.180dcvitc.org` | `<verification-token-from-ses>` |

### DKIM (3 records — SES provides these)

| Type | Name | Value |
|------|------|-------|
| `CNAME` | `<token1>._domainkey.180dcvitc.org` | `<token1>.dkim.amazonses.com` |
| `CNAME` | `<token2>._domainkey.180dcvitc.org` | `<token2>.dkim.amazonses.com` |
| `CNAME` | `<token3>._domainkey.180dcvitc.org` | `<token3>.dkim.amazonses.com` |

### MAIL FROM Domain

| Type | Name | Value |
|------|------|-------|
| `MX` | `mail.180dcvitc.org` | `10 feedback-smtp.us-east-1.amazonses.com` |
| `TXT` | `mail.180dcvitc.org` | `"v=spf1 include:amazonses.com ~all"` |

### SPF (update existing or add new)

If no existing SPF record:
```
Type: TXT
Name: @
Value: "v=spf1 include:amazonses.com ~all"
```

If you already have SPF for Resend, combine them:
```
"v=spf1 include:amazonses.com include:resend.com ~all"
```

### DMARC (recommended)

| Type | Name | Value |
|------|------|-------|
| `TXT` | `_dmarc.180dcvitc.org` | `"v=DMARC1; p=quarantine; rua=mailto:dmarc@180dcvitc.org"` |

## After DNS Propagation

1. Wait 5-30 minutes for Cloudflare DNS to propagate
2. SES console → domain status should show **Verified**
3. Request **production access** (sandbox only sends to verified emails)
   - Go to SES → Account dashboard → Request production access
   - Describe use case: newsletter communications, expected volume, opt-in method
   - Usually approved within 24 hours

## Backend Integration Plan

### Keep Resend for (low volume, high deliverability):
- OTP emails (`/api/newsletter-editor/otp/send`)
- Welcome/re-subscribe emails (`/api/newsletter/subscribe`)
- Admin token emails

### Use SES for (bulk, cost-effective):
- Newsletter sends (`/api/newsletter-editor/send`)
- Event mail sends (`/api/newsletter-editor/send-event`)

### SES API Call (no SDK needed — just fetch)

SES has a REST API. On Cloudflare Workers, use the `@aws-sdk/client-sesv2` package
or sign requests manually with AWS SigV4.

```bash
# Install in admin-api
cd apps/admin-api
npm install @aws-sdk/client-sesv2
```

### Environment Variables to Add

```
AWS_ACCESS_KEY_ID=<from IAM>
AWS_SECRET_ACCESS_KEY=<from IAM>
AWS_SES_REGION=ap-south-1
```

### IAM User Setup

1. AWS Console → IAM → Users → Create user
2. Attach policy: `AmazonSESFullAccess` (or create custom with just send permissions)
3. Generate access keys → save the Access Key ID and Secret Access Key
4. Add to Cloudflare Worker secrets:
   ```bash
   cd apps/admin-api
   npx wrangler secret put AWS_ACCESS_KEY_ID
   npx wrangler secret put AWS_SECRET_ACCESS_KEY
   ```

## Verification Checklist

- [ ] SES domain verified (DNS records added, status shows Verified)
- [ ] Production access approved
- [ ] IAM user created with SES send permissions
- [ ] AWS credentials added to Cloudflare Worker secrets
- [ ] `@aws-sdk/client-sesv2` installed in admin-api
- [ ] Backend bulk send endpoints updated to use SES
- [ ] Resend kept for transactional emails
- [ ] Test send to verify delivery
