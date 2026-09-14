# Project Context

## Last Updated

2026-09-14 15:30 +08:00 — Web Push device acceptance passed; today-date confirmation fix is verified locally.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `9421d819a44a47728e6d7f6e93bfd4f98f681f24`
- Integration branch: `codex/v15-integration-foundation`
- Verified Integration HEAD: `6e3ba34bfd070c0276dea4183ec51423d8f4724c`
- Active worktree: `D:\daily-assistant-worktrees\mobile-c4-complex-secondary-pages`
- Active branch: `codex/private-preview-feedback-operations`
- Current delivery: private-preview simplified operations `PR #35 MERGED / MERGED_CI_PASS`.
- PR #25: `MERGED`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Original mixed PR #26 is closed; governance/dependency PR #27 and Web Push PR #28 both pass quality, db-validation and browser-qa.
- MOBILE-A PR #29 merged at Integration `6e1313f`; MOBILE-B PR #30 and MOBILE-C1/C2/C3 PRs #31/#32/#33 are merged. Active release is `/opt/daily-assistant-preview/releases/8e9f53e0-20260914T1007Z`.

## Project Summary

- Daily Assistant is a standalone invited-user product for about 10 administrator-created accounts.
- Architecture remains one NestJS API, one MySQL database, one Vue PWA and one Vue Element Plus admin app.
- Cloud data is authoritative; clients support local cache, offline writes, retry and conflict confirmation.
- AI output remains a draft/proposal and cannot directly write formal business records without user confirmation.

## Current Development Stage

- R1 Quality Gate: `APPROVED / DONE`.
- H1/H2 physical iPhone evidence: `WAIVED_FOR_R1 / UNVERIFIED`; never report as a device pass.
- REL-02 separate Staging: `CANCELLED / SEPARATE_STAGING_WAIVED` by explicit user decision.
- Validation environment: existing Alibaba private preview.
- Current operating mode: `PRIVATE_PREVIEW_OPERATION / FEEDBACK_FIXES_ONLY / R1.1_PUSH_ACTIVE / H8_CLOSED / H6_DEVICE_ACCEPTANCE_PASS`.
- Public DNS/HTTPS/CORS, Provider expansion, REL-04 and production release remain separate gates.

## Last Completed Task

`MOBILE-C4 Complex Secondary Pages` completed after:

- Four UI slices covered transactions, planner lists, planner/trip details and AI drafts/proposals without changing business semantics.
- Candidate `8e9f53e` passed its CI, private-preview deployment checks and iPhone/Android device acceptance.
- PR #34 merged as Integration `e407157`; merged CI `34800440131` passed quality, db-validation and browser-qa.

## Current Task

- ID: `PRIVATE_PREVIEW_OPERATION`.
- Goal: let invited users use the existing private preview, address real feedback, and complete the explicitly selected R1.1 Web Push device validation.
- Current state: `ACTIVE / FEEDBACK_FIXES_ONLY / PRIVATE_PREVIEW_PUSH_ACTIVE / H6_DEVICE_ACCEPTANCE_PASS`; the iPhone today-date confirmation fix is `DONE_LOCAL / VERIFIED`.
- Deferred: REL-04～REL-06, R2/R3, public entry and new infrastructure.

## Next Recommended Task

Address user-reported defects only; select any expansion work only after explicit user direction.

MOBILE-C1 through MOBILE-C3 are integrated; MOBILE-C4 is the remaining stage of the frozen MOBILE-C sequence.

## Completed Work

- V1 and the V1.5 R1 foundation, AI proposal/router/provider adapter integration, offline synchronization, Web UX closure and release candidate integration are complete.
- H7 is closed based on the recorded synthetic-data Provider evaluation; this does not authorize broader/public Provider use.
- Daily protected database backup, 7-day cleanup and one isolated restore have been verified on the private-preview host.
- The active release is `/opt/daily-assistant-preview/releases/8e9f53e0-20260914T1007Z`; rollback release is `/opt/daily-assistant-preview/releases/b18b91d0-20260912T0735Z`. MOBILE-C4 is live in private preview and passed iPhone/Android physical-device acceptance.
- Existing private-preview live AI remains enabled by explicit user decision; public expansion remains separately gated.
- MOBILE-B update takeover fixes `e756c0b`/`727cb60` and MOBILE-C planning commit `d7860cd` pass required validation; private preview runs `/opt/daily-assistant-preview/releases/727cb600-20260912T0203Z` with `927dea30-20260912T0129Z` retained for rollback.

## Remaining Work

- Deliver the verified local fix for iPhone date-time confirmation when the user authorizes its commit, CI and private-preview deployment.
- Address necessary defects reported by invited users in the existing private preview.
- Keep all scope expansion, public release and new infrastructure deferred until the user explicitly selects one.
- Public DNS, HTTPS, exact CORS and public-entry smoke only when public access is requested.
- R1.1 Push, R2 RRULE/Import/observability and R3 encrypted local migration/shrink remain future feature tracks.

## Blockers

- REL-03 has no current technical blocker.
- Public entry is blocked until domain/DNS/HTTPS/CORS work is explicitly requested and verified.
- Production and broader Provider use remain independently unauthorized.

## Known Issues

- The update action remains imperfect for an already-installed legacy PWA client; the user deferred it because it does not materially block use.
- iOS system edge navigation cannot be fully disabled by a PWA on root pages; root-tab history remains flattened and horizontal overscroll is suppressed where supported.
- The user reported iPhone and Android MOBILE-A acceptance passed on 2026-09-11; detailed device screenshots/logs were not captured in the repository.
- Public health performs a database query and returns readiness without exposing sensitive details.
- Separate Staging, managed MySQL TLS/private networking and cross-location restore were deliberately waived for the current small private-preview scope; reassess them for public launch, larger scale or important real data.

## Verification Status

- Local quality and dependency governance: `PASS`.
- MySQL 8.4.11 integration: `18 files / 160 tests PASS`.
- Database-backed browser smoke: `44/44 PASS`.
- PR #25 and merged Integration CI: `PASS`.
- Target-host Linux build, audit and SBOM: `PASS`.
- Private-preview health, business smoke and cleanup: `PASS`.
- Backup timer, retention cleanup and isolated restore: `PASS`.
- REL-03 readiness: `NOT_STARTED`.
- Public entry and physical iPhone: `NOT_VERIFIED`.
- MOBILE-B second feedback fix: local quality `PASS`（Web 26 files/130 tests、API 34 files/281 tests）；CI runs `34664717946` and `34664718882` all green; private-preview post-deployment checks pass.

## Recent Changes

- Corrected the earlier blanket conclusion that npm overrides cannot produce valid SBOMs; the failure was specific to npm 11.13.0 workspace/file-link override propagation and is resolved by the pinned npm 11.18.0 toolchain.
- Merged and deployed the verified dependency candidate.
- Closed R1 with an explicit H1/H2 waiver while retaining the unverified status.
- Waived separate Staging and redirected REL-03 to the existing private-preview environment.
- Made PWA update actions observable and resilient when the waiting worker changes, selected today visibly by default in Plan Center, and drafted MOBILE-C as four bounded UI phases.

## Important Constraints

- Preserve user data isolation, fixed-point monetary handling, `Asia/Shanghai` business time and user confirmation before formal AI-assisted writes.
- Do not treat H1/H2 waiver as physical-device evidence.
- Do not create a separate Staging environment unless the user revisits the scope decision.
- Do not commit, push, switch public traffic, deploy production or expand Provider use without applicable authorization.
- Do not include credentials, tokens, cookies, private keys or private business content in repository evidence.

## Handoff Instructions

1. Restore state from `AGENTS.md`, `PLANS.md`, `.project/v15-execution-state.md` and `.project/session.md` before implementation.
2. Treat Integration `6515b8f` and the active private-preview release as the current verified facts.
3. Keep REL-03 limited to lightweight readiness and release-procedure closure on the existing environment.
4. Preserve the uncommitted documentation work until it is reviewed and separately authorized for commit/push.
5. Reassess separate Staging only for public launch, larger scale or important real data.
