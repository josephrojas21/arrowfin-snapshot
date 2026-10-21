# ArrowFin Trader Daily Snapshot

## Background

Implementation time: pending candidate confirmation of total time spent, including review; record it before submission.

LLM disclosure: OpenAI Codex was used to plan the feature, implement backend and frontend in parallel, write tests and documentation, and review integration. The candidate must review and understand the submitted code. Personal reflections below remain pending candidate input.

Self-assessment (1 never used, 2 tutorials, 3 shipped code, 4 comfortable in production, 5 could teach):

- TypeScript: 4/5
- Next.js: 5/5
- NestJS: 4/5
- Prisma: 4/5
- PostgreSQL: 4/5
- WebSockets: 4/5
- Tailwind: 5/5
- JWT/auth: 4/5
- React: 5/5
- Multi-tenant data isolation: pending candidate rating

Candidate answers to complete before submission:

1. Strongest part of the stack: pending.
2. Steepest learning curve: pending.
3. Core strength outside this stack: pending.
4. Preferred day-to-day work: pending.
5. Work to avoid: pending.
6. What I would change if I had written this without an LLM: pending personal review.

## Run locally

Prerequisites: Node.js 22.12+ and Docker. Use npm and the committed lockfile. Place the supplied assessment CSV files in `dataset/` at the repository root; that directory is intentionally excluded from Git because it includes sensitive-looking support notes and identity data. The loader persists only the fields needed for this feature.

```sh
npm ci
npm run setup:env
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. Choose a demo trader and enter their workspace. API: http://127.0.0.1:4000. PostgreSQL is bound to loopback on port 55439. `setup:env` generates random local credentials without printing them and preserves an existing `.env`. The database persists in a Docker volume. Booting the app never reseeds or resets data.

Demo identity selection is intentionally not production authentication. Both development tools and a non-production environment are required. Production mode uses restricted reviewer credentials stored as scrypt hashes; see `deploy/README.md`. A real product still needs a trusted identity provider, MFA, recovery and revocation.

## Scope and architecture

Next.js App Router, Tailwind and TanStack Query render the widget. NestJS exposes the API and Socket.IO; Prisma persists data in PostgreSQL. Hexagonal architecture applies only to the backend: domain calculations depend on no framework, ORM or provider; application use cases depend on ports and domain; adapters implement persistence and transport; composition wires them together. Decimal.js supplies decimal arithmetic, not infrastructure.

The authenticated endpoint `GET /api/me/snapshot` derives both broker and trader from the verified token. It returns separate accounts, positions, session realized P&L net of commissions, unrealized P&L and risk. Shared TypeScript DTOs live in `packages/contracts`. Sensitive fields are explicitly selected; raw ORM objects are not returned as the snapshot.

Patterns: ports/adapters, repository, constructor dependency injection and event publication after persistence. The calculation policy is a pure function using weighted average cost, with no unnecessary strategy class hierarchy. Factories in composition construct infrastructure. RxJS is a Nest dependency, not the core event model.

## Dataset and calculation decisions

- Demo time is `2026-08-25T14:30:00Z` via `SNAPSHOT_NOW`, independent of the computer's current date.
- The snapshot session begins 17:00 America/Chicago and ends 16:00 the following day. At the supplied cut this is August 24 22:00 UTC through August 25 21:00 UTC. UTC timestamps remain UTC in storage. This simplified boundary model does not implement an exchange holiday/weekend calendar.
- Reconstruct positions from all available fills through the cut. A position carried into the latest session retains its cost basis. Fills are sorted deterministically; each fill is an execution, not an entire order.
- Weighted average cost handles partial closes, shorts and reversals. Realized P&L counts closes in the current session. The supplied commission is interpreted as per contract per side and multiplied by fill quantity, following the dataset README.
- Unrealized P&L uses the supplied current mark versus the remaining cost basis. It is open-position unrealized P&L, not a true session-only change: prior settlement marks are absent. Do not present the sum as exchange-grade daily variation margin.
- Risk is `min(100, grossPositionNotional / accountBalance * 100)`, where gross notional sums absolute quantity × mark × contract point value. Opposite exposures do not cancel. Zero/negative balance gives an unavailable score with an explanation. This simple assessment score is not a margin model.
- Closed/restricted accounts can be viewed but cannot receive simulated fills. No-trade accounts return zero P&L and no positions. Money travels as decimal strings; quantities and the bounded score are numeric.
- Account `(brokerId, traderId)` and fill `(accountId, filledAt)` indexes support scoped history queries. The composite trader/broker foreign key prevents a persisted account from claiming a mismatched broker.

## Live updates and reconnect

REST authenticates with an in-memory bearer token; Socket.IO authenticates in handshake middleware using that token. The server selects the broker/trader room. There is no client-selected subscription API. `snapshot.updated` contains only an opaque version; clients refetch the authorized snapshot. After reconnect the client refetches the complete authoritative snapshot and displays a synchronizing/stale state until successful. Disconnects visibly mark existing figures as potentially stale. Signing out clears the query cache and closes the socket.

The version is a change hint, not a durable event offset. This implementation uses an in-process event publisher. A server crash after committing a fill but before publication can lose that notification. Reconnection/full refresh repairs the view, but a continuously connected client can remain stale until manual refresh or window-focus refetch. Production should use a transactional outbox, durable replay cursor and a consistency resync. No automatic POST retry or idempotency contract is implemented for the development simulator.

To simulate a fill, obtain a token via `POST /api/dev/login` with a dataset trader ID, then send authenticated `POST /api/dev/fills` with `account_id`, `instrument_symbol`, `side`, `quantity`, `price`, and `commission_usd`. Choose an active account belonging to that trader. Never paste tokens into committed scripts or documentation. The event is emitted only after the database transaction completes.

## Validation and delivery

```sh
npm run verify
npm run test:e2e
```

Local validation on October 21, 2026: `npm run verify` passed (28 unit/regression tests, both typechecks and production builds); `npm run test:e2e` passed (6 browser/API/database tests); the seed ran successfully twice; npm reported 0 vulnerabilities after dependency updates. CI is configured but has not been run on GitHub.

The E2E suite creates isolated synthetic identities and removes only its own records. It works on a fresh migrated database without copying sensitive input CSVs into CI.

See `SECURITY.md` for trust boundaries and production gaps, and `CODE_REVIEW.md` for the assessment PR review. The submission is a GitHub repository (public or private); deployment is not required by the brief. For a private repository, the brief requests access for julian@arrowfin.io, followed by sending the repository link. Sharing and sending are separate final user actions.

Deployment uses credential sign-in, provisioned secrets, exact trusted origins and a NestJS WebSocket backend on infrastructure that supports persistent connections. Docker images for both services have been built and the API tested in production mode. A Next.js deployment alone does not constitute a working full-stack demo.

## Architecture and handoff reflection

Draft for candidate review: The main decision is keeping tenant context explicit at the application boundary and isolating calculation logic from infrastructure. This costs extra interfaces and mapping code, but makes the financial rules testable without a database and the ownership checks visible during review.

Draft for candidate review: With a second day, add PostgreSQL row-level security using a restricted application role and transaction-local tenant context, then add an outbox/replay protocol. These address the two largest remaining failure modes: an accidentally unscoped query and a lost live notification.

Draft for candidate review: Tell the next two engineers that `brokerId` alone is insufficient: every trader-facing operation also needs trader/account ownership. Preserve domain dependency direction, the UTC storage convention, complete-history reconstruction, decimal arithmetic and the public DTO contract. Assign backend persistence/event work separately from frontend rendering, and require cross-tenant regression tests for changes to either auth or repository behavior.

## Deployment status

Railway sign-in succeeded on October 21, 2026, but project creation returned `Deploys have been paused temporarily`. The official status page confirmed an active platform incident. No ArrowFin cloud project, secrets or dataset were uploaded. Deployment remains pending provider recovery or an alternative destination. See `deploy/README.md`.
