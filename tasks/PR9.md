# PR9 — Repository Abstraction + V1PlainRepository

## Goal and dependency

- Goal: introduce a consumer-driven `LocalRepository` abstraction and a
  `V1PlainRepository` adapter over the existing IndexedDB v1 persistence.
- Frozen dependency: PR5 `DONE_INTEGRATION`.
- Base: `codex/v15-integration-foundation@24b6a3928a45d64947749491c40cd0e3a890c683`.
- This task is an abstraction, not a data migration or behavior correction.

## Frozen behavior

- Keep database name `daily-assistant-sync`, version `1`, stores `kv`, `entities`,
  `pending`, current indexes and upgrade semantics.
- Preserve entity upsert/get/list/delete, tombstones and error propagation.
- Preserve pending user scope, `createdAt` ordering, statuses, ID rewrite, queue,
  pull/flush/retry/conflict/cursor behavior and cleanup.
- Preserve `hasAnyStoredData()` as a legacy global boolean. PR9 does not make it
  user-scoped.
- The public repository contract requires explicit `userId` and `entityType` for
  entity operations and explicit `userId` for pending mutation operations.

## Allowed and forbidden scope

- Allowed: `apps/web/src/offline` repository/consumer files, focused tests,
  `tests/e2e/offline-repository.spec.ts`, this task contract and minimal project
  recovery state.
- Forbidden: package/lock files, stores, views, components, API/Prisma/contracts,
  feature-flag switching, V2 encryption, migration coordination, dual read/write,
  database version/schema changes, cloud/deployment and PR18.

## Repository contract

- Metadata: `metadataGet`, `metadataSet`, `metadataDelete`.
- Entities: `entityGet`, `entityList`, `entityPut`, `entityDelete`.
- Pending: `pendingGet`, `pendingList`, `pendingPut`, `pendingUpdate`,
  `pendingDelete`.
- User lifecycle: `clearUserData(userId)`.
- Legacy availability: global `hasAnyStoredData()`.
- No IndexedDB database, transaction or object-store types cross this interface.

## Implementation

- Status: COMPLETE.
- `db.ts` retains the verified IndexedDB v1 schema/lifecycle and raw primitives.
- `V1PlainRepository` validates public scope and delegates to those primitives.
- `repository-instance.ts` creates the single default V1 repository with no flag.
- `handler.ts` and `sync.ts` accept injected repositories while defaulting to the
  production instance. Stores and views remain unchanged.

## Test evidence

- Local static/unit/browser repository parity: COMPLETE.
- Web typecheck: PASS.
- Web Vitest: 11 files / 25 tests PASS.
- Web production build: PASS.
- Entity parity, pending parity, user isolation, offline reload, cleanup, Browser
  Back, error propagation and legacy global `hasAnyStoredData()` preservation: PASS.
- Reconnect E2E assertions: COMPLETE for offline TASK creation, pending state, no
  offline server write, reconnect flush/convergence, exact server count, duplicate
  protection, ID rewrite, second-user isolation and post-reload convergence.
- Reconnect Playwright discovery: PASS; existing GitHub browser-qa with MySQL 8.4
  and `E2E_DATABASE_URL` can execute the test.
- Reconnect runtime: PENDING_CI. Do not record reconnect PASS before CI execution.
- Final diff review: production implementation review passed; governance lifecycle
  correction applied locally and pending independent read-only review.

## DeepSeek usage

- Policy: conditionally allowed for mechanical implementation.
- One `deepseek-v4-flash` workspace-write attempt was started with exact path
  restrictions, produced no output or filesystem changes, and was terminated.
- DeepSeek made no Git mutation and no accepted implementation change.

## Remaining work

- Full repository quality/context/diff checks PASS.
- Complete independent governance-correction review.
- Obtain independent commit authorization, then separately authorize push and
  Draft PR creation.
- Use browser-qa CI for reconnect runtime evidence, followed by independent Ready
  and merge gates.
- Do not start PR18 automatically.

## Git authorization boundary

- File modification and test execution are authorized for this implementation.
- Staging, commit, push, remote branch creation, PR creation/update, Ready, merge
  and deploy are not authorized.
