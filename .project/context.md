# Project Context

## Last Updated

2026-08-14 +08:00：PR9 repository implementation and reconnect E2E coverage are
complete; governance is aligned for independent review before commit authorization.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `24b6a3928a45d64947749491c40cd0e3a890c683`
  (PR #15 / PR6 `DONE_INTEGRATION`)
- Active branch: `codex/v15-pr9-v1plain-repository`
- Base: integration HEAD `24b6a3928a45d64947749491c40cd0e3a890c683`
- Remote PR9 branch / PR: none
- Working tree: PR9 implementation modified and uncommitted
- Staging / production: not created / not deployed

## Project Summary

V1 core is on main. V1.5 is incremental: AI is R1, Push R1.1, new RRULE/Import
R2, and full local encryption migration/Shrink R3. `PLANS.md` is the canonical
task definition; Git/GitHub/CI/environment are live facts.

## Last Completed Task

- `PR6`: `DONE / DONE_INTEGRATION`; PR #15 squash merged into integration at
  `24b6a3928a45d64947749491c40cd0e3a890c683`.

## Current Task

- ID: `PR9`
- Status: `IMPLEMENTATION_COMPLETE / VERIFYING / MODIFIED_UNCOMMITTED`
- Branch: `codex/v15-pr9-v1plain-repository`
- Contract: `tasks/PR9.md`
- Result: strict `LocalRepository`, `V1PlainRepository`, default composition root
  and handler/sync consumer migration are complete. Reconnect E2E assertions are
  implemented, Playwright discovery passed and the existing browser-qa CI path can
  execute them; reconnect runtime evidence remains `PENDING_CI`.

## Verification pending and known limitations

- A disposable `E2E_DATABASE_URL` is unavailable locally, but the existing GitHub
  browser-qa job provides MySQL 8.4 and a valid E2E runtime path.
- Reconnect assertions are complete and discovered; runtime remains `PENDING_CI`
  and must not be recorded as PASS before GitHub execution.
- Legacy `hasAnyStoredData()` remains intentionally global and is documented.
- H1/H2/H7 block R1; cloud, real AI, staging and production require authorization.

## Verification Status

- Web typecheck: PASS.
- Web tests: 11 files / 25 tests PASS.
- Web build: PASS.
- Real Chromium repository parity: PASS for CRUD/upsert/missing/isolation/pending
  ordering/update/reload/cleanup/global availability.
- PR9 reconnect Playwright test: IMPLEMENTED / DISCOVERED; existing browser-qa CI
  compatibility CONFIRMED; runtime result PENDING_CI.
- Full quality/check:context/git diff check: PASS.
- add/commit/push/PR/deploy: NOT_RUN.

## Recent Changes

- Added repository contract, V1 adapter and default instance.
- Removed raw DB helper imports from offline handler and sync consumers.
- Added injected consumer tests and a real-browser repository parity spec.
- No DB schema/version, store/view, UI, dependency or package changes.

## Next Recommended Task

Perform independent read-only governance-correction review, then request separate
commit authorization. Push, Draft PR, browser-qa runtime evidence, Ready and merge
remain later independent gates. Do not start PR18.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR9.md`.
2. Verify live integration/base and inspect the full uncommitted diff.
3. Preserve IndexedDB v1 and legacy global availability semantics.
4. Treat reconnect runtime as `PENDING_CI` until GitHub evidence exists; the test
   implementation and discovery are already complete.
5. Commit, push, PR and merge each require separate authorization.
