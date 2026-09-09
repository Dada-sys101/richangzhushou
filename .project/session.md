# Current Development Session

## Session Status

READY / REL_03_PRIVATE_PREVIEW_READINESS / R1_APPROVED / REL_02_SEPARATE_STAGING_WAIVED / PRIVATE_PREVIEW_DEPLOYED / CI_PASS / POST_DEPLOYMENT_SMOKE_PASS / PUBLIC_NOT_READY

## Task

- ID: `REL-03 Private Preview Readiness`
- Phase: existing private-preview validation and release hardening
- Execution: `READY`
- Delivery: `NOT_STARTED`
- Worktree: `D:\daily-assistant`
- Branch: `codex/v15-v2-ui-visual-freeze`
- Active branch HEAD: `1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e`
- Active private-preview release: Integration `6515b8fd0f13969a0e434d3d8223f60a82cb0310` at `/opt/daily-assistant-preview/releases/6515b8fd-2db6b6a2f199db4c`
- Scope: add lightweight, non-sensitive readiness and close the backup/deploy/health/smoke/rollback procedure on the existing Alibaba private-preview environment.
- Excluded: new Staging resources or fees, public switch, production release, Provider expansion, real-user/provider evaluation and unrelated V1.5 features.

## Current Progress

- PR #25 is merged; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Prisma 7.9.1 with exact overrides `deepmerge-ts@8.0.2`, `mariadb@3.4.7` and `mysql2@3.24.3`, using npm 11.18.0, passed local and target-host audit/SBOM/build verification.
- The private-preview release is active. API, Web and Admin entry checks pass, and post-switch warning/error logs were empty.
- Real business smoke passed login, forced password change, task, calendar, transaction and refresh persistence. The disposable account and cascaded data were removed with `deleted=1 / remaining=0`.
- Daily backup, 7-day cleanup and an isolated database restore have been verified.
- `/api/v1/health` is liveness-only; authenticated `/api/v1/admin/health` checks the database. REL-03 must provide a non-sensitive readiness endpoint or an equivalent controlled probe without exposing credentials or topology.
- R1 Quality Gate is `APPROVED / DONE`. H1/H2 are `WAIVED_FOR_R1 / UNVERIFIED` and are not physical-device passes.
- The user explicitly waived a separate Staging environment. REL-02 is `CANCELLED / SEPARATE_STAGING_WAIVED`; the existing private preview is the validation environment.

## Remaining Work

1. Define and implement the smallest non-sensitive readiness check for the existing environment.
2. Add focused tests for readiness success and dependency failure.
3. Verify readiness on the private-preview host without changing public DNS, Provider settings or database schema.
4. Consolidate the release procedure: backup, deploy immutable release, liveness/readiness, business smoke and application rollback.
5. Reassess REL-04 after REL-03; public DNS/HTTPS/CORS and production release remain separate decisions.

## Verification Status

- Merged CI: `PASS` (`quality`, `db-validation`, `browser-qa`).
- Target Linux install/build/audit/SBOM: `PASS`.
- Private-preview entry and service health: `PASS`.
- Post-deployment business smoke and cleanup: `PASS`.
- Backup timer, cleanup and isolated restore: `PASS`.
- Lightweight readiness implementation: `NOT_STARTED`.
- Public DNS/HTTPS/CORS: `NOT_RUN / OUT_OF_CURRENT_SCOPE`.
- Physical iPhone Safari/PWA: `WAIVED_FOR_R1 / UNVERIFIED`.

## Resume Instructions

1. Read `AGENTS.md`, `PLANS.md` and `.project/v15-execution-state.md`, then verify the current branch, HEAD and worktree.
2. Treat Integration `6515b8f` and the active private-preview release as the current verified release facts.
3. Work only on REL-03 lightweight readiness and release-procedure closure; do not recreate the waived independent Staging plan.
4. Preserve uncommitted documentation changes and do not commit, push, switch public traffic or expand Provider use without applicable authorization.

## Last Updated

2026-09-08 16:00 +08:00 — R1 approved; separate Staging waived; current task set to REL-03 readiness on the existing private-preview environment.
