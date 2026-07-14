# 🚀 180 Degrees Consulting VIT Chennai — Monorepo

This repository contains the complete codebase for the **180 Degrees Consulting VIT Chennai** platform. It is structured as a Turborepo and consists of multiple Cloudflare Worker applications and shared packages.

## 📦 Tech Stack

- **Turborepo** – Monorepo management
- **pnpm** – Package manager
- **Cloudflare Workers** – Backend services
- **TypeScript**
- **Vite** – Frontend
- **Hono** – Worker framework

---

# 📁 Repository Structure

```text
.
├── apps/
│   ├── frontend/         # Frontend application
│   ├── admin-api/        # Admin API Worker
│   ├── public-api/       # Public API Worker
│   └── job-processor/    # Background jobs
│
├── packages/
│   ├── shared/           # Shared utilities & types
│   ├── ui/               # Shared UI components
│   └── ...
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

# 📋 Prerequisites

Ensure the following tools are installed before getting started:

- Node.js **18+**
- pnpm
- Git
- Wrangler CLI

Install Wrangler globally:

```bash
npm install -g wrangler
```

Verify installations:

```bash
node -v
pnpm -v
wrangler --version
```

---

# ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/180DC-VIT-CHENNAI/180dc-admin-website.git
```

Move into the project:

```bash
cd 180dc-admin-website
```

Install dependencies:

```bash
pnpm install
```

---

# 🏗️ Build the Monorepo

Build every application and package:

```bash
pnpm turbo run build
```

Or using npx:

```bash
npx turbo run build
```

---

# 💻 Development

Start an individual Cloudflare Worker.

## Public API

```bash
cd apps/public-api
pnpm wrangler dev
```

## Admin API

```bash
cd apps/admin-api
pnpm wrangler dev
```

## Job Processor

```bash
cd apps/job-processor
pnpm wrangler dev
```

## Frontend

```bash
cd apps/frontend
pnpm dev
```

---

# 🚀 Deployment

Authenticate with Cloudflare:

```bash
wrangler login
```

Deploy an application:

```bash
pnpm wrangler deploy
```

Or deploy from an individual app directory:

```bash
cd apps/admin-api
pnpm wrangler deploy
```

Refer to each application's `BUILD_AND_DEPLOY.md` for service-specific deployment instructions.

---

# 📜 Available Commands

| Command | Description |
|----------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm turbo run build` | Build all apps and packages |
| `pnpm turbo run lint` | Run lint checks |
| `pnpm turbo run test` | Run tests |
| `pnpm turbo run dev` | Run development tasks |
| `pnpm wrangler dev` | Start a Worker locally |
| `pnpm wrangler deploy` | Deploy a Worker |

---

# 🌐 Environment Variables

Each Worker may require its own environment configuration.

For local development, create a `.dev.vars` file inside the corresponding application.

Example:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
```

For production, store secrets securely using Wrangler:

```bash
wrangler secret put OPENROUTER_API_KEY
```

---

# 📚 Documentation

Additional documentation is available inside each application:

- `apps/frontend/`
- `apps/admin-api/`
- `apps/public-api/`
- `apps/job-processor/`

Each app contains its own `BUILD_AND_DEPLOY.md` with detailed setup and deployment instructions.

---

# 🤝 Contributing

1. Create a feature branch.

```bash
git checkout -b feature/my-feature
```

2. Commit your changes.

```bash
git commit -m "feat: add new feature"
```

3. Push your branch.

```bash
git push origin feature/my-feature
```

4. Open a Pull Request.

---

# 📄 License

This repository is maintained by **180 Degrees Consulting VIT Chennai**.

For licensing information, please refer to the project's LICENSE file.
