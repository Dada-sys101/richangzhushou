# Project Context

## Last Updated

2026-08-19 17:25 +08:00: PR18 is complete and integrated. Source HEAD is
`9bee2f8fb1401caaeebff96912a21e01e57c655c`; PR #17 was squash merged into
Integration at `7caf892022c9bb6833c7316893bfddeb169b7243`. The governance-close
commit `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` is committed and pushed, and
the current verified Integration ref is
`50f4f936a4ce46ac746f23478a929287d6e17c94`. PR19 Contract V10 is frozen and
GPT-accepted; landing commit `bc8bc413c6862e0d92247d7e6608dd6e99f505d7` is
`LOCAL_COMMITTED / NOT_PUSHED` (local AHEAD 1 / BEHIND 0). Repository Persisted
Gate is `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`; Repository
landing state is `WORKTREE_FIXED / UNCOMMITTED`; Persisted Successor Gate is
`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`. PR19 implementation
remains not started and not authorized.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Last verified Integration governance-close anchor:
  `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd`
  (PR #17 functional Squash Merge remains
  `7caf892022c9bb6833c7316893bfddeb169b7243`; Integration CI #264 SUCCESS)
- Current verified Integration ref: `50f4f936a4ce46ac746f23478a929287d6e17c94`
- Current local HEAD: `bc8bc413c6862e0d92247d7e6608dd6e99f505d7`
- PR19 landing relation: `AHEAD 1 / BEHIND 0`; landing commit is
  `LOCAL_COMMITTED / NOT_PUSHED`
- Source branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Source HEAD: `9bee2f8fb1401caaeebff96912a21e01e57c655c`
- Base: `codex/v15-integration-foundation@7caf892022c9bb6833c7316893bfddeb169b7243`
- PR #17: `MERGED / CLOSED`; source branch remains present
- Governance close: commit `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` is
  committed and pushed; the local checkout was verified clean with no staged
  changes.
- Staging / production: not created / not deployed

## Project Summary

V1 core is on main. V1.5 is incremental: AI is R1, Push R1.1, new RRULE/Import
R2, and full local encryption migration/Shrink R3. `PLANS.md` is the canonical
task definition; Git/GitHub/CI/environment remain the live facts.

## Last Completed Task

- H05 scoped dependency audit exception: implemented and reviewed `ACCEPT`.
- PR18 implementation commit: `f574a79cdba289c5a210f6efad9f26b3a45be4df`.
- PR18 source HEAD: `9bee2f8fb1401caaeebff96912a21e01e57c655c`.
- PR #17: `MERGED / CLOSED` by Squash Merge
  `7caf892022c9bb6833c7316893bfddeb169b7243`.
- CI #263 (`32122546919`) and Integration CI #264 (`32204580996`) passed with
  `quality`, `browser-qa` and `db-validation` SUCCESS.
- Final Acceptance Review02: `ACCEPT`; P0/P1/P2: none.
- Ready-for-review, merge and post-merge Integration verification: `ACCEPT`.
- Scope Deviation Decision01 and Authorization01: completed; both deviations
  remain recorded below.

## Current Task

- ID: `PR19`
- Name: AI Router、Stub 与安全降级
- Phase: Phase 2 / R1 AI Core
- Status: `READY / NOT_STARTED`
- Checkout: detached at `bc8bc413c6862e0d92247d7e6608dd6e99f505d7`; remote Integration remains `50f4f936a4ce46ac746f23478a929287d6e17c94`; local relation `AHEAD 1 / BEHIND 0`
- Contract: `tasks/PR19.md`
- Contract status: `V10 / FROZEN / GPT_ACCEPT`
- Contract review: `PR19-CONTRACT-REVIEW09 = ACCEPT`
- Contract landing commit: `bc8bc413c6862e0d92247d7e6608dd6e99f505d7` (`LOCAL_COMMITTED / NOT_PUSHED`)
- Implementation: `NOT_STARTED / NOT_AUTHORIZED`
- Repository Persisted Gate: `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`
- Repository landing state: `WORKTREE_FIXED / UNCOMMITTED`
- Persisted Successor Gate: `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`
- Commit: `COMPLETED / LOCAL_COMMITTED`
- Push: `NOT_AUTHORIZED`
- PR operation: `NOT_AUTHORIZED`

## Completed Work

- PR2 and PR5 dependencies are `DONE_INTEGRATION`.
- PR9 repository abstraction is `DONE_INTEGRATION`.
- The PR18 branch was created from the exact Integration baseline and now contains
  the completed Proposal / Operation / confirmation implementation.
- The PR18 contract freezes user flow, safety, contract/whitelist, Fake
  Provider and acceptance boundaries.
- `CONTRACT_CHANGE_REQUIRED -> KEEP_AND_AUTHORIZE` is approved for the shared
  Proposal HTTP contract and OpenAPI.
- `SCHEMA_CHANGE_REQUIRED` is currently `AUTHORIZED MINIMAL SLICE` for the
  minimal `SystemSetting.feature_flags` persistence slice;
  `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`.
- PR19 V10 is separately accepted and records the authorized minimal
  `originalUserInput` / `originalInputExpiresAt` persistence plus expiry index;
  existing `AiRequest.locale` and `AiRequest.timeZoneId` persistence remain
  unchanged.
- PR19 V10 landing commit `bc8bc413c6862e0d92247d7e6608dd6e99f505d7` contains
  only the task/governance carriers and remains `LOCAL_COMMITTED / NOT_PUSHED`.

## Remaining Work

- Repository Persisted Gate is
  `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`; its materialized
  landing state is `WORKTREE_FIXED / UNCOMMITTED`. Persisted Successor Gate is
  `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`.
  PR19 implementation remains `NOT_STARTED / NOT_AUTHORIZED` and requires a
  separate implementation gate; it must not start automatically.
- PR18 post-merge PR metadata close, if required, remains a separate metadata
  gate and is not part of this five-file synchronization.
- PR10 remains `NOT STARTED`.
- Deploy remains `NOT AUTHORIZED`.

## Blockers

- No PR18 source, merge or Integration verification blocker remains.
- PR19 contract landing state semantics are awaiting the recorded Next
  Orchestration Gate.
  Implementation, push and PR operation remain unauthorized; no additional
  commit is authorized.
- H1/H2/H7 retain their existing R1 blocking semantics; no human gate was
  changed.

## Known Issues

- Real AI Provider behavior remains unvalidated and belongs to PR20/H7.
- `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`; PR18 retains only
  the authorized minimal `SystemSetting.feature_flags` slice and migration.
- The Web client still contains local AI type copies; resolving that duplication
  is not authorized in this governance-sync gate and must not change the lockfile.

## Verification Status

- Source HEAD: `9bee2f8fb1401caaeebff96912a21e01e57c655c`.
- PR #17: `MERGED / CLOSED`; Squash Merge
  `7caf892022c9bb6833c7316893bfddeb169b7243`.
- Last verified Integration governance-close anchor:
  `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd`.
- CI #263 (`32122546919`) and Integration CI #264 (`32204580996`):
  `quality`, `browser-qa` and `db-validation` SUCCESS.
- Final Acceptance Review02, Ready-for-review, merge and post-merge
  Integration verification: `ACCEPT`.
- Governance-close commit `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` was
  pushed to Integration; governance-close CI verification is `ACCEPT / PASSING`
  from the Integration branch status badge captured at verification time.
- PR19 V10 contract landing commit `bc8bc413c6862e0d92247d7e6608dd6e99f505d7`
  is `LOCAL_COMMITTED / NOT_PUSHED`; no production implementation, migration,
  test or external operation was performed.
- Shared AI Operation types, statuses and eight-field whitelist: VERIFIED against
  `packages/api-contracts/src/ai.ts` and `packages/api-contracts/src/enums.ts`.
- Governance-state synchronization `git diff --check` and
  `npm run check:context`: PASS.
- V10 landing scope contains only task/governance documentation; no source,
  test, package, Prisma, migration, OpenAPI implementation or CI workflow file
  was changed.

## Recent Changes

- PR18 implementation, H05 exception, final acceptance, Ready, Squash Merge,
  governance-close commit/push and Integration verification are complete.
- PR18 remains `DONE / DONE_INTEGRATION`.
- PR19 V10 contract is `FROZEN / GPT_ACCEPT`; landing commit is
  `LOCAL_COMMITTED / NOT_PUSHED`; implementation has not started.

## Next Recommended Task

`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`

Review the repository state semantics. This review does not authorize PR19
implementation, an additional commit, push, PR operation, PR20, H7 closure or
deployment.

## Important Constraints

- Accept Proposal is not Final Confirm Business Write.
- Formal writes require final user confirmation and existing Domain Services.
- Real Provider/network/credentials and PR19 Router remain outside PR18.
- PR19 V10 landing commit is `LOCAL_COMMITTED / NOT_PUSHED`; implementation is
  `NOT_STARTED / NOT_AUTHORIZED`.
- No additional commit, push or PR operation is authorized by this Gate.
- **READ_ONLY_GATE_PERSISTENCE_RULE**: `REPOSITORY_PERSISTED_GATE` is the last
  repository write checkpoint materialized into governance files;
  `PERSISTED_SUCCESSOR_GATE` is its immediate expected orchestration gate; and
  `GPT_ACTIVE_GATE` is externally controlled. A Write Gate records both. A
  read-only Review may consume the successor without repository mutation; it
  may remain recorded until a later authorized Write Gate materializes new
  state. A Review must not `REQUEST_CHANGES` solely because GPT Active Gate
  differs from Repository Persisted Gate or has advanced beyond a consumed
  successor. A successor is inconsistent only if stale when its checkpoint was
  produced.
- Only the authorized minimal `SystemSetting.feature_flags` slice is retained;
  `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`.
- The H05 `deepmerge-ts` exception is scoped and expires on `2026-09-01`.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR19.md`.
2. Treat PR18 as `DONE / DONE_INTEGRATION`; use
   `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` as the verified PR18
   governance-close anchor and retain the functional squash merge SHA
   `7caf892022c9bb6833c7316893bfddeb169b7243` separately.
3. Re-read the live Integration ref from Git/GitHub before any future Git action;
   this repository snapshot is not a realtime branch-ref mirror.
4. Treat V10 landing commit `bc8bc413...` as `LOCAL_COMMITTED / NOT_PUSHED`.
   Repository Persisted Gate is
   `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`; the repository
   landing state is `WORKTREE_FIXED / UNCOMMITTED`; Persisted Successor Gate is
   `PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`. A read-only
   review may consume that successor without mutation; a later GPT Active Gate
   does not itself make the repository state inconsistent. Do not start
   implementation without a separate implementation authorization.
5. Keep Deploy `NOT AUTHORIZED`, H1/H2/H7 semantics unchanged, and do not
   modify PR4 full management scope.
