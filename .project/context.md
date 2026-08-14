# Project Context

## Last Updated

2026-08-14 14:28 +08:00：PR9 implementation and remote delivery are complete;
Draft PR #16 and both bound CI runs are green, including reconnect runtime.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `24b6a3928a45d64947749491c40cd0e3a890c683`
  (PR #15 / PR6 `DONE_INTEGRATION`)
- Active branch: `codex/v15-pr9-v1plain-repository`
- Base: integration HEAD `24b6a3928a45d64947749491c40cd0e3a890c683`
- Remote PR9 branch: `91912de05abdf3ef5851b181697476392de79a1e`
- PR: #16 `OPEN / DRAFT`; head `91912de05abdf3ef5851b181697476392de79a1e`;
  base `codex/v15-integration-foundation@24b6a3928a45d64947749491c40cd0e3a890c683`
- Implementation delivery worktree before this governance close: `CLEAN`.
- Current worktree: four authorized governance-only modifications, uncommitted.
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
- Status: `VERIFIED / PR_OPEN / DRAFT`
- Branch: `codex/v15-pr9-v1plain-repository`
- Contract: `tasks/PR9.md`
- Result: strict `LocalRepository`, `V1PlainRepository`, default composition root
  and handler/sync consumer migration are complete. Two commits are pushed, Draft
  PR #16 is open, push CI #233 and pull-request CI #234 are green, and reconnect
  runtime is verified. Merge review remains pending.

## Verification status and known limitations

- A disposable `E2E_DATABASE_URL` was unavailable locally; CI #234 browser-qa used
  MySQL 8.4 and completed the authoritative reconnect runtime execution.
- PR #16 remains Draft and unmerged. Governance-close commit/push, Ready, merge and
  deploy require separate authorization.
- Legacy `hasAnyStoredData()` remains intentionally global and is documented.
- H1/H2/H7 block R1; cloud, real AI, staging and production require authorization.

## Verification Status

- Web typecheck: PASS.
- Web tests: 11 files / 25 tests PASS.
- Web build: PASS.
- Real Chromium repository parity: PASS for CRUD/upsert/missing/isolation/pending
  ordering/update/reload/cleanup/global availability.
- Push CI #233: SUCCESS; quality, db-validation and browser-qa PASS.
- Pull-request CI #234: SUCCESS; quality, db-validation and browser-qa PASS;
  browser-qa completed 24 Playwright tests.
- Reconnect runtime: PASS on Chromium desktop and mobile. CI verified offline TASK
  create -> pending local state -> reconnect flush -> single server convergence ->
  ID rewrite -> second-user isolation -> reload convergence.
- Full quality/check:context/git diff check: PASS.
- Implementation commit, security correction commit, push and Draft PR creation:
  DONE. Governance-close commit/push, Ready, merge and deploy: NOT_RUN.

## Recent Changes

- Added repository contract, V1 adapter and default instance.
- Removed raw DB helper imports from offline handler and sync consumers.
- Added injected consumer tests and a real-browser repository parity spec.
- Applied the separately authorized one-time lockfile-only security correction for
  `nanoid` 3.3.17 -> 3.3.18; no manifest, parent dependency or override changed.
- No DB schema/version, store/view or UI changes.

## Next Recommended Task

Complete PR9 governance-close review, then request separate authorization to
commit these governance-only changes, separately push them, verify final CI and
perform final merge-readiness review. Merge remains an independent authorization.
Do not automatically start PR10 or PR18.

## Handoff Instructions

1. Read `PLANS.md`, this context, execution state, session and `tasks/PR9.md`.
2. Verify PR #16, integration/base and inspect the four-file governance diff.
3. Preserve IndexedDB v1 and legacy global availability semantics.
4. Preserve CI #233/#234 and reconnect runtime PASS evidence without treating the
   snapshot as a realtime mirror.
5. Governance commit, push, Ready and merge each require separate authorization.
6. Keep PR9 as the only canonical task; do not start PR10 or PR18 automatically.
