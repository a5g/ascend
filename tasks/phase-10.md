# StockPortal — Phased Development Roadmap

> Generated from `claude.md` — Platform Overview, User Flow, and Architecture sections.
> Each phase builds on the previous and produces a deployable, testable increment.

---

## Phase 10 — Production Launch & Hardening

> **Goal:** Controlled production go-live with monitoring active, rollback plan in place, and post-launch stabilisation.

### 10.1 Pre-Launch Checklist

- [ ] All Phase 1–9 milestones signed off
- [ ] Production K8s cluster provisioned and hardened (separate from staging)
- [ ] Production secrets loaded into KMS / Vault (not from staging)
- [ ] Production Zerodha API key and secret configured; paper trading credentials removed
- [ ] DB backup and restore procedure documented and tested (restore drill completed)
- [ ] Runbook written for: service restart, DB failover, Zerodha token expiry incident, circuit breaker open incident
- [ ] SEBI-compliant audit log retention policy configured (5-year retention, append-only enforcement verified)

### 10.2 Staged Rollout

- [ ] Deploy to production cluster using blue-green strategy
- [ ] Smoke test all critical user flows on production (login, dashboard, place order, alert creation)
- [ ] Monitor Grafana dashboards and PagerDuty for 24 hours post-deploy
- [ ] Enable trading for a limited set of users (canary release) before full rollout
- [ ] Full rollout after 48 hours of stable canary metrics

### 10.3 Post-Launch Stabilisation

- [ ] Triage and resolve any production bugs within SLA (P0: 2hrs, P1: 24hrs)
- [ ] Review Zerodha API latency and error rates after first live trading session
- [ ] Review RabbitMQ queue depths and DLQ counts; tune worker concurrency if needed
- [ ] Collect user feedback from traders and admins; log feature requests for next sprint

**✅ Phase 10 Milestone:** StockPortal is live in production. All roles are operational. Monitoring is active. Rollback procedure is tested and ready.

---

## Summary Table

| Phase | Focus                           | Key Deliverable                        |
| ----- | ------------------------------- | -------------------------------------- |
| 1     | Foundation & Infrastructure     | Monorepo, CI/CD, DB, Docker/K8s        |
| 2     | Auth & User Management          | Login, RBAC, JWT, user CRUD            |
| 3     | Zerodha Integration & Dashboard | Live holdings, P&L, WebSocket          |
| 4     | Order Management                | Place/modify/cancel orders, postback   |
| 5     | Position Sizing Tool            | Calculation engine + saved configs     |
| 6     | Alerts & Notifications          | Price alerts, email/SMS/in-app         |
| 7     | Admin & Super Admin MFEs        | Governance + user management UIs       |
| 8     | Security & Observability        | Hardening, logs, metrics, tracing      |
| 9     | Testing & QA                    | Unit, integration, E2E, load tests     |
| 10    | Production Launch               | Go-live, canary rollout, stabilisation |
