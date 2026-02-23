# Admin API Worker: Build & Deploy

This document describes how to build, develop, and deploy the Admin API Cloudflare Worker.

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
- Queue (QUEUE)

Bindings are configured in wrangler.toml.
