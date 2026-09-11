# MOBILE-A — PWA navigation and mobile shell

## Contract metadata

- Contract: `MOBILE_A_NAVIGATION_SHELL_V1`
- Contract status: `APPROVED / ACTIVE`
- Approved by user: 2026-09-11
- Required base: latest `codex/v15-integration-foundation`
- Working branch: `codex/mobile-a-navigation-shell`
- Previous task: `R1.1 Web Push Candidate` (`DONE_INTEGRATION` through PR #28; real delivery remains a separate disabled gate)
- Commit authorization: `NOT_GRANTED`
- Push / PR authorization: `GRANTED_AND_CONSUMED` on 2026-09-11
- Deployment authorization: `GRANTED_AND_CONSUMED` for the existing private-preview environment on 2026-09-11
- Merge authorization: `NOT_GRANTED`

## 1. Objective

Make the existing Vue PWA navigation behave predictably like a mobile application while retaining Browser History as the only navigation history source. Root-tab switching must not accumulate tab history; business pages must retain normal browser navigation, deep links must receive a deterministic business fallback, and application back controls must agree with browser/system back behavior.

## 2. Allowed scope

- `apps/web/src/router.ts`
- `apps/web/src/navigation-policy.ts` and its focused tests
- `apps/web/src/utils/navigation.ts` and its focused tests
- `apps/web/src/components/BottomNav.vue` and focused tests
- `apps/web/src/components/PageHeader.vue` and focused tests
- `apps/web/src/components/SiteHeader.vue` and focused tests
- `apps/web/src/main.ts` only if needed to initialize navigation policy
- `apps/web/src/styles.css` only for `100dvh`, safe-area, or navigation-shell corrections
- `apps/web/index.html` only for `viewport-fit=cover`
- `tests/e2e/navigation-shell.spec.ts` and focused navigation test support
- `playwright.config.ts` only to add a missing required viewport project
- This contract and required project state/progress/changelog mirrors

## 3. Forbidden scope

- A second or custom application navigation stack
- `popstate` interception that competes with Vue Router or Browser History
- AI behavior, sync algorithms, API contracts, database models or migrations
- Service Worker, Web Push, notification delivery or feature flags
- Broad route renaming, page-directory reorganization, visual redesign or unrelated refactoring
- Deployment, production configuration, public access, commit, push, PR or merge without separate authorization

## 4. Navigation policy

Routes are classified as:

- `ROOT_TAB`: Home, Records, Plan, Account
- `STACK_PAGE`: business collections and settings pages
- `DETAIL_PAGE`: task, calendar, reminder and trip detail pages
- `FLOW_PAGE`: login, create, edit, capture and proposal review flows

Required behavior:

1. Browser History remains the only navigation history.
2. `ROOT_TAB -> ROOT_TAB` and all bottom-tab selection use replace semantics.
3. Business collection/detail transitions use push semantics unless a completed flow explicitly replaces its current entry.
4. `returnTo` may identify one direct source only. Nested `returnTo` values are removed and never propagated.
5. Application back resolves in this order: a valid direct `returnTo`, an available Browser History entry, then the route's business fallback.
6. A direct-entry child/detail route with no application history seeds one Browser History fallback entry, so browser/system back resolves to the business fallback instead of relying on a nonexistent entry.
7. Components call the navigation policy and do not decide push/replace behavior independently.

## 5. Hard acceptance gates

### Gate A — root-tab history

Repeat the following sequence 20 times:

`Home -> Records -> Plan -> Account -> Home`

Then open a business list, open a detail and go back. The result must be `Detail -> Business list`; Browser Back must not replay the prior root-tab sequence.

### Gate B — direct detail entry

For task, calendar and reminder detail routes opened directly without an application history entry:

- application back resolves to the defined business fallback;
- browser/system back resolves to the same fallback;
- no blank page, external origin or nonexistent `history.back()` dependency occurs.

### Gate C — compatibility

- Existing explicit list/detail return sources and query filters remain intact.
- Malicious or external `returnTo` values are rejected.
- Unsaved-change guards still protect dirty forms.
- Desktop navigation has no material regression.
- No forbidden-scope file or behavior is changed.

## 6. Verification

- Focused navigation policy, BottomNav, PageHeader and navigation utility unit tests
- Web lint, typecheck, unit tests and build
- Navigation E2E at 375, 390, 430, 768 and 1440 CSS pixels, including Browser Back and deep-link fallback
- `npm run quality`
- `npm run check:context`
- `git diff --check`

Physical iPhone edge-back and Android system-back remain `UNVERIFIED` until recorded on real devices. Browser/WebKit automation is supporting evidence only.

## 7. Completion state

Local implementation may be reported as `DONE_LOCAL` only after all executable local gates pass. Commit, push, PR, merge, deployment and physical-device gate closure remain separate actions.
