# Project Status

updatedAt: 2026-09-15T17:29:00+08:00
repository: Dada-sys101/richangzhushou
mainHead: 9421d819a44a47728e6d7f6e93bfd4f98f681f24
integrationBranch: codex/v15-integration-foundation
integrationHead: d05b25cb058d0940b29508ba9ef071920226f994
activeBranch: codex/uir-02-delivery-record
activeHead: 05e4d696
activeTask: PRIVATE_PREVIEW_OPERATION
executionStatus: ACTIVE
deliveryStatus: FEEDBACK_FIXES_ONLY / PRIVATE_PREVIEW_AVAILABLE / R1.1_PUSH_ACTIVE / H8_CLOSED / H6_DEVICE_ACCEPTANCE_PASS
nextCanonicalTask: PRIVATE_PREVIEW_FEEDBACK_FIXES_ONLY
nextCanonicalTaskAfterCompletion: NONE
localRevision: 8bbb302
staging: SEPARATE_STAGING_WAIVED / EXISTING_PRIVATE_PREVIEW_IS_VALIDATION_ENVIRONMENT
production: NOT_DEPLOYED
privatePreview: OPERATIONAL / CANDIDATE_DEPLOYED / POST_DEPLOYMENT_SMOKE_PASS / PUBLIC_NOT_READY
privatePreviewRelease: 05e4d696 / 05e4d696-20260915T091034Z

## Completed

- R1 Quality Gate: `APPROVED / DONE`.
- H1/H2: `WAIVED_FOR_R1 / UNVERIFIED`; no physical-device pass is claimed.
- PR #25 merged into Integration `6515b8f`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Prisma 7.9.1 with exact patched overrides and npm 11.18.0 passed local and target-host dependency, audit, SBOM and build checks.
- Private-preview deployment and post-deployment business smoke passed; disposable test data was removed with zero residue.
- Daily backup, 7-day cleanup and isolated database restore passed.
- REL-02 separate Staging was explicitly waived; no new cloud resources or fees are planned for the current scope.

## Current

UIR-02 candidate `05e4d696` is deployed to private preview and passed device acceptance. PR #41 merged as Integration `d05b25cb`; merged CI run `34952298758` passed quality, db-validation and browser-qa.

`MOBILE-C4` is integrated and passed private-preview iPhone/Android acceptance. R1.1 Web Push is active only in the existing private preview; real-device subscription, delivery, click-through, unsubscribe and re-enable are user-confirmed, and the scheduler is active. PR #38 makes empty required date-time pickers select today temporarily so confirmation is available; it is merged, CI-verified and deployed, pending device recheck.

UIR-00/01 planning and UIR-02 are integrated at `d05b25cb`. UIR-02 passed CI, private-preview smoke and device acceptance; UIR-03 has not started.

## Remaining

- Select and authorize the next bounded UI task; do not start UIR-03 automatically.
- Handle DNS, HTTPS, exact CORS and public smoke only when public entry is requested.

## Verification

- Local quality and dependency governance: `PASS`.
- Web Push MySQL 8.4.9 integration: `13 migrations / 18 files / 161 tests PASS`.
- Controlled Chromium Web Push flows and five widths: `2/2 PASS`.
- Database-backed browser smoke: `44/44 PASS`.
- Merged CI: `PASS` (PR #38 / run `34823090430`).
- Latest Integration CI: `PASS` (PR #39 / run `34824580264` at `77bedde...`).
- UI planning documentation checks: `format:check`、`check:context`、`git diff --check` `PASS`; UI implementation checks `NOT_RUN / NOT_STARTED`.
- Target Linux build/audit/SBOM: `PASS`.
- Private-preview entry, business smoke and cleanup: `PASS`.
- Backup/retention/restore: `PASS`.
- REL-03 readiness: `NOT_STARTED`.
- H8 MPL-2.0 private-preview Push review: `CLOSED` by user confirmation.
- H6 real device delivery: `PASS` (user-confirmed private-preview acceptance on 2026-09-14).
- Public entry and physical iPhone: `NOT_VERIFIED`.

## Git State

- PR #38 is merged as Integration `8bbb302`; CI run `34823090430` passed and release `8bbb3022-20260914T083606Z` is deployed. No public switch, new resource creation or Provider expansion was performed.
- PR #39 is merged as Integration `77bedde`; latest CI run `34824580264` passed.
- Local UI planning branch `codex/ui-reconstruction-baseline-refresh` is based on `77bedde...`; its documentation commit is not pushed and UIR-02 has not started.
