# Project Context

## Last Updated

2026-08-18 15:37 +08:00: PR18 implementation is complete and pushed at
`f574a79cdba289c5a210f6efad9f26b3a45be4df`; PR #17 is open/Draft and CI #261
is successful. The current phase is governance synchronization and final
acceptance re-review, not Ready or merge.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`
  (PR #16 / PR9 squash merge; Integration CI #237 SUCCESS)
- Active branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Base: `codex/v15-integration-foundation@3caa93bbc9127c9fee42da9c440f9db9b37436d3`
- Current HEAD: `f574a79cdba289c5a210f6efad9f26b3a45be4df`
- Remote PR18 branch: pushed; PR #17 is `OPEN / DRAFT`
- Current worktree: five authorized governance-sync changes, uncommitted and
  unstaged during `PR18-GOVERNANCE-SYNC-FIX02`
- Staging / production: not created / not deployed

## Project Summary

V1 core is on main. V1.5 is incremental: AI is R1, Push R1.1, new RRULE/Import
R2, and full local encryption migration/Shrink R3. `PLANS.md` is the canonical
task definition; Git/GitHub/CI/environment remain the live facts.

## Last Completed Task

- H05 scoped dependency audit exception: implemented and reviewed `ACCEPT`.
- PR18 implementation commit: `f574a79cdba289c5a210f6efad9f26b3a45be4df`.
- PR18 branch: pushed to the existing remote branch.
- PR #17: `OPEN / DRAFT`.
- CI #261 (`32108381329`): `quality`, `browser-qa` and `db-validation` SUCCESS.
- Final Acceptance Review01: `REQUEST_CHANGES`.
- Scope Deviation Decision01 and Authorization01: completed; both deviations
  are recorded below.

## Current Task

- ID: `PR18`
- Name: AI Proposal / Operation + Confirmation UI + Fake Provider
- Phase: Phase 2 / R1 AI Core
- Status: `IN_PROGRESS / DONE_PUSHED`
- Branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Base: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`
- Contract: `tasks/PR18.md`
- Implementation: completed
- HEAD: `f574a79cdba289c5a210f6efad9f26b3a45be4df`
- Current gate: `PR18-GOVERNANCE-SYNC-FIX02`
- Next gate: `PR18-GOVERNANCE-SYNC-REVIEW03`

## Completed Work

- PR2 and PR5 dependencies are `DONE_INTEGRATION`.
- PR9 repository abstraction is `DONE_INTEGRATION`.
- The PR18 branch was created from the exact Integration HEAD and now contains
  the completed Proposal / Operation / confirmation implementation.
- The PR18 contract freezes user flow, safety, contract/whitelist, Fake
  Provider and acceptance boundaries.
- `CONTRACT_CHANGE_REQUIRED -> KEEP_AND_AUTHORIZE` is approved for the shared
  Proposal HTTP contract and OpenAPI.
- `SCHEMA_CHANGE_REQUIRED` is currently `AUTHORIZED MINIMAL SLICE` for the
  minimal `SystemSetting.feature_flags` persistence slice;
  `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`.

## Remaining Work

- Complete `PR18-GOVERNANCE-SYNC-REVIEW03`.
- Complete `PR18-FINAL-ACCEPTANCE-REVIEW02`.
- Separately authorize and perform PR #17 metadata/body synchronization.
- Separately authorize Ready for review.
- Separately authorize merge, then verify the resulting Integration HEAD.
- PR19 remains blocked until PR18 reaches `DONE_INTEGRATION` and is separately
  selected; PR10 remains NOT STARTED.

## Blockers

- No source implementation blocker remains.
- PR18 remains blocked on governance/final acceptance/Ready/merge gates.
- H1/H2/H7 retain their existing R1 blocking semantics; no human gate was changed.

## Known Issues

- Real AI Provider behavior remains unvalidated and belongs to PR20/H7.
- `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`; PR18 retains only
  the authorized minimal `SystemSetting.feature_flags` slice and migration.
- The Web client still contains local AI type copies; resolving that duplication
  is not authorized in this governance-sync gate and must not change the lockfile.

## Verification Status

- Live Integration HEAD: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`.
- PR #17: `OPEN / DRAFT`, head `f574a79cdba289c5a210f6efad9f26b3a45be4df`.
- CI #261 (`32108381329`): `quality`, `browser-qa` and `db-validation`
  SUCCESS.
- PR18 Final Acceptance Review01: `REQUEST_CHANGES`; scope deviations were
  separately authorized.
- Shared AI Operation types, statuses and eight-field whitelist: VERIFIED against
  `packages/api-contracts/src/ai.ts` and `packages/api-contracts/src/enums.ts`.
- Governance-sync `git diff --check` and `npm run check:context`: PASS after
  this gate's five-file validation.
- No source, test, package, Prisma, migration, OpenAPI, contract or CI workflow
  files were modified by this gate.

## Recent Changes

- PR18 implementation, H05 exception, commit, push and CI #261 are complete.
- Final Acceptance Review01 identified two scope deviations; both are now
  recorded as separately authorized.
- This gate synchronizes only the five governance/task-state files.

## Next Recommended Task

`PR18-GOVERNANCE-SYNC-REVIEW03`, followed by final acceptance re-review. PR
metadata update, Ready, merge and Integration verification each require their
own authorization.

## Important Constraints

- Accept Proposal is not Final Confirm Business Write.
- Formal writes require final user confirmation and existing Domain Services.
- Real Provider/network/credentials and PR19 Router remain outside PR18.
- Only the authorized minimal `SystemSetting.feature_flags` slice is retained;
  `PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18`.
- The H05 `deepmerge-ts` exception is scoped and expires on `2026-09-01`.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR18.md`.
2. Verify live branch, HEAD, PR #17 Draft status and CI #261 before any gate.
3. Treat PR18 as `IN_PROGRESS / DONE_PUSHED`; it is not Ready, merged or
   `DONE_INTEGRATION`.
4. Complete `PR18-GOVERNANCE-SYNC-REVIEW03` before any PR metadata update.
5. Do not stage, commit, push, update PR, Ready, merge, deploy or start PR19
   without a separate explicit authorization.
