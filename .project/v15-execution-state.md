# V1.5 Execution State

updatedAt: 2026-09-12T15:03:00+08:00
snapshotKind: REPOSITORY_STATE_SNAPSHOT_NOT_REALTIME_MIRROR
mainHead: 9421d819a44a47728e6d7f6e93bfd4f98f681f24
integrationBranch: codex/v15-integration-foundation
# integrationHead is the last verified Integration ref captured by this repository-state snapshot, not a self-updating realtime branch ref.
integrationHead: e4b6567e1613f37e689429bd541b0644ab4d9657
pocBranch: codex/v15-tech-selection-poc
pocHead: abeaa6444c116a59f5c139b2f56488a2f97b53f4
currentTask: MOBILE-C3 Date and Time Controls
executionStatus: VERIFYING
deliveryStatus: DONE_LOCAL / QUALITY_PASS / GIT_AUTHORIZATION_PENDING
currentWork: shared custom temporal controls are implemented across all user-web native temporal fields; full quality passes with 31 web files and 137 tests
latestDependencyGateRecheck: 2026-09-08 exact overrides deepmerge-ts 8.0.2, mariadb 3.4.7 and mysql2 3.24.3 with Prisma 7.9.1 and npm 11.18.0 passed clean install, npm ls, zero-vulnerability audit, SBOM, governance, quality, MySQL 8.4.11 integration, browser smoke, merged CI and target-host Linux verification; scoped license handling was approved and the candidate is deployed to private preview
nextCanonicalTask: Obtain authorization to commit and push the verified MOBILE-C3 candidate and create its PR
nextCanonicalTaskAfterCompletion: MOBILE-C4 complex secondary pages
openPullRequests: []
repositoryPersistedGate: PR #25 MERGED / INTEGRATION 6515b8f / MERGED CI PASS / PRIVATE PREVIEW DEPLOYED
repositoryLandingState: DONE_COMMITTED / DONE_PUSHED / DONE_INTEGRATION / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / SUPPLY_CHAIN_PASS / POST_DEPLOYMENT_SMOKE_PASS / BACKUP_RESTORE_VERIFIED / IPHONE_WAIVED_PRIVATE_PREVIEW / PUBLIC_NOT_READY
persistedSuccessorGate: REL-03 PRIVATE PREVIEW READINESS READY / EXISTING_ENVIRONMENT; REL-02 SEPARATE_STAGING_WAIVED; R1 QUALITY GATE APPROVED

## Current Private Preview Release Assessment

- Active release: MOBILE-C2 feedback fix `b620850`, deployed at `/opt/daily-assistant-preview/releases/b6208500-20260912T0627Z`; previous `3a07d280-20260912T0608Z` remains the rollback release.
- Status: `OPERATIONAL / PRIVATE_PREVIEW_DEPLOYED / POST_DEPLOYMENT_BUSINESS_SMOKE_PASS / PUBLIC_NOT_READY`.
- Delivery: PR #25 is merged; merged CI run `34181985716` passed quality, db-validation and browser-qa. Target-host Linux build, audit 0, SBOM validation and entry-point health checks passed.
- Verified: release artifact integrity, API/user/admin/Nginx health, current database migration state, protected backup creation and temporary-database restore; daily backup timer, 7-day cleanup and cleanup logic.
- H1/H2: `WAIVED_FOR_R1 / UNVERIFIED` by explicit user approval on 2026-09-08; never treat this as physical-device pass evidence, and reassess before public support claims.
- Remaining gate: R1 Quality Gate is `APPROVED / DONE`; REL-02 requires independent resource/fee authorization. Non-sensitive readiness belongs to REL-03 under the approved REL-01 D7 boundary; public DNS/HTTPS/CORS validation belongs to the later public-entry gate. Local daily backup with 7-day cleanup is configured, and live AI is retained by explicit user decision for the private preview.
- MOBILE-B feedback-fix backup: `/opt/daily-assistant-preview/shared/backups/daily_assistant_preview_20260911T094516Z.sql.gz`.

## Active Task

- id: MOBILE-B
- displayName: PWA lifecycle and installation experience
- branch: codex/mobile-b-pwa-lifecycle
- baseHead: Integration 6e1313fd58da8d4fc34fc7912b579571a21a9ebe
- contract: tasks/MOBILE-B.md (`MOBILE_B_PWA_LIFECYCLE_V1`)
- implementation: complete Manifest/icons; Android install prompt; iPhone add-to-home guide; standalone detection; safe user-controlled Service Worker updates
- validation: full quality PASS; Web 25 files/129 tests, API 34 files/281 tests; generated Manifest/icon dimensions and SKIP_WAITING handler verified
- commit: 4d86f9086f9db68897d08e044bddb1fe8a7b30de
- delivery: PR #30 open; CI runs `34580364107` and `34580381945` passed quality, db-validation and browser-qa; private preview deployment and entry-point checks passed
- feedbackFix: `927dea3` adds visible update progress/error and an iOS reload fallback; plan center defaults to a visibly selected current date
- successorDraft: `d7860cd` adds tasks/MOBILE-C.md for staged secondary-page, dialog and date/time control refinement; it remains blocked by MOBILE-B acceptance
- feedbackValidation: CI runs `34664717946` and `34664718882` passed quality, db-validation and browser-qa; private-preview entry, API health, Manifest, Service Worker, asset and logs passed
- updateTakeover: commits `e756c0b` and `727cb60`; CI runs `34666350469` and `34666354055` pass all jobs; deployed Worker contains skipWaiting and clientsClaim, while reload remains guarded by user action
- deferredLimitations: legacy installed-client update action remains imperfect; iOS system edge navigation on root pages cannot be fully disabled by PWA code
- remaining: PR #30 merge remains separately gated; after merged Integration CI passes, start MOBILE-C1
- executionStatus: ACCEPTED_WITH_DEFERRED_LIMITATIONS
- deliveryStatus: DONE_PUSHED / PR_30_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / MERGE_AUTHORIZATION_PENDING

## Previous Canonical Task

- id: R1.1 Web Push Candidate
- displayName: minimal browser external reminders
- branch: codex/web-push-reminders-clean
- baseHead: Integration 6515b8fd0f13969a0e434d3d8223f60a82cb0310; temporarily stacked on PR #27 to keep the feature diff isolated
- currentGate: FORMAL_COMPATIBILITY_VERIFIED_LOCAL / READY_FOR_COMMIT_AND_CI / REAL_PUSH_DELIVERY_PENDING
- implementation: encrypted user-scoped subscriptions, idempotent per-device delivery records, Push API, generated PWA Service Worker extension, reminder-page permission UI and Web Push adapter
- allowedScope: PR3/PR16/PR17 minimal browser Push implementation and validation
- forbiddenScope: SMS/email, queues, production enablement, deployment and public release without independent authorization
- validation: final full quality, locked install with npm 11.18.0, lint/typecheck/unit/full tests/build/Prisma/OpenAPI, governance 30/30, audit 0 and SBOM 1055 pass; temporary MySQL 8.4.9 applied 13 migrations and passed 18 files/161 tests; controlled Chromium subscribe/restore/unsubscribe/deny and five-width checks pass; real delivery remains
- executionStatus: IN_PROGRESS
- deliveryStatus: DONE_INTEGRATION / CI_PASS / NOT_ENABLED / REAL_DELIVERY_PENDING

## Previous Active Task

- id: REL-03 Private Preview Readiness
- displayName: existing private-preview readiness and release hardening
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: 6515b8fd0f13969a0e434d3d8223f60a82cb0310
- localHead: 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e（release candidate dependency commit; state/evidence docs remain uncommitted）
- contract: PLANS.md REL-03 card as amended by the explicit separate-Staging waiver
- currentGate: R1 Quality Gate APPROVED / DONE; REL-02 SEPARATE_STAGING_WAIVED; REL-03 READY
- implementation: lightweight non-sensitive readiness and release-procedure closure on the existing private-preview environment; no new cloud resources
- allowedScope: readiness implementation and focused tests, controlled private-preview verification, and backup/deploy/health/smoke/application-rollback runbook closure
- forbiddenScope: new Staging resources or fees, Provider expansion, real user/data evaluation, public switch, production release, destructive migration and unrelated V1.5 features
- currentUserAuthorization: the user authorized candidate delivery, PR merge, scoped license handling, private-preview deployment and the H1/H2 waiver for this R1 advancement; this does not authorize REL-02 resources/fees, public switching, production deployment or Provider expansion
- validation: local quality, MySQL 8.4.11 integration 18 files/160 tests and browser smoke 44/44 passed; PR/push and merged Integration CI passed quality, db-validation and browser-qa; target Linux build, audit 0, SBOM 1043 components, dependency versions, API health and Web/Admin entry checks passed
- remaining: implement lightweight readiness and release-procedure closure on the existing private-preview environment; keep public DNS/HTTPS/CORS, broader/public Provider enablement, REL-04 and production release behind their independent gates; reconsider separate Staging for public launch, larger scale or important real data
- evidence: `docs/46-r1-webkit-emulation-validation.md` records the non-formal WebKit simulation; `docs/47-rel-01-staging-architecture-decision.md` and `docs/48-r1-approval-decision-pack.md` record the REL-01 decision; `docs/49-private-preview-release-assessment.md` records the current private preview release, backup/restore evidence and remaining blockers
- executionStatus: READY
- deliveryStatus: NOT_STARTED / R1_APPROVED / PRIVATE_PREVIEW_BASELINE_VERIFIED / PUBLIC_NOT_READY
- commits: `f7fb90a08a9f6036a0c5fbce44b674866add88eb`, `1545e213b5a5658d5ecd174f386e779491d53396`, `d649ad4c3afe10f11249ffe7cd4db0e66384c7bd`, merge `b7734d093072c400ca9ae9d44b60abb95a45a725`
- push: `origin/codex/v15-v2-ui-visual-freeze` updated through `837e9cd`
- pr: GitHub PR #25 MERGED at `6515b8fd0f13969a0e434d3d8223f60a82cb0310`; merged CI run `34181985716` passed quality, db-validation and browser-qa
- stateSyncCommit: `837e9cd64dab74ced689278ce2cddbdf0ee85bc5`; this is documentation-only and is not a reason to create another hash-chasing commit
- candidateDeployment: DONE / PRIVATE_PREVIEW_ACTIVE / release `6515b8fd-2db6b6a2f199db4c`

## Latest Release Action

- id: `PRIVATE-PREVIEW-RELEASE-CANDIDATE-01`
- displayName: Verified private-preview improvements release candidate
- deliveryStatus: `DONE_INTEGRATION / CI_PASS / PRIVATE_PREVIEW_DEPLOYED`
- scope: committed the verified web/offline-sync, AI prompt/evaluation, contracts/tests and backup/state documentation changes in logical commits; kept future feature work separate
- result: PR #25 merged into Integration `6515b8f`; the merged candidate passed CI and target-host supply-chain/build checks and is active on the private-preview server

## Latest Dependency Gate Recheck

- id: `R1-DEPENDENCY-AUDIT-SAFE-PATCH`
- displayName: Safe transitive dependency audit patch
- branch: `codex/v15-v2-ui-visual-freeze`
- scope: `package-lock.json` only; no `package.json`, business code, Prisma schema/migration, CI, deployment configuration or architecture change
- implementation: updated `fast-uri` from `3.1.5` to `3.1.7` and `qs` from `6.15.3` to `6.16.0`; both versions remain within the existing parent ranges and the lockfile remains reproducible
- validation: `npm ci` PASS; installed `fast-uri@3.1.7` and `qs@6.16.0`; governance `14/14` PASS; SBOM generation/validation `1044 components` PASS; license inventory `1163 packages` PASS; full `npm run quality` passed all stages except the fail-closed dependency audit
- result: the audit snapshot is reduced from `2 moderate / 6 high` to `1 moderate / 5 high`; the remaining Prisma 7.9.1 exact chain (`@prisma/config`/`deepmerge-ts`, `mariadb`, `mysql2`) and expired exception still block R1
- deliveryStatus: `DONE_LOCAL / DONE_COMMITTED / DONE_PUSHED / R1_STILL_BLOCKED`
- deployment: `NOT_RUN / HELD_BY_R1_QUALITY_GATE`; the private preview remains on Integration `299b1f71`

## Current Stable Prisma Dependency Recheck

- id: `R1-DEPENDENCY-STABLE-MATRIX-RECHECK`
- displayName: R1 stable Prisma dependency matrix recheck
- date: `2026-09-03 10:32 +08:00`
- scope: read-only upstream registry verification and required local release-gate checks; no dependency, audit-script, CI, architecture, schema or deployment change
- upstream stable match: `prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-mariadb@7.10.0`
- exact upstream chain: `prisma@7.10.0 -> mysql2@3.15.3, @prisma/config@7.10.0`; `@prisma/config@7.10.0 -> deepmerge-ts@7.1.5`; `@prisma/adapter-mariadb@7.10.0 -> mariadb@3.4.5`
- fixed stable packages available in the registry are outside those exact upstream declarations: `deepmerge-ts@8.0.2`, `mariadb@3.4.7` (or `3.5.4`) and `mysql2@3.24.3`
- pre-release evidence: `prisma` `latest` is `8.0.0-rc.12`; `@prisma/client`, `@prisma/adapter-mariadb` and `@prisma/config` have no matching `8.0.0-rc.12` package, and pre-release adoption is forbidden
- validation: `npm ci` PASS; `npm ls` PASS; `npm audit` FAIL (`1 moderate / 5 high`); `npm run audit` unavailable (Missing script); `npm run audit:dependencies` FAIL_CLOSED; SBOM generation/validation PASS (`1044` components); license inventory PASS (`1163` packages, `9` missing/unresolved, `25` manual review); governance `14/14` PASS; `npm run quality` FAIL only at the final dependency audit stage
- result: no complete stable upstream repair exists at this registry snapshot; `R1 Quality Gate` remains `BLOCKED / NOT_READY`
- CI/deployment: `NOT_RUN_THIS_TURN / HELD`; existing PR #25 remains open with prior `quality` failure, while `db-validation` and `browser-qa` pass; Alibaba private preview remains on Integration `299b1f71`
- deliveryStatus: `DONE_LOCAL / R1_STILL_BLOCKED / NO_DEPENDENCY_CHANGE / NO_DEPLOYMENT`

## Latest Completed Work Package

- id: R1-DEPENDENCY-AUDIT-REVIEW
- displayName: R1 dependency audit compatibility review
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8
- allowedScope: local dependency/audit/SBOM compatibility review, rollback and state/evidence documentation
- forbiddenScope: automatic exception extension, unsupported dependency override as a release fix, commit, push, PR, merge and deployment
- implementation: evaluated Prisma 7.10.0 with patched transitive candidates; the candidate made npm audit green but failed npm SBOM because Prisma exact dependency declarations became invalid; restored the pre-review dependency tree
- validation: `npm ci` with D: drive cache PASS; `npm ls` valid; governance 14/14 PASS; CycloneDX SBOM generation/validation PASS with 1044 components; license inventory PASS with 1163 packages; `npm run audit:dependencies` remains fail-closed on the known baseline advisories and expired exception
- evidence: docs/44-r1-dependency-audit-review.md
- deliveryStatus: DONE_LOCAL / UNCOMMITTED / CANDIDATE_REJECTED / R1_STILL_BLOCKED
- commit: NOT_CREATED
- push: NOT_AUTHORIZED
- prOperation: NOT_AUTHORIZED

## Previous Completed Work Package

- id: WEB-SMOKE-01
- displayName: Web smoke failure remediation and real database revalidation
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8
- allowedScope: local Web E2E launcher flag, account-close navigation guard, smoke-test URL/dialog/selector contracts, and related lint cleanup
- forbiddenScope: production Provider enablement, real user/data evaluation, Prisma/schema changes, deployment configuration, commit, push, PR, merge and deployment
- implementation: enabled the local fake AI gate for E2E only, permitted intentional post-account-close navigation, and aligned smoke assertions with query strings, native confirmations and exact status labels
- validation: Web lint, typecheck, unit `21 files / 116 tests`, build, Prettier, `git diff --check`, and full Playwright smoke `44/44 PASS` across Chromium desktop/mobile; disposable MySQL/API/Web/admin services were cleaned up after the run
- deliveryStatus: DONE_LOCAL / UNCOMMITTED / WEB_SMOKE_VERIFIED
- commit: NOT_CREATED
- push: NOT_AUTHORIZED
- prOperation: NOT_AUTHORIZED

## Last Completed Task

- id: PR20 Live Provider Validation
- displayName: PR20 Live Provider Validation
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: 299b1f71debbd5a3140d1ee19f9781372e67134b
- localHead: a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8（本机验证及 H7 关闭记录未提交）
- contract: PLANS.md PR20 card；未发现独立 PR20 Live Provider Validation 任务契约
- completion: DONE_LOCAL / H7_CLOSED
- implementation: DeepSeek adapter output constraints were corrected, vague/placeholder input rules were tightened, and a controlled local live-provider evaluation plus targeted regression was executed; business writes remained disabled
- validation: DeepSeek canary succeeded; post-hardening h7-adr027-fixed-v1 evaluation produced 199/200 schema-valid results (99.5%), effect proxy 199/200 (99.5%), positive success 184/185, uncertainty handled 15/15, client p95 latency 1644 ms, and one retained-input SCHEMA_INVALID failure; case-146 repeated 3/3 successfully; formal business counts for the evaluation user remained zero; prompt regression passed
- humanClosure: Dada explicitly closed H7 on 2026-09-01 after accepting the current provisional DeepSeek selection, Provider terms/evaluation result and ADR-029 natural-month/no-fixed-cap policy
- boundaries: Provider enablement, REL-04, R1 advancement, real user/data evaluation, production use, commit, push, PR, merge and deployment remain separate or unauthorized
- commit: NOT_CREATED
- push: NOT_AUTHORIZED
- prOperation: NOT_AUTHORIZED

- id: QUALITY-R1-GOVERNANCE-RECONCILIATION
- displayName: QUALITY-R1 Governance Reconciliation
- branch: codex/v15-integration-foundation
- baseHead: d53f84a4ff99208f69d209e98a1d3f07c588d760
- localHead: 6adc111492dcbeb35e79475a3d69f6a63007e5bb（现有治理提交）
- contract: tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md
- contractStatus: APPROVED / NORMATIVE_FREEZE_WRITTEN_LOCAL
- implementation: ADR-028 and the approved KEEP_AND_RECONCILE dispositions were written in the existing governance commit; no implementation behavior was changed
- validation: commit changed 21 Markdown files only; governance worktree clean; parent is required d53f84a; `check:context` and `git diff --check` `PASS`; H7/R1 statuses and PR19 V10 boundary remain consistent; stash unchanged
- deliveryStatus: DONE_INTEGRATION / POST_WRITE_REVIEW_PASS
- commit: 6adc111492dcbeb35e79475a3d69f6a63007e5bb
- push: existing Integration ancestry verified; no push performed in this review
- prOperation: no PR created or changed

## Previous Completed Task

- id: SYNC-E2E-01
- displayName: SYNC-E2E-01 Daily Assistant 同步真实环境验收
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8
- allowedScope: real MySQL-backed API integration verification, existing Web E2E verification, evidence and required status documentation
- forbiddenScope: API/protocol redesign, API mock substitution, Prisma/migration、database schema、unrelated Web refactor、dependency audit changes、commit、push、PR、merge、deployment
- implementation: provisioned a disposable MySQL runtime outside C:, ran the real API integration suite, and completed direct two-browser acceptance without API mocks
- validation: API integration `PASS` (17 files / 155 tests); real two-browser CRUD propagation, offline recovery, conflict resolution, second-user isolation and 375/390/430/768/1440 viewport checks `PASS`; existing Web smoke remains `22 passed / 22 failed`
- deliveryStatus: DONE_LOCAL / UNCOMMITTED / API_INTEGRATION_VERIFIED / CROSS_BROWSER_VERIFIED / OFFLINE_RECOVERY_VERIFIED / CONFLICT_VERIFIED / VIEWPORT_VERIFIED / WEB_SMOKE_NOT_GREEN
- commit: NOT_CREATED
- push: NOT_AUTHORIZED
- prOperation: NOT_AUTHORIZED

## Earlier Completed Task

- id: SYNC-01-429-BACKOFF-REMEDIATION
- displayName: SYNC-01 429 限流与失败退避修复
- branch: codex/v15-v2-ui-visual-freeze
- baseHead: a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8
- allowedScope: Web sync coordinator, sync request error status, sync notification reason and focused tests
- forbiddenScope: API/protocol redesign, database/schema/migration, dependency audit, deployment and Git delivery operations
- implementation: state notifications no longer trigger mutation flush; 429 uses a 60-second automatic cooldown, ordinary failures use exponential backoff, and manual retry bypasses the automatic cooldown
- validation: Web lint/typecheck/build `PASS`; Web unit `21 files / 116 tests PASS`; real-browser controlled 429 response scenario `PASS` with no new sync requests during a ten-second observation after manual retry
- deliveryStatus: DONE_LOCAL / UNCOMMITTED
- commit: NOT_CREATED
- push: NOT_AUTHORIZED
- prOperation: NOT_AUTHORIZED

## Task Ledger

| ID | executionStatus | deliveryStatus | Release | Dependencies/Gate | Evidence/Next |
|---|---|---|---|---|---|
| V15-CTRL-001a | DONE | DONE_INTEGRATION | R1 | none | PR #9 / `bc747b7...` |
| V15-CTRL-001 | DONE | DONE_INTEGRATION | R1 | twelve completion conditions | PR #10 / `371a43d...` verified |
| PR1 | DONE | DONE_INTEGRATION | Foundation | baseline | PR #8 |
| PR6a | DONE | DONE_INTEGRATION | R1 | V15-CTRL-001 DONE_INTEGRATION | PR #11 merged; integration `01292ef...` verified |
| AI-DECISION-001 | DONE | DONE_INTEGRATION | R1 | V15-CTRL-001; before PR2 first-layer decision | PR #12 merged; integration `c4cca65...`; CI 218 success; ADR-027 v1.0 Final Accepted |
| PR2 | DONE | DONE_INTEGRATION | R1 | V15-CTRL-001 + PR6a + AI-DECISION-001 first-layer decision | PR #13 squash merged; integration `042b2bc9...`; CI #222 SUCCESS |
| PR3 | IN_PROGRESS | DONE_LOCAL_CANDIDATE | R1.1 | PR6a | schema/migration written; MySQL validation pending |
| PR4 | PENDING | NOT_STARTED | R2 | PR6a | later |
| PR5 | DONE | DONE_INTEGRATION | R1 | PR1 + PR2 + PR6a | PR #14 squash merged；integration `9b4b685...`；CI #225 SUCCESS |
| PR6 | DONE | DONE_INTEGRATION | R1 | PR6a | PR #15 squash merged；integration `24b6a392...`；final CI #230 SUCCESS |
| PR7/PR8/PR13 | PENDING | NOT_STARTED | R2 | PLANS dependencies | later |
| PR9 | DONE | DONE_INTEGRATION | R1 | PR5 DONE_INTEGRATION | PR #16 MERGED/CLOSED；source `4017218...`；squash `3caa93b...`；CI #235/#236/#237 SUCCESS |
| PR10/PR11/PR12 | PENDING | NOT_STARTED | R3 | PLANS dependencies | later |
| PR14/PR15 | PENDING | NOT_STARTED | R2 | PLANS dependencies | later |
| PR16/PR17 | IN_PROGRESS | DONE_LOCAL_CANDIDATE / NOT_ENABLED | R1.1 | H6/H8 affect PR17 | API/SW/provider local; browser/device/CI pending |
| PR18 | DONE | DONE_INTEGRATION | R1 | PR2 + PR5 DONE_INTEGRATION | source `9bee2f8...`；PR #17 MERGED/CLOSED；Squash `7caf892...`；CI #263 SUCCESS；Integration CI #264 SUCCESS；governance-close `f90f4ea...` PUSHED；Final Acceptance/Integration ACCEPT |
| PR19 | DONE | DONE_INTEGRATION | R1 | PR18 + PR6 | GitHub PR #18 merge `c42c19ec...`; historical implementation is integrated; V10 contract scope remains unchanged |
| QUALITY-R1-GOVERNANCE-RECONCILIATION | DONE | DONE_INTEGRATION / POST_WRITE_REVIEW_PASS | Governance | Gate 2 explicit approval | ADR-028 Accepted; PR20-03A/#22 and PR20-03B/#23 `KEEP_AND_RECONCILE`; commit `6adc111...`; review PASS |
| PR20 Adapter Integration | DONE | DONE_INTEGRATION | R1 | PR19 | PR #20/#21/#22/#23; Integration HEAD `d53f84a...`; effective adapter integration fact only |
| WEB-UX-03.1 | DONE | DONE_LOCAL / UNCOMMITTED / E2E_DATABASE_UNVERIFIED | UI | WEB-UX-03 | delete confirmation, server reread, calendar/reminder tests; mocked browser PASS; DB E2E and cross-browser sync NOT_RUN |
| SYNC-01 | VERIFYING | DONE_LOCAL / UNCOMMITTED / E2E_DATABASE_VERIFIED / CROSS_BROWSER_VERIFIED | UI | SYNC-API-01 local contract fix | Web coordinator checks pass; real MySQL propagation, offline recovery and conflict evidence verified in SYNC-E2E-01 |
| SYNC-01-429-BACKOFF-REMEDIATION | DONE | DONE_LOCAL / UNCOMMITTED | UI/QA | SYNC-01; SYNC-E2E-01 429 blocker | Web 21/116 PASS; controlled browser 429 cooldown/manual retry PASS; real propagation recheck PASS |
| SYNC-API-01 | DONE | DONE_LOCAL / UNCOMMITTED / E2E_DATABASE_VERIFIED / CROSS_BROWSER_VERIFIED | API | no schema change; API contract correction | non-empty terminal cursor fixed; API/contract/Web checks and real DB integration pass; cross-browser flow verified by SYNC-E2E-01 |
| SYNC-E2E-01 | DONE | DONE_LOCAL / UNCOMMITTED / API_INTEGRATION_VERIFIED / CROSS_BROWSER_VERIFIED / OFFLINE_RECOVERY_VERIFIED / CONFLICT_VERIFIED / VIEWPORT_VERIFIED | QA | SYNC-API-01 + SYNC-01 429 remediation | real MySQL API 17/155 PASS; A/B CRUD, offline recovery, conflict resolution, second-user isolation and 375/390/430/768/1440 checks PASS; the former Web smoke blocker was resolved by WEB-SMOKE-01 |
| WEB-SMOKE-01 | DONE | DONE_LOCAL / UNCOMMITTED / WEB_SMOKE_VERIFIED | R1 prerequisite | R1 Quality Gate; local disposable MySQL | AI proposal, draft confirmation, account deletion and navigation smoke contracts repaired; full Chromium desktop/mobile smoke 44/44 PASS |
| R1-DEPENDENCY-AUDIT-REVIEW | DONE | DONE_LOCAL / UNCOMMITTED / CANDIDATE_REJECTED | R1 | R1 Quality Gate dependency gate | Prisma 7.10/override candidate rejected by SBOM; dependency tree restored; governance 14/14 and SBOM 1044 components pass; audit remains fail-closed |
| R1-WEBKIT-EMULATION-VALIDATION | DONE | DONE_LOCAL / EVIDENCE_ONLY | R1 | H1/H2 physical-device evidence | WebKit iPhone 13 simulation covered H1 flows and H2 offline create/reconnect; physical-device gates remain PARTIAL; evidence `docs/46-r1-webkit-emulation-validation.md` |
| PR20 Live Provider Validation | DONE | DONE_LOCAL / H7_CLOSED | R1 | H7 | DeepSeek local 200-case synthetic evaluation: 199/200 schema-valid; Dada closed H7 on 2026-09-01; production enablement remains separately gated |
| PR21 | PENDING | NOT_STARTED | R2 | PLANS dependencies | later |
| PR22/PR23 | PENDING | NOT_STARTED | R3 | PLANS dependencies + cleanup authorization | canonical R3 Shrink tasks; untouched; distinct from GitHub PR #22/#23 |
| REL-01 | DONE | APPROVED / REL-02_AUTHORIZATION_PENDING | R1 | V15-CTRL-001 satisfied; R1 gate still blocks execution | `docs/47-rel-01-staging-architecture-decision.md` and `docs/48` approved D1-D8; no resources; REL-02 authorization and execution details remain pending |
| R1-APPROVAL-PACKAGE-01 | DONE | DONE_LOCAL / UNCOMMITTED / APPROVED | R1 | R1 Quality Gate; REL-01 design draft | `docs/48-r1-approval-decision-pack.md` records H1/H2 and dependency evidence, approved D1-D8 and the separate REL-02 boundary |
| REL-01-DECISION-RECORD-01 | DONE | DONE_LOCAL / UNCOMMITTED / APPROVED / REL-02_AUTHORIZATION_PENDING | R1 | REL-01; R1 gate remains blocked | D1-D8 approval and REL-02 execution preflight recorded in `docs/48`; no resource, credential, deployment or real-data action |
| REL-02 | CANCELLED | SEPARATE_STAGING_WAIVED | R1 | explicit user scope decision | no new resources or fees; reconsider for public launch, larger scale or important real data |
| REL-03 | READY | NOT_STARTED / EXISTING_ENVIRONMENT | R1 | R1 approved; existing private preview | lightweight readiness and release-procedure closure without new cloud resources |
| REL-04 | BLOCKED | NOT_STARTED | R1 | REL-03 and PLANS gates | public/real-service scope remains separately gated |
| REL-05 | BLOCKED | NOT_STARTED | R1 | REL-04 | no pilot |
| REL-06 | BLOCKED | NOT_STARTED | R1 | REL-05 + release gates | no production |

## Human Gates

| Gate | Status | Blocking scope | Owner | Next action |
|---|---|---|---|---|
| H1 | WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED | private preview non-blocking; public support risk remains | Dada | no real-device execution in this release path; retain WebKit result as supporting evidence only |
| H2 | WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED | private preview non-blocking; public support risk remains | Dada | no real-device execution in this release path; retain offline-reopen warning as known limitation |
| H3 | OBSERVED_NOT_ARCHIVED | non-blocking | Dada | document limitation |
| H4 | OPEN | Android claim | Dada | device smoke |
| H5 | OPEN | non-blocking | Dada | long-term observation |
| H6 | OPEN | Push | Dada | authorized delivery test |
| H7 | CLOSED | local controlled Provider evidence, current-stage DeepSeek/terms/results and ADR-029 policy accepted; production enablement and release gates remain separate | Dada | none; closure recorded by explicit owner instruction on 2026-09-01 |
| H8 | OPEN | Push | Dada | license review |
| H9 | CLOSED | integration | Dada | none |

## Evidence

- repository: Dada-sys101/richangzhushou
- completedPRs: #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #18, #20, #21, #22, #23；#19 为无关 Preview workflow
- pr12State: MERGED
- pr12MergeCommit: c4cca65bcd2ba71d93f948bf1c8731179fbb7fad（AI-DECISION-001）
- pr18GovernanceCloseAnchor: f90f4eaff40d0859ee5eec4f8deb6959fc3ce7dd
- pr13State: MERGED
- pr13MergeCommit: 042b2bc9fb8fcb1ed4527888eb7e4489af316673（PR2）
- pr13CI: 222 SUCCESS
- pr12CI: 218 SUCCESS（quality、browser-qa、MySQL migration/DB tests）
- approvedPlanDecision: v2.1.1 Final approved by Dada on 2026-08-10
- acceptedADR: docs/adr/ADR-026-v15-release-scope-r1.md; docs/adr/ADR-027-ai-provider-evaluation-policy.md v1.0 Final
- baseline: docs/40-v15-final-development-baseline.md V1.2
- pr6aEnvironment: Node 24.16.0; npm 11.13.0; Oracle MySQL 8.4.9 loopback disposable instance
- pr6aValidation: 26 focused tests; 9 migrations; 14 files / 105 DB tests; scoped-user isolation; cleanup residual 0; evidence SHA256 verified; quality PASS
- pr2Integration: DONE_INTEGRATION；PR #13 squash merge `042b2bc9...`；CI #222 SUCCESS；schema + single migration + tests + account deletion minimal adaptation
- pr5Integration: DONE_INTEGRATION；PR #14 squash merge `9b4b685...`；CI #225 SUCCESS；shared flags + AI contracts/OpenAPI/tests
- pr6LocalImplementation: DONE_LOCAL / UNCOMMITTED；formal `validate:mysql84:ci` gate reuses PR6a validator；dependency audit remains high；deterministic License inventory + CycloneDX SBOM baseline；governance 14/14；validator safety 26/26；quality/audit PASS；local MySQL 8.4 runtime unavailable；FEATURE_FLAG_PERSISTENCE_GAP remains OBSERVED
- pr6Integration: DONE_INTEGRATION；PR #15 squash merge `24b6a392...`；final CI #230 SUCCESS
- pr9Delivery: DONE / DONE_INTEGRATION；source head `4017218ae76d19c9dbe423aac2848e20fee36490`；PR #16 MERGED/CLOSED；squash merge `3caa93bbc9127c9fee42da9c440f9db9b37436d3`；final PR CI #235/#236 SUCCESS；Integration CI #237 SUCCESS
- pr9ReconnectRuntime: PASS；CI #234 run ID `31775740446`；browser-qa 24 tests PASS；`V1PlainRepository preserves IndexedDB v1 parity across reload` and `offline task create reconnects once and converges local and server state` PASS on chromium-desktop and chromium-mobile
- pr9SecurityCorrection: one-time explicitly authorized lockfile-only exception；`nanoid` 3.3.17 -> 3.3.18；commit `91912de05abdf3ef5851b181697476392de79a1e`；CI #233/#234 SUCCESS；audit vulnerabilities 0；does not expand future dependency authorization
- pr9BranchDeletion: NOT_AUTHORIZED / NOT_DONE
- pr17State: MERGED / CLOSED；pr17SourceHead: `9bee2f8fb1401caaeebff96912a21e01e57c655c`；pr17MergeCommit: `7caf892022c9bb6833c7316893bfddeb169b7243`
- pr18Implementation: completed；implementation commit `f574a79...`；source HEAD `9bee2f8...`; branch pushed
- pr18SourceCI: CI #263 / run `32122546919` SUCCESS
- pr18IntegrationCI: CI #264 / run `32204580996` SUCCESS；event `push`; head branch `codex/v15-integration-foundation`; head SHA `7caf892...`; quality、browser-qa、db-validation all passed
- pr18FinalAcceptance: ACCEPT；P0/P1/P2 none
- pr18Integration: DONE_INTEGRATION
- pr18ScopeDeviationAuthorization: CONTRACT_CHANGE_REQUIRED -> KEEP_AND_AUTHORIZE；SCHEMA_CHANGE_REQUIRED -> AUTHORIZED MINIMAL SLICE；PR4 full management = DEFERRED / NOT AUTHORIZED IN PR18
- pr18H05: scoped `deepmerge-ts` / `GHSA-ggr8-5vv4-36mx` exception at `7.1.5` expires `2026-09-01T23:59:00+08:00`；focused tests `32/32` PASS
- governanceSync (historical): PR18 governance-close commit `f90f4ea...` is PUSHED; verification is ACCEPT / PASSING; it is not the current or next active gate
- pr19Contract: `PR19_TASK_CONTRACT_DRAFT_V10`; `PR19-CONTRACT-REVIEW09 = ACCEPT`; `V10 / FROZEN / GPT_ACCEPT`; historical implementation `DONE / DONE_INTEGRATION`; V10 normative scope unchanged
- pr19Integration: GitHub PR #18 merge `c42c19ecb606893b1384fab4a13af2afb6b9981c`
- pr20Integration: adapter foundation/configuration/DeepSeek/OpenAI via PR #20/#21/#22/#23; Integration HEAD `d53f84a4ff99208f69d209e98a1d3f07c588d760`; adapter integration `DONE_INTEGRATION`; live Provider validation `DONE_LOCAL / H7_CLOSED`
- h7Runtime: local disposable MySQL 8.4.11 runtime at `D:\daily-assistant-runtime`, database `daily_assistant_h7_20260901`; no repository environment file was changed; runtime services were stopped after validation
- h7ProviderPreflight: DeepSeek model list exposed `deepseek-v4-flash`, `deepseek-v4-pro`, and `deepseek-v4-flash-vision-exp`; only `deepseek-v4-flash` was evaluated
- h7CanaryPilot: local canary succeeded; controlled 10-case pilot was 10/10 successful with 779–1544 ms latency and 2 expected uncertainty cases
- h7Evaluation: reproducible dataset `h7-adr027-fixed-v1`, 200 total (`Finance/Transaction=60`, `Task=40`, `Calendar=35`, `Reminder=30`, `Trip=20`, `Ambiguous/missing/failure=15`); 199 provider requests accepted, 199 schema-valid, schema success `99.5%`; effect proxy `199/200=99.5%` with positive success `184/185` and uncertainty handled `15/15`; server latency 658–2262 ms, average 1182 ms, p95 1589 ms; client latency 712–2317 ms, average 1236 ms, p95 1644 ms; one `case-146` Reminder HTTP 502 / `SCHEMA_INVALID` was rechecked 3/3 successfully
- h7DatabaseEvidence: 200 DeepSeek attempts (`SUCCEEDED=199`, `FAILED=1`, `SCHEMA_INVALID=1`), 199 pending-review proposals, failed input retained 1/1; evaluation-user formal counts all zero (`transactions=0`, `tasks=0`, `calendar_events=0`, `reminders=0`, `trips=0`)
- h7Safety: `v15.ai.businessWrite=false`; final confirmation returned HTTP 403 `AI_DISABLED`; no formal business write occurred; raw Provider response was not persisted or logged
- h7CodeChange: DeepSeek prompt contract correction and focused assertions in `apps/api/src/ai/deepseek-provider/deepseek-ai-provider.adapter.ts` and `.test.ts`; no secret or raw response was added
- h7Report: `docs/43-pr20-h7-live-provider-validation.md`; reproducible evaluator `apps/api/src/cli/h7-live-provider-evaluation.ts`; API lint/typecheck/unit/build and adapter focused tests passed; Dada accepted provisional DeepSeek, current terms and evaluation result; ADR-029 records the temporary natural-month/no-fixed-cap policy
- h7Closure: H7 was explicitly closed by Dada on 2026-09-01 after review of the redacted H7 report; this closes the validation gate only and does not authorize production Provider enablement, REL-04 or R1 advancement
- h7TargetedTriage: after prompt hardening, synthetic `买东西` and `帮我处理一下` returned normalized confidence `0.0000` with empty fields and clarification; specific `周五下午五点前提交周报` returned `title/dueAt/priority` with confidence `0.9000`; full post-hardening evaluation passed provisional schema/effect targets, with `case-146` retained as an accepted random-failure evidence sample
- currentRemoteIntegrationHeadChecked: `299b1f71debbd5a3140d1ee19f9781372e67134b` from `git ls-remote origin refs/heads/codex/v15-integration-foundation` on 2026-08-31; this supersedes the prior snapshot baseline for current-state reporting and does not rewrite historical PR20 evidence
- sync01LocalValidation: Web lint/typecheck/unit/build, Prettier, `git diff --check`, and `npm run check:context` passed; real-browser login/refresh smoke passed; SYNC-API-01 locally resolves the terminal cursor gap and SYNC-E2E-01 verified real DB propagation
- syncApi01LocalValidation: API lint/typecheck/build, API unit 32 files / 277 tests, WP7 integration 17 files / 155 tests, OpenAPI lint, contract tests 151/151, Web sync 2 files / 15 tests, `npm run check:context`, `npm run format:check`, and `git diff --check` passed; root `npm run quality` failed at the existing dependency audit for `@prisma/adapter-mariadb` and `mariadb`
- syncE2e01EnvironmentCheck: `npx` and Playwright 1.62.1 are available; a disposable MySQL 8.4.11 ZIP runtime was used under `D:\daily-assistant-runtime` (outside C:); the launcher migrated `daily_assistant_e2e`, bootstrapped the E2E admin and started API/Web/admin successfully; runtime services and browser sessions were stopped after acceptance
- syncE2e01Validation: API integration `PASS` (17 files / 155 tests); existing Playwright smoke remains `22 passed / 22 failed` (AI proposal, capture draft, deletion and navigation selector failures); two independent real browser sessions completed task create/edit/delete/restore propagation with all observed sync and mutation requests returning 200
- syncE2e01Offline: browser A created a task while offline with a local pending ID; direct API lookup confirmed no server row; after reconnect the queue converged to a server ID and browser B received the task; pending state cleared
- syncE2e01ConflictIsolationViewport: simultaneous offline edits produced a real `VERSION_CONFLICT`; the conflict page displayed local/server versions and “保留服务端” resolved it; a second user saw no first-user data; 375/390/430/768/1440 widths had no horizontal overflow
- syncE2e01BrowserHealth: after clearing logs, both test browsers had zero console errors/warnings; filtered sync/task requests returned 200; MySQL/API/Web/admin services were cleaned up after the run
- syncE2e01Blocker: no scoped SYNC-E2E-01 blocker remains; WEB-SMOKE-01 full Chromium desktop/mobile smoke is 44/44; root `npm run quality` remains blocked by the existing dependency audit
- integrationCI33043413216: head `d53f84a…`; `quality`/`db-validation`/`browser-qa` SUCCESS；artifacts `supply-chain-governance` and `pr6a-mysql84-evidence`; Playwright report upload skipped
- governanceReconciliation: ADR-028 `Accepted`; PR20-03A/#22 and PR20-03B/#23 deviations `KEEP_AND_RECONCILE`; existing commit `6adc111492dcbeb35e79475a3d69f6a63007e5bb` contains only the 21 authorized Markdown files and post-write review is PASS
- governanceCI: run `33048729907` for `6adc111...` has `quality`, `db-validation`, and `browser-qa` SUCCESS; latest Integration run `33147816383` for `299b1f7...` also has all three jobs SUCCESS; Playwright report upload was skipped
- currentGate: `R1 QUALITY GATE APPROVED / DONE`; H7 `CLOSED`; H1/H2 `WAIVED_FOR_R1 / UNVERIFIED`; REL-02 separate Staging waived; REL-03 readiness is current
- readOnlyGatePersistenceRule: REPOSITORY_PERSISTED_GATE is the last materialized repository write checkpoint; PERSISTED_SUCCESSOR_GATE is its immediate expected orchestration gate; GPT_ACTIVE_GATE is externally controlled. A read-only Review may consume the successor without mutation; it may remain until a later authorized Write Gate materializes new state. GPT Active Gate differing from the persisted checkpoint or advancing beyond a consumed successor is not, by itself, a state inconsistency; a Review must not REQUEST_CHANGES solely for either fact. A successor is inconsistent only if already stale when its checkpoint was produced.
- staging: SEPARATE_STAGING_WAIVED / EXISTING_PRIVATE_PREVIEW_IS_VALIDATION_ENVIRONMENT
- production: NOT_DEPLOYED

## Last Verified

- liveFactsChecked: origin Integration `codex/v15-integration-foundation` resolves to `299b1f71debbd5a3140d1ee19f9781372e67134b`; active branch is pushed at `b7734d093072c400ca9ae9d44b60abb95a45a725`; historical PR #23 evidence remains `d53f84a...`; PR #18/PR19 canonical delivery is `c42c19ec...` / `DONE_INTEGRATION`; PR #19 is unrelated Preview workflow
- pr20HistoryChecked: PR #20 `c7914cfe...`, PR #21 `6c903073...`, PR #22 `7445ba3...`, PR #23 `d53f84a...` all MERGED into Integration; this is adapter integration evidence, not H7 evidence
- integrationCI33043413216: `quality`, `db-validation`, `browser-qa` SUCCESS；`supply-chain-governance` and `pr6a-mysql84-evidence` artifacts exist；Playwright report upload skipped
- governanceCI33048729907: commit `6adc111...`; `quality`, `db-validation`, `browser-qa` SUCCESS；Playwright report upload skipped
- latestIntegrationCI33147816383: commit `299b1f7...`; `quality`, `db-validation`, `browser-qa` SUCCESS；Playwright report upload skipped
- governanceReviewWorktreeChecked: independent worktree `D:\daily-assistant-worktrees\quality-r1-governance-draft-write`; branch `codex/v15-integration-foundation`; HEAD exact `6adc111492dcbeb35e79475a3d69f6a63007e5bb`; parent exact `d53f84a4ff99208f69d209e98a1d3f07c588d760`; checkout clean; 21 changed files are all authorized Markdown; `stash@{0}` remains `36039201ec2a4b6100eca4dcb4d77138d35be801`
- pr20-03aWorktreeCheck: Git worktree registry contains no `pr20-03a` path and `D:\daily-assistant-worktrees\pr20-03a` is absent; no current registered PR20-03A worktree was modified, but the historical path cannot be independently verified from the current filesystem
- currentLocalValidation: SYNC-API-01 API lint/typecheck/build, API unit 32 files / 277 tests, WP7 real MySQL integration 17 files / 155 tests PASS, OpenAPI/contract tests, Web sync 2 files / 15 tests, Web unit 21 files / 116 tests, WEB-SMOKE-01 full Chromium desktop/mobile smoke 44/44, real two-browser/offline/conflict/isolation/viewport acceptance, current Web lint/typecheck/build, Prettier, `npm run check:context`, and `git diff --check` PASS; root `npm run quality` remains FAIL only at the existing dependency audit for unapproved high/critical `@prisma/adapter-mariadb`, `mariadb` and `mysql2`; release candidate commits are pushed and PR #25 was opened; no candidate deployment was performed
- releaseCandidateIntegration: merged `origin/codex/v15-integration-foundation` `299b1f71` into the candidate branch to remove PR conflicts; resolved files retain the candidate's verified V2 navigation, planner detail, return-context, offline-sync and simplified UI behavior; duplicate `/records` and `/plan` routes introduced by the automatic merge were removed and the complete quality sequence was rerun
- releaseCandidateCi: PR #25 final PR-event run `33615692992` and push run `33615690127` both have `db-validation` PASS and `browser-qa` PASS; `quality` FAIL_CLOSED at dependency audit; PR is MERGEABLE but UNSTABLE until the dependency gate is fixed
- r1ApprovalPackage01Validation: `npm run check:context`, `npm run format:check`, and `git diff --check` PASS; no business, database, browser, dependency-audit, SBOM, license, deployment, or resource tests were repeated in this document-only task
- dependencyAuditReview: candidate Prisma 7.10.0 plus patched transitive versions was rejected because npm SBOM marked exact Prisma dependency declarations invalid; candidate was reverted; the later safe lockfile-only patch updated `fast-uri` 3.1.5->3.1.7 and `qs` 6.15.3->6.16.0; `npm ls` is valid, governance is 14/14, SBOM generation/validation is PASS with 1044 components, license inventory is PASS with 1163 packages, and `npm run audit:dependencies` remains fail-closed on 1 moderate and 5 high core findings; evidence is `docs/44-r1-dependency-audit-review.md`
- dependencyAuditSafePatch: `package-lock.json` only; no package declaration, business code, architecture or deployment change; full `npm run quality` passes every stage except the dependency audit; no candidate deployment was performed
- h7CurrentValidation: focused DeepSeek adapter test 1 file / 6 tests, API lint/typecheck/unit/build PASS; post-hardening local synthetic evaluation `h7-adr027-fixed-v1` 200 total with 199 schema-valid (99.5%), effect proxy 199/200, one retained-input `SCHEMA_INVALID` failure and client p95 1644 ms; case-146 targeted regression 3/3 PASS; formal business write isolation PASS; H7 CLOSED by Dada on 2026-09-01; no commit/push/PR/deploy was created
- snapshotRule: GitHub/Git/CI/environment facts override this snapshot; synchronize only at the next legal governance update point without creating a CI loop; the release-candidate commit/push/PR facts above are the current authorized delivery action, while deployment remains held by the red quality gate

## Recovery Rules

1. Read `PLANS.md`, then this snapshot; verify GitHub/Git/CI/environment before action.
2. Obey explicit `nextCanonicalTask` after dependency/gate validation; do not choose a random READY task.
3. V15-CTRL-001、PR6a、AI-DECISION-001、PR2、PR5、PR6、PR9、PR18、PR19 均为
   `DONE_INTEGRATION`；PR18 functional merge SHA 为
   `7caf892022c9bb6833c7316893bfddeb169b7243`；PR19 GitHub PR #18 merge SHA 为
   `c42c19ecb606893b1384fab4a13af2afb6b9981c`。PR20 adapter slices #20/#21/#22/#23
   也已进入 Integration；PR20 live Provider validation 当前为 `VERIFYING / DONE_LOCAL`，
   H7 已由 Dada 于 2026-09-01 明确关闭；Provider enablement 与 R1 仍受独立门禁约束。
4. Live Integration ref must be re-read from Git/GitHub before any future write action;
   current verified value is `299b1f71debbd5a3140d1ee19f9781372e67134b`.
5. At most one canonical task may be IN_PROGRESS; do not auto-parallelize.
6. Human gates may only be closed by a human based on evidence.
7. The earlier H7 closure update did not authorize commit, push, PR metadata update, Ready,
   merge, rebase, reset, cherry-pick, force, real-user/production AI credential/data evaluation,
   Provider enablement, deployment, or resource creation. The user later explicitly authorized the
   current release-candidate commits, push, PR creation and conflict reconciliation. That authorization
   does not authorize bypassing the failed dependency gate, public Provider enablement, production use,
   or changes to ADR-026/027 normative content.
8. PR19 V10 remains `FROZEN / GPT_ACCEPT` and its normative scope is unchanged;
   historical implementation delivery is `DONE / DONE_INTEGRATION`. PR20 Adapter
   Integration is a historical `DONE_INTEGRATION` fact; PR20 Live Provider Validation
   is `DONE_LOCAL / H7_CLOSED`; R1 Quality Gate is `APPROVED / DONE`.
9. ADR-028 is `Accepted`; PR20-03A/#22 and PR20-03B/#23 deviations are
   `KEEP_AND_RECONCILE`. Canonical R3 PR22/PR23 remain untouched.
10. Existing Gate 2 write is committed as `6adc111...` and its post-write review is complete.
     The current authorized release action is recorded by commits `f7fb90a`, `1545e21`, `d649ad4`
     and merge `b7734d0`; the branch is pushed and PR #25 is open. No candidate deployment or
     Provider expansion was performed while the quality gate remains red.
11. READ_ONLY_GATE_PERSISTENCE_RULE: REPOSITORY_PERSISTED_GATE is the last
   repository write checkpoint materialized into governance files;
   PERSISTED_SUCCESSOR_GATE is its immediate expected orchestration gate; and
   GPT_ACTIVE_GATE is externally controlled. A Write Gate records both the
   checkpoint and successor. A read-only Review may consume the successor
   without mutation, and it may remain until a later authorized Write Gate
   materializes new state. Do not REQUEST_CHANGES solely because GPT Active
   Gate differs from the checkpoint or advanced beyond a consumed successor. A
   successor is inconsistent only if it was already stale when produced.
12. Snapshot/live-fact mismatch is reconciled at the next legal governance update;
   never create an infinite CI synchronization loop.

## 2026-09-08 — Prisma candidate delivery authorization

- 用户明确授权继续候选提交、推送及 CI；不包含 merge、部署或 R1 门禁关闭。
- 本次交付仅包含 15 个已审阅的依赖、工具链、安装治理、CI、测试及 README 文件；原有 15 个混合 Markdown 修改保留本地，不混入候选提交。
- 提交前治理测试 30/30、git diff --check 与 staged diff 检查通过。许可证人工结论和发布环境证据仍待完成。
- Delivery: DONE_COMMITTED / DONE_PUSHED / CI_PASS；commit 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，parent 1b8354575cc195584af5ee3b1fe8882eda8c3bdd；PR #25 已自动更新；PR CI 34181552275、push CI 34181550054 均 SUCCESS；各自 quality、db-validation、browser-qa 全部 PASS。此条覆盖前文候选 UNCOMMITTED / CI_NOT_RUN 的历史快照；R1 仍 BLOCKED / NOT_READY。

## 2026-09-08 — PR25 merge and scoped license decision

- 用户明确接受本次许可证处理方案：保留第三方许可证和版权声明，不修改第三方库源码，按实际交付内容核对工具链组件；对外分发后端包/容器或修改库时重新评审。此为当前范围的人工决定，不是对任意未来分发的法律批准。
- 用户独立授权合并 PR #25；已匹配 candidate HEAD 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，并核验 PR/push 两轮 quality、db-validation、browser-qa 全绿。
- PR #25 于 2026-09-08T03:00:13Z MERGED；merge commit 6515b8fd0f13969a0e434d3d8223f60a82cb0310，远端 codex/v15-integration-foundation HEAD 已一致核验。Candidate delivery: DONE_INTEGRATION。合并后 CI 34181985716 SUCCESS，quality、db-validation、browser-qa 全部 PASS：https://github.com/Dada-sys101/richangzhushou/actions/runs/34181985716 。
- 本记录覆盖前文 PR_OPEN、候选 UNCOMMITTED/CI_NOT_RUN 和 LICENSE_APPROVAL_PENDING 的历史快照；本地原有 15 个混合 Markdown 修改保留，当前工作分支不切换，不额外提交记录。
- R1 仍 BLOCKED / NOT_READY：实际发布包许可证声明、目标环境差异与部署验收尚未完成。本次未授权或执行部署、真实数据库迁移、公网切换或发布门禁关闭。

## 2026-09-08 — Release bundle preparation

- 基于已合并且 CI 全绿的 6515b8fd0f13969a0e434d3d8223f60a82cb0310，在 D:/daily-assistant-release-6515b8f 导出精确源码并完成独立 npm 11.18.0 安装（audit 0）、Prisma generate、全部 workspace build/PWA、SBOM 1043 components 校验和许可证清单。
- 准备包：D:/daily-assistant-release-6515b8f/daily-assistant-6515b8f-preparation.tar.gz；说明与逐文件校验：bundle/RELEASE-README.md、bundle/SHA256SUMS.txt。LOCAL_BUNDLE_PREPARED / TARGET_ENVIRONMENT_UNVERIFIED / NOT_DEPLOYED。
- 许可证原文收集覆盖 Windows 已安装包中的 1051/1083；32 包无顶层许可证文件，不能推定无许可或替换通用文本。Linux 原生依赖未打包，最终 Linux 包须按锁文件重建并核对实际交付 notices。
- 相比原服务器基线 299b1f71，Prisma schema/migrations 无变化。未操作服务器、读取真实凭据、执行数据库迁移或部署。下一步只读核对目标路径、Node/npm、数据库实际 transport、代理和备份；不要为未使用的 TLS/代理构造额外门禁。
- 原有 15 个 Markdown 修改保留，当前源码包不含它们；本次无新提交或推送。R1 保持 BLOCKED / NOT_READY。
## 2026-09-08 — Private-preview deployment attempt paused

- 用户授权按已审阅方案部署 `6515b8fd0f13969a0e434d3d8223f60a82cb0310`。只读 preflight 通过后，源码上传至 `/opt/daily-assistant-preview/artifacts/daily-assistant-source-6515b8f.tar`，并创建隔离目录 `/opt/daily-assistant-preview/releases/6515b8fd-preparing`。
- 隔离 npm 11.18.0 安装成功。首次依赖安装因 PATH 使用系统 Node 22 被精确 engine 正确拒绝；改为服务使用的 Node 24.19 后重试，但 SSH 在安装期间停止返回 banner，无法确认构建是否完成或清理残留进程。
- 公网首页和 `/api/v1/health` 在暂停前后持续返回 200。未切换 `current`、未重启 API/Nginx/MySQL、未执行 migration、未修改域名或功能开关。服务器仍应视为运行 `299b1f71`，候选部署状态为 `PAUSED_BEFORE_SWITCH / SSH_UNAVAILABLE`，R1 保持 `BLOCKED / NOT_READY`。

## 2026-09-08 — Private-preview deployment completed

- SSH 恢复后确认主机未发生 OOM；此前失败由受控构建单元内约 300 MiB 的 V8 堆限制导致。改用 Node 24.19.0、npm 11.18.0、512 MiB Node 堆并串行构建后，API、Web、Admin 全部通过。
- Linux 候选完成 audit 0、SBOM 1043 components 校验和许可证清单；实际版本为 Prisma/Client/Adapter 7.9.1、deepmerge-ts 8.0.2、mariadb 3.4.7、mysql2 3.24.3。
- 私有预览 `current` 已切换至 `/opt/daily-assistant-preview/releases/6515b8fd-2db6b6a2f199db4c`。API、用户端与管理端均返回 200，服务 active，切换后 warning/error 日志为空。
- 未执行 migration、MySQL/Nginx 配置变更、域名扩展或 Provider 开关变更。状态为 `DONE_INTEGRATION / PRIVATE_PREVIEW_DEPLOYED`；R1 仍为 `BLOCKED / NOT_READY`。

## 2026-09-08 — Post-deployment gate reconciliation

- 私有预览真实业务 smoke 已通过并完成测试数据清理；依赖、许可证当前范围决定、合并 CI、目标 Linux 构建/SBOM/audit、部署和部署后业务验证不再是阻塞项。
- `/api/v1/health` 是存活探针；数据库检查位于需管理员认证的 `/api/v1/admin/health`。批准的 REL-01 D7 已将非敏感 readiness 或受控运维组合的实现归入 REL-03，因此不把该实现倒置为 REL-02 的前置条件。当前私有预览已有服务启动前数据库检查、存活探针和真实业务 smoke 组合证据。
- 用户随后明确批准 H1/H2 对本次 R1 advancement 豁免；H1/H2 更新为 `WAIVED_FOR_R1 / UNVERIFIED`，R1 Quality Gate 更新为 `APPROVED / DONE`。进入 REL-02 仍需要独立资源/费用授权；公网 DNS、HTTPS、精确 CORS 与公网复验只阻塞公网入口，Provider 扩展、REL-04 和生产发布继续各自走独立门禁。

## 2026-09-08 — R1 advancement approved

- 用户明确批准将 H1/H2 豁免扩展到本次 R1 advancement；H1/H2 保持未验证，不记为物理 iPhone 通过。
- 中间状态：R1 Quality Gate 更新为 `APPROVED / DONE` 后，canonical task 曾短暂转为 `REL-02 Authorization / BLOCKED / RESOURCE_FEE_AUTHORIZATION_PENDING`；该状态随后被独立 Staging 豁免决定覆盖。

## 2026-09-08 — Separate Staging waived

- 用户明确决定不建设独立 Staging。REL-02 更新为 `CANCELLED / SEPARATE_STAGING_WAIVED`，不创建新 ECS、托管 MySQL、OSS、域名、监控或其他付费资源。
- 现有 Alibaba 私有预览作为验证环境；当前 canonical task 转为 `REL-03 Private Preview Readiness / READY`，仅在现有环境完成轻量 readiness 与发布流程收口。公网、生产、Provider 扩展及未来扩容场景仍需独立门禁，并应重新评估独立 Staging。
