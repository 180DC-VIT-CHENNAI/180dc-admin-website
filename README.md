# Monorepo Build Guide

This monorepo uses Turborepo for managing builds and Cloudflare Workers for deployment.

## Prerequisites
- Node.js (v18+ recommended)
- pnpm (preferred)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

npm install
## Install dependencies
```
pnpm install
```

npx turbo run build
## Build all packages and apps
```
pnpm turbo run build
```

## Develop individual workers
```
cd apps/public-api
pnpm wrangler dev
```

Repeat for `admin-api` and `job-processor`.

## Deploy
Configure your Cloudflare credentials and run:
```
pnpm wrangler deploy
```

See each app's BUILD_AND_DEPLOY.md for more details.
