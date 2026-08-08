# Stage 6 verification status

Status: IN PROGRESS.

Scope: AI Adapter capability discovery, unified response validation, provider failover and safe business-write boundary.

Existing baseline:

- test-only mock providers list models and run capability probes;
- a simple router falls back when the primary provider is unavailable;
- an AJV schema rejects malformed provider responses before business writes.

Stage 6 completion gates:

1. extract reusable request, response-schema, provider-adapter and router modules from test-only code;
2. discover capabilities from provider model listing plus live probes rather than hard-coded model names;
3. cache capabilities with expiry, explicit invalidation and re-probe behavior;
4. classify authentication, quota/rate-limit, timeout, transient service, unsupported-capability and invalid-response failures;
5. apply bounded provider attempts, per-provider timeouts and circuit-breaker behavior;
6. validate response schema plus operation-level semantic rules before any business write;
7. reject unknown operation types, invalid confidence, unsafe fields and excessive output size;
8. keep AI output as a proposal/preview and require a repository/confirmation boundary for business writes;
9. retain provider attempts, selected provider/model, failure reasons, latency and token-usage audit data;
10. test all-provider failure, fallback success, invalid response isolation and duplicate-request idempotency.

Restrictions:

- do not commit provider API keys;
- do not call paid or real providers without supplied secrets and explicit permission;
- do not infer capability from a model name alone;
- do not allow raw AI output to write business tables directly;
- do not merge into `main` until a later integration gate.
