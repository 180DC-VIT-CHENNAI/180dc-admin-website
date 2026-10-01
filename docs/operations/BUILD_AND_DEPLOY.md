# Monorepo Build & Deployment Guide

This document explains how to build, develop, and deploy the 180DC AdminWebsite Cloudflare Workers monorepo.

## Prerequisites
- Node.js (v18+ recommended)
- pnpm (preferred)
- Wrangler CLI (for Cloudflare Workers)

## Steps

### 1. Install dependencies
```
pnpm install
```

### 2. Build all apps and packages
```
pnpm turbo run build
```

### 3. Develop a Worker locally
```
cd apps/public-api  # or apps/admin-api, apps/job-processor
pnpm wrangler dev
```

### 4. Deploy to Cloudflare
```
pnpm wrangler deploy
```

---

- Each app and package has its own folder.
- See the respective worker guides for more details.
