# Monorepo Build Guide

This monorepo uses Turborepo for managing builds and Cloudflare Workers for deployment.

## Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## Install dependencies
```
npm install
```

## Build all packages and apps
```
npx turbo run build
```

## Develop individual workers
```
cd apps/public-api
wrangler dev
```

Repeat for `admin-api` and `job-processor`.

## Deploy
Configure your Cloudflare credentials and run:
```
wrangler deploy
```

See each app's README for more details.
