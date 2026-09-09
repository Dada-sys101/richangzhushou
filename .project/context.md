# Project Context

## Last Updated

2026-09-08 16:00 +08:00 — R1 Quality Gate approved; separate Staging waived; existing Alibaba private preview selected as the validation environment; REL-03 lightweight readiness is next.

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `9421d819a44a47728e6d7f6e93bfd4f98f681f24`
- Integration branch: `codex/v15-integration-foundation`
- Verified Integration HEAD: `6515b8fd0f13969a0e434d3d8223f60a82cb0310`
- Active worktree: `D:\daily-assistant`
- Active branch: `codex/v15-v2-ui-visual-freeze`
- Active branch HEAD: `1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e`
- PR #25: `MERGED`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Local state/evidence documentation changes remain uncommitted.

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
- Current canonical task: `REL-03 Private Preview Readiness / READY`.
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

- ID: `REL-03 Private Preview Readiness`
- Goal: add the smallest non-sensitive readiness mechanism and close the release/rollback procedure on the existing private-preview environment.
- Scope: readiness code and focused tests, controlled verification on the existing server, and documentation of backup/deploy/liveness/readiness/smoke/application rollback.
- Excluded: new cloud resources or fees, database schema changes unless separately approved, public entry, production release, Provider expansion and unrelated V1.5 features.
- Current `/api/v1/health` is liveness-only; authenticated `/api/v1/admin/health` checks the database.

## Next Recommended Task

Implement REL-03 lightweight readiness locally, test success and database-failure behavior, then verify it on the existing private-preview environment under the applicable deployment authorization. After REL-03, reassess the reduced REL-04 scope before any invited-user expansion or public entry.

## Completed Work

- V1 and the V1.5 R1 foundation, AI proposal/router/provider adapter integration, offline synchronization, Web UX closure and release candidate integration are complete.
- H7 is closed based on the recorded synthetic-data Provider evaluation; this does not authorize broader/public Provider use.
- Daily protected database backup, 7-day cleanup and one isolated restore have been verified on the private-preview host.
- The active release is `/opt/daily-assistant-preview/releases/6515b8fd-2db6b6a2f199db4c`.
- Existing private-preview live AI remains enabled by explicit user decision; public expansion remains separately gated.

## Remaining Work

- REL-03 lightweight readiness and release/rollback procedure closure.
- Reduced REL-04 reassessment using the existing validation environment.
- Optional closed pilot observation before broader use.
- Public DNS, HTTPS, exact CORS and public-entry smoke only when public access is requested.
- R1.1 Push, R2 RRULE/Import/observability and R3 encrypted local migration/shrink remain future feature tracks.

## Blockers

- REL-03 has no current technical blocker.
- Public entry is blocked until domain/DNS/HTTPS/CORS work is explicitly requested and verified.
- Production and broader Provider use remain independently unauthorized.

## Known Issues

- Physical iPhone Safari/PWA behavior remains unverified; WebKit emulation is supporting evidence only.
- Current public health is liveness-only until REL-03 is implemented.
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

## Recent Changes

- Corrected the earlier blanket conclusion that npm overrides cannot produce valid SBOMs; the failure was specific to npm 11.13.0 workspace/file-link override propagation and is resolved by the pinned npm 11.18.0 toolchain.
- Merged and deployed the verified dependency candidate.
- Closed R1 with an explicit H1/H2 waiver while retaining the unverified status.
- Waived separate Staging and redirected REL-03 to the existing private-preview environment.

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
