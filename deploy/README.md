# Deploy the assessment

Deploy three services: PostgreSQL, the NestJS API (Docker target `api`), and Next.js (Docker target `web`). Keep one API replica until a shared Socket.IO adapter and durable outbox are introduced. The repository contains no original dataset or credentials. No service has been deployed yet.

## Build and runtime settings

Build from the repository root. API: `docker build --target api -t arrowfin-api .`. Web: `docker build --target web --build-arg NEXT_PUBLIC_API_URL=https://YOUR-API-HOST -t arrowfin-web .`. The API URL is public configuration, never a credential. The browser URL must use HTTPS and reach the API's WebSocket endpoint too.

API runtime environment:

- `NODE_ENV=production`
- `ENABLE_DEV_TOOLS=false`
- `DATABASE_URL`: private database connection from the chosen provider
- `JWT_SECRET`: randomly generated signing secret, minimum 32 characters
- `REVIEWER_CREDENTIALS_JSON`: hash-only credential records generated below
- `WEB_ORIGIN`: exact public frontend origin, without a trailing slash
- `SNAPSHOT_NOW=2026-08-25T14:30:00Z`
- `PORT`: provider's assigned listening port

Web runtime: provider's `PORT`. `NEXT_PUBLIC_API_URL` must be supplied at build time; changing runtime environment alone does not replace the URL compiled into browser code. No database URL or signing key belongs on the frontend.

Readiness path: `/api/ready`; liveness path: `/api/health`. The API listens on 0.0.0.0. Run migrations as a pre-deploy job using `node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma`. Do not run the seed on every restart.

## Reviewer access

Generate credentials only for known seeded trader IDs:

```sh
node scripts/create-reviewer-credentials.mjs T-001 T-005
```

The script writes passwords to `.private/reviewer-credentials.json` and the hash-only deployment environment entry to `.private/reviewer-auth.env`, both ignored by Git and Docker. It never prints passwords and refuses to replace existing credentials. Configure the hash value in the hosting provider's secret store, and share each reviewer's login privately. Do not put plaintext passwords in Git, build arguments, command history or README.

Production uses trader ID/password sign-in and derives the broker from the database. The developer identity selector and fill ingestion endpoint remain disabled. This is restricted assessment access, not a full production identity provider: no password reset, MFA or session revocation. The rate limiter is process-local, so one replica is required; use an edge/shared limiter before scaling.

## Data and acceptance

Run the seed once in a private release job with the original CSV directory temporarily mounted read-only, using `DATASET_DIR` and `node --import tsx apps/api/prisma/seed.ts`. The loader projects only operational fields. Do not bake the original CSVs or free-text notes into either image, publish them in a repository, or use public object storage as a shortcut.

Before sharing: check database readiness, credential login, account switching, high-risk rendering, rejected wrong credentials, disabled `/api/dev/*`, scoped HTTP and socket traffic, and reconnection. To demonstrate new fills in a deployed review environment, a separate authenticated ingestion mechanism is still needed; do not enable the development simulator in production. Local testing retains that simulator.

Railway was selected and login completed. Project creation on October 21, 2026 was blocked by Railway with `Deploys have been paused temporarily`; its official status page confirmed a platform outage. No ArrowFin resources or secrets were uploaded. No paid service or production data migration should be inferred from this document.

## Render fallback

The user selected Render after the Railway outage. The source is the private repository `https://github.com/josephrojas21/arrowfin-snapshot`, branch `codex/arrowfin-snapshot`. No GitHub collaborator access or submission email has been sent.

For native Node services (the Docker images remain portable and tested):

- API build: `npm ci --include=dev && npm run db:generate && npm run build -w @arrowfin/api`; start: `sh deploy/render-api-start.sh`; health: `/api/ready`.
- Web build: `npm ci --include=dev && npm run build -w @arrowfin/web`; start: `node node_modules/next/dist/bin/next start apps/web --hostname 0.0.0.0`.
- Pin Node 22.19.0, set NODE_ENV=production and set NEXT_PUBLIC_API_URL at frontend build time.
- Supply API secrets through Render's `api.env` secret file. The startup script runs non-destructive versioned migrations before listening; it never runs a seed or resets records.
- Free services can sleep after inactivity, and Free Postgres expires after 30 days. These are assessment-preview limits, not production reliability guarantees. See https://render.com/docs/free.
