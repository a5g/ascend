# StockPortal — Phase 6 — Alerts & Notifications ✅

## 6.1 Notification Service (Fastify + Workers)
- [x] RabbitMQ DLX setup: stockportal.dlx exchange, notification.failed dead-letter queue, 24h TTL on channel queues
- [x] alert-evaluator worker: 60s interval, Redis SET NX EX distributed lock, batch Zerodha quote fetch via any admin token
- [x] shouldTrigger(): PRICE_ABOVE / PRICE_BELOW / PERCENT_CHANGE / ORDER_STATUS evaluation
- [x] On trigger: mark is_active=false, triggered_at=now, publish per channel to RabbitMQ
- [x] notification-sender consumer: prefetch 5, manual retry (x-retry-count header, exponential backoff), nack to DLX after 3 failures
- [x] in-app channel: persist Notification row + HTTP call to /internal/notification-push → Socket.io emit notification:new
- [x] email channel: SendGrid HTML email with alert details; skips gracefully if SENDGRID_API_KEY absent
- [x] sms channel: Twilio SMS; skips gracefully if Twilio env vars absent

## 6.2 Alerts API
- [x] POST /api/alerts — create (50 active alert limit per user), symbol uppercase normalisation
- [x] GET /api/alerts — list user's alerts with optional ?active= filter
- [x] PUT /api/alerts/:id — update threshold/channels/is_active; re-arming clears triggered_at
- [x] DELETE /api/alerts/:id — hard delete with ownership check
- [x] GET /api/notifications — in-app history (paginated)
- [x] PUT /api/notifications/:id/read — mark single read
- [x] PUT /api/notifications/read-all — bulk mark read
- [x] GET /api/notifications/unread-count — for bell badge

## 6.3 Dashboard Service extensions
- [x] emitNotification() added to websocket/server.ts
- [x] POST /internal/notification-push — secret-header protected; notification-service calls this

## 6.4 Alerts MFE (apps/mfe-alerts/, port 4004)
- [x] Module Federation exposes ./Alerts and ./NotificationBell
- [x] AlertForm: symbol, condition selector with hint, threshold, reference price (PERCENT_CHANGE only), channel checkboxes
- [x] AlertsTable: active tab + history tab with Re-arm button, inline delete confirmation
- [x] NotificationBell: unread badge count, dropdown drawer, click-to-read, mark-all-read, Socket.io notification:new subscription
- [x] Shell Layout updated: top bar with NotificationBell loaded via React.lazy
- [x] Shell /alerts route loads mfe_alerts/Alerts

✅ Phase 6 Milestone: Traders can create price alerts and receive notifications via in-app (WebSocket bell), email (SendGrid), and SMS (Twilio). Evaluation worker prevents duplicate fires with Redis lock.
