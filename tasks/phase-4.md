# StockPortal — Phase 4 — Order Management ✅

## 4.1 Order Service
- [x] POST /api/orders — validate, zerodhaPlaceOrder, persist OPEN, publish order.placed, AuditLog
- [x] GET /api/orders — paginated, filterable (status, symbol, date range); admins see all
- [x] GET /api/orders/:id — ownership check
- [x] PUT /api/orders/:id — zerodhaModifyOrder, market-hours gate
- [x] DELETE /api/orders/:id — zerodhaCancelOrder, emit WebSocket immediately
- [x] POST /api/orders/zerodha-postback — SHA-256 checksum, DB update, RabbitMQ publish + emitOrderUpdate
- [x] Async status poller (2s, Redis SET NX EX distributed lock)
- [x] orders:write / orders:read role checks on all routes
- [x] Market-hours gate (403 MARKET_CLOSED outside 9:15–15:30 IST Mon-Fri)

## 4.2 Event Bus
- [x] RabbitMQ consumer in dashboard-service — order.status_updated → emitOrderUpdate → Socket.io
- [x] POST /internal/order-update in dashboard-service (secret-header protected, best-effort fallback)

## 4.3 Orders MFE (apps/mfe-orders/, port 4002)
- [x] Module Federation remote exposing ./Orders
- [x] OrderForm: symbol, exchange, BUY/SELL toggle, order type, qty, price/trigger conditional
- [x] MarketClosedBanner: IST clock re-evaluated every 30s, disables form
- [x] OrderBook: status filter tabs, Modify + Cancel actions on actionable rows
- [x] OrderModifyModal: modify qty/price/trigger for the order's type
- [x] CancelDialog: confirmation before DELETE
- [x] Toast: 5s auto-dismiss; order:update WS events → success/error/info toasts
- [x] Shell /orders route loads mfe_orders/Orders via React.lazy

✅ Phase 4 Milestone: Traders can place/modify/cancel orders during market hours. Status updates arrive in real time via WebSocket + toast notifications.
