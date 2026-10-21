# ArrowFin frontend

Next.js App Router, React, Tailwind CSS v4, TanStack Query and Socket.IO. Feature modules live in `src/features/snapshot`; hexagonal architecture applies to the backend only.

Run from the repository root with `npm run dev --workspace @arrowfin/web`. The browser connects directly to `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:4000`). The API must allow the exact frontend origin. `NEXT_PUBLIC_API_URL` is a public build-time setting and must never contain credentials.

## Flow

1. `/api/auth/config` selects the sign-in flow. Missing, failed or unknown configuration blocks sign-in instead of assuming development access. In `demo` mode, the selector requests `/api/dev/traders` and sends the selected `traderId` to `/api/dev/login`. In `credentials` mode, trader ID and password are sent to `/api/auth/login`; the password is cleared after every attempt and never persisted. Development endpoints must remain disabled outside the explicit demo environment.
2. The resulting access token stays in React memory. Refreshing the page requires sign-in again; no token is persisted to browser storage.
3. `/api/me/snapshot` is fetched with a bearer token. Query keys include broker and trader IDs; changing identity clears the query cache and unmounts/disconnects the previous socket.
4. Socket.IO authenticates with `auth.token`. `snapshot.updated` invalidates the authoritative REST snapshot; it never directly overwrites account data from an event payload.
5. Connection loss visibly marks values stale. Reconnection keeps the stale state until the REST refresh completes. Request failures preserve a stale warning. HTTP 401/403, a server-initiated socket disconnect (including token expiry), or a terminal handshake rejection hide the account view and offer return to sign-in. Only recoverable transport interruptions promise automatic reconnection.

## Development fill simulator

In `demo` authentication mode, the selected active account exposes an expandable **Simulate a fill** form. Instrument, BUY/SELL side, integer quantity, execution price and per-contract commission are editable. Submission sends an authenticated `POST /api/dev/fills` with snake_case fields and the selected account ID. The UI explicitly distinguishes a simulated database execution from a market order. It reports success only after the server confirms the write and then refreshes the authoritative snapshot. Backend validation remains authoritative; account authorization is never inferred from the client selector. Inactive accounts and credential-based production sessions do not expose the simulator.

## Display conventions

All account currency values are USD. Monetary amounts display two decimals; instrument prices retain up to eight decimals to preserve futures tick precision. Formatting converts decimal strings to JavaScript numbers only for display; financial calculations remain server-side. Session labels use the explicit API timezone, independently of the browser timezone. No trader names, emails or other personal details are rendered.

Account selection, active/inactive state, empty accounts, flat positions, unavailable risk, elevated risk strictly above 75, loading, retry, expired authorization and interrupted live updates are supported. Narrow screens use a horizontally scrollable, keyboard-focusable positions table. Controls have visible focus styling, labels, semantic table headers, status announcements and reduced-motion support.

## Checks

- `npm run typecheck --workspace @arrowfin/web`
- `npm run build --workspace @arrowfin/web`
- Root Playwright suite owns integration checks against the real API and seeded database.
