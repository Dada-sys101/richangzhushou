# Project Context

## Last Updated

2026-09-12 11:21 +08:00 — MOBILE-C1 layout feedback fix `32c44e0` passes both CI matrices and is deployed to private preview; device recheck remains.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `9421d819a44a47728e6d7f6e93bfd4f98f681f24`
- Integration branch: `codex/v15-integration-foundation`
- Verified Integration HEAD: `5d6c5c51a452ce1c5e425dba32053e017ded77e2`
- Active worktree: `D:\daily-assistant`
- Active branch: `codex/mobile-c1-secondary-shell`
- Active delivery: MOBILE-C1 `FEEDBACK_FIX_DEPLOYED / PR_31_OPEN / CI_PASS / DEVICE_RECHECK_PENDING`
- PR #25: `MERGED`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Original mixed PR #26 is closed; governance/dependency PR #27 and Web Push PR #28 both pass quality, db-validation and browser-qa.
- MOBILE-A PR #29 merged at Integration `6e1313f`; MOBILE-B PR #30 is open at `4d86f90`, with CI runs `34580364107` and `34580381945` fully green. Active release is `/opt/daily-assistant-preview/releases/4d86f900-20260911T0846Z`.

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
- Current canonical task: `MOBILE-C1 Secondary Shell and Tokens / VERIFYING`.
- Public DNS/HTTPS/CORS, Provider expansion, REL-04 and production release remain separate gates.

## Last Completed Task

`R1 Quality Gate` completed after:

- Prisma 7.9.1 exact overrides for `deepmerge-ts@8.0.2`, `mariadb@3.4.7` and `mysql2@3.24.3`, with npm 11.18.0, passed clean install, dependency tree, audit 0, lock/tree SBOM and governance checks.
- Local MySQL 8.4.11 integration passed 18 files / 160 tests and database-backed Chromium smoke passed 44/44.
- PR #25 merged at Integration `6515b8f`; merged CI passed all three jobs.
- The candidate passed target-host Linux build, audit 0, 1043-component SBOM validation and dependency-version checks.
- The candidate was deployed to the existing private preview and passed login, forced password change, task, calendar, transaction and refresh-persistence smoke with zero blocking browser errors.
- The disposable account and cascaded records were removed with `deleted=1 / remaining=0`.
- Current-scope license handling was explicitly accepted; future external backend/container distribution or modified third-party libraries require renewed review.

## Current Task

- ID: `MOBILE-B PWA Lifecycle and Installation Experience`.
- Goal: make installation, main-screen launch and updates predictable on iPhone and Android.
- Scope: Manifest/icons, Android native install, iPhone add-to-home guidance, standalone detection and safe update confirmation.
- Current state: `ACCEPTED_WITH_DEFERRED_LIMITATIONS / DONE_PUSHED / PR_30_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / MERGE_AUTHORIZATION_PENDING`.
- Excluded: navigation, business logic, API/database, Push enablement, native wrappers and visual redesign.

## Next Recommended Task

Complete MOBILE-C1 physical device recheck on the updated private preview, then prepare its merge decision.

After MOBILE-B acceptance and merge, execute the staged MOBILE-C contract: secondary-page shell, custom dialogs, custom date/time fields, then complex page migration.

## Completed Work

- V1 and the V1.5 R1 foundation, AI proposal/router/provider adapter integration, offline synchronization, Web UX closure and release candidate integration are complete.
- H7 is closed based on the recorded synthetic-data Provider evaluation; this does not authorize broader/public Provider use.
- Daily protected database backup, 7-day cleanup and one isolated restore have been verified on the private-preview host.
- The active release is `/opt/daily-assistant-preview/releases/aebc2570-20260911T0946Z`; rollback release is `/opt/daily-assistant-preview/releases/4d86f900-20260911T0846Z`. MOBILE-B foreground update checks and logout-to-home relogin behavior are live in the private preview.
- Existing private-preview live AI remains enabled by explicit user decision; public expansion remains separately gated.
- MOBILE-B update takeover fixes `e756c0b`/`727cb60` and MOBILE-C planning commit `d7860cd` pass required validation; private preview runs `/opt/daily-assistant-preview/releases/727cb600-20260912T0203Z` with `927dea30-20260912T0129Z` retained for rollback.

## Remaining Work

- R1.1 Web Push commit/CI and real Push/system-notification/physical-device delivery validation.
- Reduced REL-04 reassessment using the existing validation environment.
- Optional closed pilot observation before broader use.
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
