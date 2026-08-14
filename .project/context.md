# Project Context

## Last Updated

2026-08-14 16:10 +08:00: PR9 is `DONE / DONE_INTEGRATION`; PR18 control
bootstrap is drafting the task contract without starting implementation.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`
  (PR #16 / PR9 squash merge; Integration CI #237 SUCCESS)
- Active branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Base: `codex/v15-integration-foundation@3caa93bbc9127c9fee42da9c440f9db9b37436d3`
- Remote PR18 branch: NOT CREATED
- Current worktree: six authorized control-contract changes, uncommitted
- Staging / production: not created / not deployed

## Project Summary

V1 core is on main. V1.5 is incremental: AI is R1, Push R1.1, new RRULE/Import
R2, and full local encryption migration/Shrink R3. `PLANS.md` is the canonical
task definition; Git/GitHub/CI/environment remain the live facts.

## Last Completed Task

- `PR9`: `DONE / DONE_INTEGRATION`.
- PR #16: `MERGED / CLOSED`.
- Source head: `4017218ae76d19c9dbe423aac2848e20fee36490`.
- Squash merge / Integration HEAD: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`.
- Final PR CI #235/#236 and Integration CI #237: SUCCESS.
- PR9 source branch deletion: NOT AUTHORIZED / NOT DONE.

## Current Task

- ID: `PR18`
- Name: AI Proposal / Operation + Confirmation UI + Fake Provider
- Phase: Phase 2 / R1 AI Core
- Status: `READY / NOT_STARTED`
- Branch: `codex/v15-pr18-ai-proposal-fake-provider`
- Base: `3caa93bbc9127c9fee42da9c440f9db9b37436d3`
- Contract: `tasks/PR18.md`
- Implementation: NOT STARTED / not authorized by this control-bootstrap task

## Completed Work

- PR2 and PR5 dependencies are `DONE_INTEGRATION`.
- PR9 repository abstraction is `DONE_INTEGRATION`.
- The local PR18 branch was created from the exact Integration HEAD.
- The PR18 control contract freezes user flow, safety, contract/whitelist,
  Fake Provider and acceptance boundaries.

## Remaining Work

- Complete GPT review of the six-file control-contract diff.
- Obtain independent authorization to commit the control bootstrap.
- Separately authorize push/remote branch creation.
- Obtain a separate PR18 implementation authorization before changing code.
- PR19 follows PR18 only after PR18 reaches `DONE_INTEGRATION` and is separately
  selected; PR10 remains NOT STARTED.

## Blockers

- No control-contract drafting blocker.
- PR18 implementation is intentionally blocked on separate authorization.
- H1/H2/H7 retain their existing R1 blocking semantics; no human gate was changed.

## Known Issues

- Real AI Provider behavior remains unvalidated and belongs to PR20/H7.
- PR18 must stop for separate review if shared contracts or the Provider whitelist
  prove insufficient.

## Verification Status

- Live Integration HEAD: VERIFIED at `3caa93bbc9127c9fee42da9c440f9db9b37436d3`.
- PR #16 merged/closed and CI #235/#236/#237 SUCCESS: VERIFIED.
- Open PR count: 0; remote PR18 branch: absent.
- Shared AI Operation types, statuses and eight-field whitelist: VERIFIED against
  `packages/api-contracts/src/ai.ts` and `packages/api-contracts/src/enums.ts`.
- Control-contract `git diff --check` and `npm run check:context`: PASS.
- Staging/commit/push/PR/deploy: NOT RUN.

## Recent Changes

- Selected PR18 as the sole canonical task after PR9 integration.
- Created `tasks/PR18.md` as a control contract only.
- No application, package, test, schema, migration or workflow code changed.

## Next Recommended Task

Review the PR18 control contract, then request independent commit authorization.
Push/remote branch creation and implementation remain later independent gates.

## Important Constraints

- Accept Proposal is not Final Confirm Business Write.
- Formal writes require final user confirmation and existing Domain Services.
- Real Provider/network/credentials, PR19 Router, migrations and dependency changes
  are outside PR18.
- The PR9 `nanoid` exception is not inherited by PR18.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR18.md`.
2. Verify branch/base/live Integration and inspect the exact six-file diff.
3. Keep PR18 `READY / NOT_STARTED` until implementation is separately authorized.
4. Do not stage, commit, push, create a PR or start implementation without a new
   explicit authorization.
5. Do not automatically start PR19 or PR10.
