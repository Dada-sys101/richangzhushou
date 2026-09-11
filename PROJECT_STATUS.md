# Project Status

updatedAt: 2026-09-11T15:48:00+08:00
repository: Dada-sys101/richangzhushou
mainHead: 9421d819a44a47728e6d7f6e93bfd4f98f681f24
integrationBranch: codex/v15-integration-foundation
integrationHead: be9d89927aa39abe867e1df5594588bafda3b8cc
activeBranch: codex/mobile-a-navigation-shell
activeHead: fa0ee53
activeTask: MOBILE-A PWA Navigation and Mobile Shell
executionStatus: VERIFYING
deliveryStatus: DONE_PUSHED / PR_29_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PENDING
nextCanonicalTask: MOBILE-A physical-device acceptance
nextCanonicalTaskAfterCompletion: MOBILE-B PWA lifecycle and installation experience
localRevision: COMMITTED_AND_PUSHED_MOBILE_A
staging: SEPARATE_STAGING_WAIVED / EXISTING_PRIVATE_PREVIEW_IS_VALIDATION_ENVIRONMENT
production: NOT_DEPLOYED
privatePreview: OPERATIONAL / CANDIDATE_DEPLOYED / POST_DEPLOYMENT_SMOKE_PASS / PUBLIC_NOT_READY
privatePreviewRelease: fa0ee53 / fa0ee530-20260911T0738Z

## Completed

- R1 Quality Gate: `APPROVED / DONE`.
- H1/H2: `WAIVED_FOR_R1 / UNVERIFIED`; no physical-device pass is claimed.
- PR #25 merged into Integration `6515b8f`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Prisma 7.9.1 with exact patched overrides and npm 11.18.0 passed local and target-host dependency, audit, SBOM and build checks.
- Private-preview deployment and post-deployment business smoke passed; disposable test data was removed with zero residue.
- Daily backup, 7-day cleanup and isolated database restore passed.
- REL-02 separate Staging was explicitly waived; no new cloud resources or fees are planned for the current scope.

## Current

`MOBILE-A` has passed unit, browser and CI acceptance and is deployed to the existing environment. HTTP authentication failures now close the session without restoring prior-user cache; logout waits for IndexedDB cleanup and removes the last-user marker. Installed PWA updates activate and refresh open clients automatically. Physical iPhone edge-swipe and Android system-back checks remain; Web Push remains disabled pending its separate real-delivery gate.

## Remaining

- Implement and test readiness success and dependency-failure behavior.
- Verify readiness on the existing private-preview server under the applicable deployment authorization.
- Reassess the reduced REL-04 scope after REL-03.
- Handle DNS, HTTPS, exact CORS and public smoke only when public entry is requested.
- Keep production release and broader Provider use behind independent decisions.
- Reassess separate Staging for public launch, larger scale or important real data.

## Verification

- Local quality and dependency governance: `PASS`.
- Web Push MySQL 8.4.9 integration: `13 migrations / 18 files / 161 tests PASS`.
- Controlled Chromium Web Push flows and five widths: `2/2 PASS`.
- Database-backed browser smoke: `44/44 PASS`.
- Merged CI: `PASS`.
- Target Linux build/audit/SBOM: `PASS`.
- Private-preview entry, business smoke and cleanup: `PASS`.
- Backup/retention/restore: `PASS`.
- REL-03 readiness: `NOT_STARTED`.
- Public entry and physical iPhone: `NOT_VERIFIED`.

## Git State

- Functional fix `fa0ee53` is committed and pushed; this state reconciliation is pending its documentation commit.
- PR #29 remains open and unmerged.
- Existing private-preview deployment was authorized and completed; no public switch, new resource creation or Provider expansion was performed.
