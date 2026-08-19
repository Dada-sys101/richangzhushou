# Project Context

## Last Updated

2026-08-19 10:11 +08:00: PR18 is complete and integrated. Source HEAD is
`9bee2f8fb1401caaeebff96912a21e01e57c655c`; PR #17 was squash merged into
Integration at `7caf892022c9bb6833c7316893bfddeb169b7243`. The governance-close
commit `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` is committed and pushed, and
the last verified Integration status badge was `PASSING`. PR19 is ready as a
dependency-satisfied task but is not selected or authorized to start.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Last verified Integration governance-close anchor:
  `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd`
  (PR #17 functional Squash Merge remains
  `7caf892022c9bb6833c7316893bfddeb169b7243`; Integration CI #264 SUCCESS)
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

- ID: `PR18`
- Name: AI Proposal / Operation + Confirmation UI + Fake Provider
- Phase: Phase 2 / R1 AI Core
- Status: `DONE / DONE_INTEGRATION`
- Branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Source HEAD: `9bee2f8fb1401caaeebff96912a21e01e57c655c`
- Integration merge SHA: `7caf892022c9bb6833c7316893bfddeb169b7243`
- Base: `7caf892022c9bb6833c7316893bfddeb169b7243`
- Contract: `tasks/PR18.md`
- Implementation: completed
- PR18 governance-close anchor:
  `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd`
- Current gate: `PR18-INTEGRATION-GOVERNANCE-CLOSE`
- Next canonical task: `PR19-SELECTION`

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

## Remaining Work

- `PR19-SELECTION` is the next canonical task. PR19 is `READY / NOT_STARTED /
  NOT SELECTED` and requires separate explicit authorization; it must not start
  automatically.
- PR18 post-merge PR metadata close, if required, remains a separate metadata
  gate and is not part of this five-file synchronization.
- PR10 remains `NOT STARTED`.
- Deploy remains `NOT AUTHORIZED`.

## Blockers

- No PR18 source, merge or Integration verification blocker remains.
- PR19 is not blocked by PR18 dependency, but remains unselected and
  unauthorized to start.
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
- Shared AI Operation types, statuses and eight-field whitelist: VERIFIED against
  `packages/api-contracts/src/ai.ts` and `packages/api-contracts/src/enums.ts`.
- Governance-state synchronization `git diff --check` and
  `npm run check:context`: PASS.
- No source, test, package, Prisma, migration, OpenAPI, contract or CI workflow
  files are part of the governance state scope.

## Recent Changes

- PR18 implementation, H05 exception, final acceptance, Ready, Squash Merge,
  governance-close commit/push and Integration verification are complete.
- PR18 is now `DONE / DONE_INTEGRATION`.
- The three canonical state files contain stable PR18 governance-close markers
  and the next canonical task.

## Next Recommended Task

`PR19-SELECTION`

PR19 is `READY / NOT_STARTED / NOT SELECTED`. Starting PR19 requires a separate
explicit selection authorization. It must not start automatically.

## Important Constraints

- Accept Proposal is not Final Confirm Business Write.
- Formal writes require final user confirmation and existing Domain Services.
- Real Provider/network/credentials and PR19 Router remain outside PR18.
- Only the authorized minimal `SystemSetting.feature_flags` slice is retained;
  `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`.
- The H05 `deepmerge-ts` exception is scoped and expires on `2026-09-01`.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR18.md`.
2. Treat PR18 as `DONE / DONE_INTEGRATION`; use
   `f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd` as the verified PR18
   governance-close anchor and retain the functional squash merge SHA
   `7caf892022c9bb6833c7316893bfddeb169b7243` separately.
3. Re-read the live Integration ref from Git/GitHub before any future Git action;
   this repository snapshot is not a realtime branch-ref mirror.
4. Treat PR19 as `READY / NOT_STARTED / NOT SELECTED`; do not start it without
   separate explicit selection authorization.
5. Keep Deploy `NOT AUTHORIZED`, H1/H2/H7 semantics unchanged, and do not
   modify PR4 full management scope.
