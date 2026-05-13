# StockPortal — Phased Development Roadmap

> Generated from `claude.md` — Platform Overview, User Flow, and Architecture sections.
> Each phase builds on the previous and produces a deployable, testable increment.

---

## Phase 2 — Authentication & User Management

> **Goal:** All three actor types (super_admin, admin, trader) can log in, receive scoped JWTs, and have their roles enforced on every request.

### 2.1 Auth Service (Fastify)

- [x] Scaffold Auth Service as an independent Fastify app
- [x] Implement `POST /auth/login` → issue access token (1hr TTL) + refresh token (7-day TTL, httpOnly cookie)
- [x] Implement `POST /auth/refresh` with refresh token rotation (invalidate old hash in Redis, issue new)
- [x] Implement `POST /auth/logout` → delete refresh token hash from Redis, clear cookie
- [x] Store refresh tokens hashed (SHA-256) in Redis keyed by `refresh:{userId}` with 7-day SETEX
- [x] Define JWT payload structure: `sub`, `role`, `permissions`, `iat`, `exp`
- [x] Register `@fastify/jwt` plugin; implement `onRequest` hook for JWT verification
- [x] Implement `checkPermissions` / `requirePermissions` middleware (`packages/auth-service/src/plugins/permissions.ts`)
- [x] Apply `@fastify/rate-limit` — 5 req/min per IP on `/auth/login`
- [x] Apply `@fastify/helmet` and `@fastify/csrf-protection`

### 2.2 User Service (Fastify)

- [x] Scaffold User Service as an independent Fastify app
- [x] Implement `POST /api/users` — create user (admin only), hash password with bcrypt (cost 12)
- [x] Implement `GET /api/users` — paginated, filterable list (super_admin + admin)
- [x] Implement `PUT /api/users/:id` — update profile, role, or status
- [x] Implement `DELETE /api/users/:id` — soft-delete (`is_active = false`)
- [x] Implement `POST /api/users/groups` — create named permission group
- [x] Implement `GET /api/users/groups` — list permission groups
- [x] Implement `PUT /api/users/:id/groups` — assign user to permission groups
- [x] Encrypt PII fields (name, phone, pan) via `packages/crypto` `encryptProfile()` before persistence
- [x] Write `AuditLog` helper (`services/user-service/src/helpers/audit.ts`) — every create/update/delete logs to `audit_logs`

### 2.3 API Gateway

- [x] Scaffold API Gateway service (Fastify + `@fastify/http-proxy`)
- [x] Route incoming requests to correct downstream service based on path prefix
- [x] Validate JWT on every inbound request; reject with 401 if invalid or expired
- [x] Apply global rate limiting at gateway level
- [x] Forward `x-user-id`, `x-user-role`, `x-user-permissions`, `x-access-token` trusted headers to downstream services

### 2.4 Super Admin Service — User Management Features

- [x] Implement super_admin CRUD over all users and admins (`GET /api/super-admin/users`)
- [x] Implement user status toggle (`PUT /api/super-admin/users/:id/status`)
- [x] Implement global settings CRUD (`GET|PUT /api/super-admin/settings/:key`) — feature flags JSONB, maintenance mode
- [x] Implement audit log viewer (`GET /api/super-admin/audit-logs`, searchable by actor_id, action, target_type, paginated)

### 2.5 Shell App & Auth MFE (Frontend)

- [x] Bootstrap React Shell App (`apps/shell/`) with Webpack Module Federation configured
- [x] Implement login page (email + password form, dark theme, error display)
- [x] Implement JWT storage strategy — access token in memory (React state), refresh token in httpOnly cookie
- [x] Implement silent token refresh using `/auth/refresh` 55 min interval + on-mount attempt
- [x] Expose `AuthContext` and `usePermissions` hook via Module Federation `exposes`
- [x] Implement role-based route guards (`PrivateRoute`) — `requiredPermission` and `requiredRole` props
- [x] Implement logout flow (call `/auth/logout`, clear tokens, clear cookie, redirect to login)

### New shared packages added

- [x] `packages/crypto` — AES-256-GCM `encrypt`/`decrypt`, SHA-256 `sha256`, `encryptProfile`/`decryptProfile`
- [x] DB migration 007: `permission_groups`, `user_permission_groups`, `global_settings` tables

**✅ Phase 2 Milestone:** All three roles can log in and receive correctly scoped JWTs. Admins can create and manage users. Super admin can toggle user status and view audit logs. Permission guards work in the Shell.
