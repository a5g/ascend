# StockPortal — Phased Development Roadmap

> Generated from `claude.md` — Platform Overview, User Flow, and Architecture sections.
> Each phase builds on the previous and produces a deployable, testable increment.

---

## Phase 5 — Position Sizing Tool

> **Goal:** Traders can calculate optimal position sizes using multiple strategies and save configurations for reuse.

### 5.1 Position Sizing Service (Fastify)

- [ ] Scaffold Position Sizing Service as an independent Fastify app
- [ ] Implement `POST /api/position-sizing/calculate` — accept strategy + parameters, run selected algorithm, return results
- [ ] Implement Fixed Risk algorithm: `(accountSize × riskPercent%) / |entryPrice − stopLossPrice|`
- [ ] Implement Fixed Fractional algorithm: `(accountSize × fraction) / entryPrice`
- [ ] Implement Kelly Criterion algorithm: `winRate − ((1 − winRate) / (avgWin / avgLoss))`
- [ ] Validate all inputs with JSON Schema (reject negative values, zero stop-loss distance, etc.)
- [ ] Implement `GET /api/position-sizing/configs` — list user's saved configs
- [ ] Implement `POST /api/position-sizing/configs` — save a named config
- [ ] Implement `DELETE /api/position-sizing/configs/:id` — delete a saved config
- [ ] Apply `positions:read` permission guard

### 5.2 Position Sizing MFE (Frontend)

- [ ] Scaffold `mfe-position-sizing` with Webpack Module Federation
- [ ] Build strategy selector (Fixed Risk / Fixed Fractional / Kelly Criterion / Fixed Units)
- [ ] Build dynamic input form that changes fields based on selected strategy
- [ ] Display calculation output: quantity, position value, risk amount, risk per share
- [ ] Add prominent advisory disclaimer: "For informational purposes only — not investment advice"
- [ ] Require explicit user confirmation before pre-filling the order form with sizing results
- [ ] Build saved configs panel: save, load, and delete named configurations
- [ ] Enforce `positions:read` permission guard via `usePermissions`

**✅ Phase 5 Milestone:** Traders can calculate position sizes across all supported strategies, save configurations, and (with confirmation) use results to pre-fill the order form.

---
