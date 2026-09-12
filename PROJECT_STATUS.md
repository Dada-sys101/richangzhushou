# Project Status

updatedAt: 2026-09-12T16:20:00+08:00
repository: Dada-sys101/richangzhushou
mainHead: 9421d819a44a47728e6d7f6e93bfd4f98f681f24
integrationBranch: codex/v15-integration-foundation
integrationHead: e4b6567e1613f37e689429bd541b0644ab4d9657
activeBranch: codex/mobile-c3-date-time-controls
activeHead: b18b91d
activeTask: MOBILE-C3 Date and Time Controls
executionStatus: ACCEPTED
deliveryStatus: DONE_PUSHED / PR_33_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PASS / MERGE_AUTHORIZATION_PENDING
nextCanonicalTask: Obtain authorization to merge accepted MOBILE-C3 PR #33 into Integration
nextCanonicalTaskAfterCompletion: MOBILE-C4 complex secondary pages
localRevision: b18b91d
staging: SEPARATE_STAGING_WAIVED / EXISTING_PRIVATE_PREVIEW_IS_VALIDATION_ENVIRONMENT
production: NOT_DEPLOYED
privatePreview: OPERATIONAL / CANDIDATE_DEPLOYED / POST_DEPLOYMENT_SMOKE_PASS / PUBLIC_NOT_READY
privatePreviewRelease: b18b91d / b18b91d0-20260912T0735Z

## Completed

- R1 Quality Gate: `APPROVED / DONE`.
- H1/H2: `WAIVED_FOR_R1 / UNVERIFIED`; no physical-device pass is claimed.
- PR #25 merged into Integration `6515b8f`; merged CI run `34181985716` passed quality, db-validation and browser-qa.
- Prisma 7.9.1 with exact patched overrides and npm 11.18.0 passed local and target-host dependency, audit, SBOM and build checks.
- Private-preview deployment and post-deployment business smoke passed; disposable test data was removed with zero residue.
- Daily backup, 7-day cleanup and isolated database restore passed.
- REL-02 separate Staging was explicitly waived; no new cloud resources or fees are planned for the current scope.

## Current

`MOBILE-C2` is merged at Integration `e4b6567`. `MOBILE-C3` PR #33 HEAD `b18b91d` passed both CI matrices and is running in private preview. Date/month/date-time control acceptance on iPhone and Android remains.

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

- MOBILE-B functional commit `4d86f90` is committed and pushed; this state reconciliation is pending its documentation commit.
- PR #30 remains open and unmerged; PR #29 is merged at Integration `6e1313f`.
- Existing private-preview deployment was authorized and completed; no public switch, new resource creation or Provider expansion was performed.
