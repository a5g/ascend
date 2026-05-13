# StockPortal — Phased Development Roadmap

> Generated from `claude.md` — Platform Overview, User Flow, and Architecture sections.
> Each phase builds on the previous and produces a deployable, testable increment.

---

## Phase 3 — Zerodha Integration & Dashboard

> **Goal:** Traders can view their live holdings, positions, and P&L via the Zerodha Kite Connect API. Data is cached appropriately and updates in real time.

### 3.1 Zerodha OAuth Connection (Auth Service extension)

- [x] Implement `POST /auth/zerodha/connect` — generate Zerodha OAuth login URL
- [x] Implement `GET /auth/zerodha/callback` — exchange token via `kite.generateSession()`, encrypt with AES-256-GCM, store in `users.zerodha_access_token`
- [x] `getZerodhaClient(userId)` — decrypts token, instantiates KiteConnect (`packages/zerodha/src/client.ts`)
- [x] `ZerodhaTokenExpiredError` raised when token missing/corrupt; maps to 401 with `reconnect_url`
- [x] `GET /api/auth/zerodha/status` and `DELETE /api/auth/zerodha/disconnect` endpoints
- [ ] Store encryption key in AWS KMS / HashiCorp Vault (deferred to Phase 8 — currently uses `ENCRYPTION_KEY` env var)

### 3.2 Dashboard Service (Fastify)

- [x] `GET /api/dashboard/holdings` — fetches from Zerodha via `opossum` circuit breaker, cached 5 min in Redis (30-min stale fallback)
- [x] `GET /api/dashboard/positions` — always live from Zerodha
- [x] `GET /api/dashboard/pnl` — computed server-side via `computePnl()` from holdings + positions
- [x] `GET /api/dashboard/trades` — paginated from `orders` table with date/symbol filters
- [x] Circuit breaker (`opossum`) on all Zerodha calls; returns stale cached data when tripped
- [x] Zerodha error codes mapped to client-facing responses (`TokenException` → 401, `NetworkException` → 503 etc.)
- [x] 3 req/sec rate limiter via `p-queue` (`withHoldingsRateLimit`) in `packages/zerodha`

### 3.3 Real-time WebSocket Server

- [x] Socket.io server attached to dashboard-service HTTP server at `/ws`
- [x] JWT authentication middleware on `socket.handshake.auth.token`
- [x] On connect, user joins room `user:{userId}`
- [x] `order:update` event emitter exported (`emitOrderUpdate`) for Order Service to call in Phase 4
- [x] `positions:update` event on client `positions:refresh` request
- [x] `emitPositionsUpdate` exported for future ticker integration

### 3.4 Dashboard MFE (`apps/mfe-dashboard/`)

- [x] `mfe-dashboard` scaffolded with Webpack Module Federation (exposes `./Dashboard`)
- [x] Holdings table (symbol, qty, avg price, LTP, current value, P&L, day change %)
- [x] Positions table (net + day view toggle)
- [x] P&L summary cards (today P&L, overall P&L, invested, current value)
- [x] Trade history table with pagination
- [x] Recharts `BarChart` for per-stock P&L visualisation
- [x] `useWebSocket` hook subscribes to Socket.io; live position updates push to table
- [x] `StaleBanner` displayed when `stale: true` from API or circuit breaker trips
- [x] `ZerodhaConnect` component redirects to Zerodha OAuth when token missing/expired
- [x] Shell Dashboard page loads MFE via `React.lazy` + Suspense; shows Zerodha toast on callback

**✅ Phase 3 Milestone:** A logged-in trader can view live holdings, positions, and P&L. Data refreshes in real time via WebSocket. Stale data is surfaced gracefully when Zerodha is down.

---
