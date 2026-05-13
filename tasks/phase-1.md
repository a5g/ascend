
## Phase 1 — Foundation & Infrastructure

> **Goal:** Establish the project skeleton, CI/CD pipeline, and core infrastructure so all future services have a consistent base to build on.

### 1.1 Monorepo & Project Setup

- [x] Initialise monorepo structure (`pnpm workspaces`) with separate packages for each service and MFE
- [x] Define shared `eslint`, `prettier`, and `tsconfig` at the root level
- [x] Add `.env` conventions and secret management strategy (no secrets in source control)
- [x] Create per-service `Dockerfile` using `node:20-alpine` base image
- [x] Write `docker-compose.yml` for local dev (PostgreSQL, Redis, RabbitMQ)

### 1.2 CI/CD Pipeline

- [x] Set up GitHub Actions workflow with stages: `lint-and-test → build-docker-images → security-scan → deploy-staging → e2e-tests → deploy-production`
- [x] Configure Trivy for Docker image vulnerability scanning
- [x] Configure Semgrep for SAST on every pull request
- [x] Set up image tagging strategy using git SHA

### 1.3 Kubernetes & Deployment

- [x] Create K8s manifests for each service (deployment-blue, deployment-green, service, HPA)
- [x] Configure liveness (`GET /health`) and readiness probes for every service
- [x] Set up staging namespace and production namespace separation
- [x] Configure blue-green deployment strategy for production releases
- [x] Set up Kubernetes HPA (Horizontal Pod Autoscaler) config per service

### 1.4 Database Bootstrapping

- [x] Provision PostgreSQL instance (via docker-compose + K8s secret)
- [x] Install and configure Sequelize CLI for migration management
- [x] Create initial migrations: `users`, `orders`, `alerts`, `notifications`, `position_sizing_configs`, `audit_logs` tables
- [x] Apply all indexes defined in the spec (`idx_orders_user_status`, `idx_alerts_active`, etc.)
- [x] Seed script for initial `super_admin` user

### 1.5 Shared Infrastructure Services

- [x] Provision and connect Redis instance (via docker-compose + K8s config)
- [x] Provision and connect RabbitMQ for async messaging (via docker-compose + K8s config)
- [ ] Configure TLS termination at load balancer (TLS 1.3) — requires cert-manager + domain in cluster
- [ ] Set up internal service mTLS certificates — requires Istio/Linkerd in Phase 8 (Observability)

**✅ Phase 1 Milestone:** Local dev environment runs end-to-end with Docker Compose; CI pipeline passes on a skeleton commit; K8s staging cluster is accessible.

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
