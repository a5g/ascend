# StockPortal — Phase 9 — Testing & QA ✅

## 9.1 Unit Tests (Jest)

- [x] Fixed Risk engine: quantity calculation, floor behaviour, zero stop-loss distance throws, invalid inputs throw
- [x] Fixed Fractional engine: correct quantity, fraction as %, edge cases, validation errors
- [x] Kelly Criterion: positive kelly, negative kelly clamped to 0, >100% clamped, half-kelly suggestion, all validation errors
- [x] Fixed Units engine: exact quantity, portfolio %, integer validation
- [x] Alert shouldTrigger: all 4 conditions (PRICE_ABOVE, PRICE_BELOW, PERCENT_CHANGE, ORDER_STATUS), boundary values, null reference_price
- [x] Permission checking: all 4 roles vs all permissions, multi-permission missing list
- [x] Zerodha error mapping: all 6 exception types, token expiry by message, unknown error, non-Error objects
- [x] Market hours: weekday open/closed boundaries, Saturday, Sunday, exact open/close times

## 9.2 Integration Tests (Fastify inject())

- [x] Auth Service: valid login (200 + cookie), wrong password (401), inactive user (401), schema validation (400), logout (200)
- [x] Order Service: GET orders (200), POST order during market hours (201), POST market closed (403), invalid exchange (400), cancel own order (204), cancel completed order (422), cancel others' order (403), Zerodha postback (200), unknown order postback (200 silent)
- [x] Dashboard Service: GET holdings (200 + cached flag), stale:true when circuit trips, GET trades paginated (200), unauthorised (401)
- [x] User Service: admin lists users (200), trader blocked (403), create user (201), duplicate email (409), invalid role (400), deactivate (204), not-found (404)

## 9.3 E2E Tests (Playwright)

- [x] playwright.config.ts: chromium, 30s timeout, retries in CI, HTML + JUnit reporters, global-setup
- [x] global-setup.ts: verifies admin login before all tests
- [x] auth/login.spec.ts: page renders, valid login → dashboard redirect, wrong password error, logout clears session
- [x] dashboard/holdings.spec.ts: tabs render, Zerodha connect prompt, stale banner via route interception, P&L cards
- [x] orders/place-order.spec.ts: order book renders, market closed banner (API mock), status badge presence
- [x] admin/user-management.spec.ts: user management page, onboarding form, super_admin panel access
- [x] alerts/create-alert.spec.ts: alerts page, form open, create via mock, notification bell, position sizing disclaimer

## 9.4 Load Tests (k6)

- [x] order-placement.js: 100 concurrent traders, 4-stage ramp, duplicate order ID check, p95<2s threshold, >95% success rate
- [x] websocket-connections.js: 500 concurrent WS connections, 2-min hold, positions:refresh emission, >95% connect rate
- [x] alert-evaluation.js: seed 1000 alerts (10 VUs × 100 iter), monitor eval cycle timing (p95<55s), teardown cleanup

## Shared infrastructure

- [x] jest.config.js at monorepo root with moduleNameMapper for all workspace packages
- [x] packages/test-utils: signTestToken, TEST_TOKENS, makeUser/Order/Alert/PermissionGroup, mockModel, mockRedis, mockAmqpChannel, mockKiteConnect
- [x] Root package.json updated: jest, ts-jest, @types/jest devDeps + test/test:unit/test:watch scripts

✅ Phase 9 Milestone: 50+ unit/integration test cases written. 5 Playwright critical-path specs. 3 k6 load scripts with thresholds covering order placement, WebSocket scale, and alert evaluation timing.
