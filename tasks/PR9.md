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

## One-time security exception

- Package and lockfile changes were not part of the original PR9 feature scope;
  the default prohibition above remains in force.
- CI #232 exposed an actual PR9 security blocker: the committed lockfile resolved
  `nanoid` 3.3.17, which triggered a HIGH-severity dependency advisory.
- A one-time, minimum-scope and explicitly authorized exception allowed only
  `package-lock.json` to update the `node_modules/nanoid` lock entry from 3.3.17
  to 3.3.18. Only its `version`, `resolved` and `integrity` values changed.
- Package manifest change: NO. Parent dependency upgrade: NO. Audit suppression:
  NO. Dependency override: NO. `--force`: NO. Manual lockfile edit: NO. Global npm
  modification: NO.
- Git evidence: security correction commit
  `91912de05abdf3ef5851b181697476392de79a1e`.
- Verification: push CI #233 SUCCESS; pull-request CI #234 SUCCESS; dependency
  audit vulnerabilities = 0.
- This exception exists solely to resolve PR9's observed CI security blocker. It
  does not permanently broaden PR9 dependency/lockfile scope and cannot be
  inherited as authorization for dependency changes in any later task.

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
- Reconnect runtime: PASS in pull-request CI #234 (run ID `31775740446`, event
  `pull_request`, conclusion SUCCESS); browser-qa completed 24 Playwright tests.
- `V1PlainRepository preserves IndexedDB v1 parity across reload`: PASS on
  chromium-desktop and chromium-mobile.
- `offline task create reconnects once and converges local and server state`: PASS
  on chromium-desktop and chromium-mobile.
- Push CI #233 and pull-request CI #234: quality, db-validation and browser-qa PASS.
- Final push CI #235 and pull-request CI #236: SUCCESS.
- Integration CI #237 at squash merge `3caa93bbc9127c9fee42da9c440f9db9b37436d3`:
  SUCCESS.
- Final implementation and governance reviews: PASS.

## DeepSeek usage

- Governance-close policy: PROHIBITED; DeepSeek was not called for this task.
- Historical implementation record: one `deepseek-v4-flash` workspace-write
  attempt produced no output or filesystem changes and was terminated. It made no
  Git mutation and no accepted implementation change.

## Remaining work

- PR9 executionStatus: `DONE`.
- PR9 deliveryStatus: `DONE_INTEGRATION`.
- PR #16: `MERGED / CLOSED`.
- Source head: `4017218ae76d19c9dbe423aac2848e20fee36490`.
- Squash merge: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`.
- Final PR CI: #235 SUCCESS; #236 SUCCESS.
- Final Integration CI: #237 SUCCESS.
- PR9 remaining engineering work: NONE.
- PR10: NOT STARTED. PR18 was selected separately after PR9 completion.

## Git authorization boundary

- Completed facts: implementation commit DONE; security correction commit DONE;
  governance-close commit DONE; push DONE; PR #16 creation/Ready/squash merge DONE;
  integration CI #237 SUCCESS.
- Branch deletion: NOT AUTHORIZED / NOT DONE.
- The one-time `nanoid` lockfile correction remains historical PR9-only evidence;
  it does not grant PR18 package or lockfile modification authority.
