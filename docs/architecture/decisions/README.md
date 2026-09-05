# Architecture Decisions

This directory records decisions that future agents should understand before changing the system.

## Existing decision records

| ADR | Document | Status | Summary |
|-----|----------|--------|---------|
| ADR-001 | `architecture/backend-architecture-cloudflare.txt` | HISTORICAL/ASPIRATIONAL | Early design proposing Cloudflare Access, Next.js/Astro, separate public API with KV caching, Zod validation, and presigned R2 uploads. This was not implemented. |
| ADR-002 | `architecture/NEWSLETTER_BULK_SEND_DECISION.md` | DECIDED, NOT YET IMPLEMENTED | Choose Amazon SES for bulk newsletter sends, keep Resend for transactional. Subscribers remain in the same D1 database. |
| ADR-003 | `architecture/TEAM_INSTANCES_PLAN.md` | IMPLEMENTED | Team instances feature for events/case competitions with teams, member limits, and minimums. Implemented in `apps/admin-api/index.ts` and `TeamInstancesSection.tsx`. |

## How to add a new ADR

Create a new file under `docs/architecture/decisions/` named `NNN-short-title.md` with:

- Title
- Status: proposed / decided / deprecated / superseded
- Context: what problem or question the decision addresses
- Decision: the chosen approach
- Alternatives considered
- Consequences: positive, negative, and risks
- Compatibility impact
- Migration impact
- Conditions for reconsideration

Link the new ADR in this README and update `docs/INDEX.md` if it changes the architecture router.

## Important note on ADR-001

`architecture/backend-architecture-cloudflare.txt` predates the current implementation. It describes a more complex architecture than what is deployed. Do not use it as the current source of truth. The actual implementation is documented in:

- `docs/architecture/system-architecture.md`
- `docs/execution/current-state.md`
- `apps/admin-api/index.ts`
- `apps/frontend/functions/_middleware.ts`

Agents should read ADR-001 only to understand early intent and what was deliberately not built.
