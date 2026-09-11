# MOBILE-B — PWA lifecycle and installation experience

## Metadata

- Contract: `MOBILE_B_PWA_LIFECYCLE_V1`
- Status: `DONE_LOCAL / DEVICE_ACCEPTANCE_PENDING`
- Branch: `codex/mobile-b-pwa-lifecycle`
- Base: Integration `6e1313fd58da8d4fc34fc7912b579571a21a9ebe`
- Predecessor: MOBILE-A `DONE_INTEGRATION / DEVICE_ACCEPTANCE_PASS`
- Commit, push, PR, merge and deployment: require their applicable authorization; no authorization is implied by this contract.

## Objective

Make the existing Vue PWA install, launch and update predictably on iPhone and Android while preserving current authentication, navigation, offline synchronization and business behavior.

## Allowed scope

- `apps/web/vite.config.ts`, `apps/web/index.html` and PWA registration/bootstrap code.
- PWA icons and manifest assets under `apps/web/public/`.
- A small installation-policy composable/store and focused UI in the existing account/profile or shell area.
- A small update-policy composable/store and update prompt.
- Existing unsaved-form and active-write signals only as read-only update-safety inputs.
- Focused unit and Playwright tests, plus documentation and state records.

## Required behavior

1. Manifest defines stable `id`, `/` scope/start URL, `standalone`, `zh-CN`, theme/background colors and 192/512/maskable icons; iPhone has a 180px Apple touch icon.
2. Installed display mode is detected without changing router history.
3. Android installation uses the captured `beforeinstallprompt`; iPhone gets concise Safari “添加到主屏幕” instructions.
4. Installation guidance is user initiated or shown only after meaningful use; dismissal is persisted with a cooldown and never blocks normal use.
5. A detected Service Worker update is presented in Chinese with “稍后/更新”. Safe updates activate and reload once.
6. Updates wait while there are unsaved changes or an active local write, then remain available for later action.
7. Update UI does not implement IndexedDB migration policy; data compatibility remains owned by the data layer.
8. Launching from the home screen, browser mode and standalone mode preserve authentication and MOBILE-A navigation behavior.

## Forbidden scope

- No second navigation stack, route renaming, directory reorganization or visual redesign.
- No changes to AI, API, database schema, sync algorithm, Push delivery or Provider configuration.
- No blanket `KeepAlive`, native wrapper, App Store/TestFlight packaging or new infrastructure.
- No forced installation prompt, forced refresh during editing, or English user-facing errors.

## Verification gates

- Manifest/icon validation and installability checks.
- Unit tests for platform/display detection, prompt capture, dismissal cooldown and update safety.
- Browser checks at 375, 390, 430, 768 and 1440 CSS px with console/network-error review.
- Existing login/logout, offline cache isolation, root-tab history, detail return and unsaved-form tests remain green.
- iPhone Safari + installed PWA: install guide, home-screen launch, update and safe defer.
- Android Chrome + installed PWA: native install prompt, home-screen launch, update and safe defer.
- Full `npm run quality` and `git diff --check` before delivery.

## Completion

MOBILE-B is complete only when implementation, automated validation and the two installed-device lifecycle checks pass. Deployment and merge remain separate actions.

## Current evidence

- Manifest contains stable id/scope/start URL, standalone display, zh-CN and 192/512/maskable PNG icons; Apple touch icon is 180×180.
- Android install capture, iPhone Chinese add-to-home guide, installed-mode detection and user-controlled update activation are implemented.
- Updates are deferred while a registered form is dirty or synchronization is active.
- Full `npm run quality` and `git diff --check` pass; Web 25 files / 129 tests and API 34 files / 281 tests pass.
- Physical iPhone and Android installed-PWA lifecycle acceptance remains pending.
