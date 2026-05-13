# StockPortal — Phase 8 — Security Hardening & Observability ✅

## 8.1 Security Hardening

- [x] AES-256-GCM encryption for all Zerodha tokens and PII (packages/crypto — IV+AuthTag+Ciphertext)
- [x] validateEncryptionKey() + validateJwtSecret() on every service start; throws in production for placeholder values
- [x] JSON Schema validation on all POST/PUT request bodies (audit documented in security-checklist.md)
- [x] All DB queries via Sequelize ORM — zero raw SQL with user input
- [x] @fastify/helmet on all 8 services; strict CSP on api-gateway (script-src 'self', frame-src 'none')
- [x] HSTS max-age=31536000 + includeSubDomains on api-gateway
- [x] @fastify/csrf-protection on auth-service
- [x] SameSite=Strict; HttpOnly; Secure (in production) on refreshToken cookie
- [x] Pino redact list: password_hash, zerodha_access_token, authorization header, ENCRYPTION_KEY, PAN, phone
- [x] OWASP DAST: ZAP baseline command documented in security-checklist.md

## 8.2 packages/observability (new shared package)

- [x] createLogger(): pino with 15 redact paths, ISO timestamps, pino-pretty in dev
- [x] initTracing(): OpenTelemetry NodeSDK with Jaeger exporter, auto-instruments HTTP/pg/redis/amqplib
- [x] Prometheus metrics: httpRequestsTotal, httpRequestDuration, zerodhaCallsTotal, zerodhaCircuitBreakerState, zerodhaLatency, queueMessagesPublished/Consumed, activeWebSocketConnections, loginAttemptsTotal, tokenRefreshTotal
- [x] fastifyObservability plugin: request_id (UUID), user_id log child injection, /metrics endpoint, x-request-id response header
- [x] bootstrapService(): security checks + tracing init before Fastify load

## 8.3 Service integration

- [x] All 8 services: observability-setup.ts import added as first line
- [x] All 8 services: fastifyObservability plugin registered
- [x] All 8 services: structured pino logger with service name + redaction
- [x] api-gateway: full CSP/HSTS helmet config, x-request-id propagation

## 8.4 Infrastructure configs (infra/)

- [x] docker-compose.monitoring.yml: Prometheus, Grafana, Jaeger, Elasticsearch, Logstash, Kibana
- [x] infra/logstash/pipeline.conf: TCP + Beats input, pino JSON parse, sensitive pattern drop, daily ES index
- [x] infra/prometheus/prometheus.yml: scrapes all 8 services + postgres/redis/rabbitmq exporters
- [x] infra/prometheus/rules/stockportal.rules.yml: ServiceDown, HighErrorRate, ZerodhaCircuitBreakerOpen, ZerodhaTokenExceptionSurge, P99Latency, PostgresConnectionPool, NotificationQueueBacklog, DeadLetterQueueGrowing
- [x] infra/prometheus/alertmanager.yml: PagerDuty (critical), Slack (warning), inhibit rules
- [x] infra/grafana/dashboards/stockportal-services.json: Request Rate, Error Rate, P99 Latency, Zerodha latency, Circuit Breaker, WebSocket connections, RabbitMQ throughput
- [x] infra/grafana/dashboards/zerodha-integration.json: API calls by status, TokenException rate, cache hit rate

## 8.5 K8s monitoring manifests (k8s/monitoring/)

- [x] prometheus-servicemonitor.yaml: ServiceMonitor for production + staging namespaces
- [x] jaeger.yaml: Deployment + Service + PVC (badger storage, 10Gi)
- [x] grafana-dashboard-configmap.yaml: ConfigMap with grafana_dashboard label for sidecar pickup
- [x] prometheus-rules-configmap.yaml: PrometheusRule CRD for Prometheus Operator

✅ Phase 8 Milestone: Platform passes security review. All services emit structured logs with redaction, traces to Jaeger, and metrics to Prometheus. Grafana dashboards are provisioned. PagerDuty fires on P0 conditions.
