# Job Processor Worker: Build & Deploy

This document describes how to build, develop, and deploy the Job Processor Cloudflare Worker.

## Build
```
pnpm wrangler build
```

## Develop Locally
```
pnpm wrangler dev
```

## Deploy
```
pnpm wrangler deploy
```

## Cloudflare Bindings
- D1 (DB)
- R2 (R2)
- KV (KV)
- Queue Consumer (jobs-queue)

Bindings are configured in wrangler.toml.
