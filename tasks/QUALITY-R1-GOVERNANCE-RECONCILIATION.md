# QUALITY-R1-GOVERNANCE-RECONCILIATION

## Contract metadata

- Contract: `QUALITY_R1_GOVERNANCE_RECONCILIATION_GATE1`
- Contract status: `DRAFT / AWAITING_APPROVAL`
- Current gate: `QUALITY-R1-GOVERNANCE-DRAFT-WRITE`
- Next gate: `QUALITY-R1-GOVERNANCE-APPROVAL / NORMATIVE FREEZE`
- Date: 2026-08-27
- Repository: `Dada-sys101/richangzhushou`
- Required base: `codex/v15-integration-foundation@56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172`
- Working tree: independent worktree created for this draft; no changes are allowed in the older PR20-03A worktree

This is a governance reconciliation contract, not an implementation contract. Gate 1 may
materialize facts and a proposed boundary only. It does not accept ADR-028, approve either
scope deviation, close H7, advance R1, or make a new normative rule effective.

## 1. Objective

Reconcile the repository governance snapshot with the actual Integration history after PR19 and
the four PR20 adapter slices, while preserving the distinction between:

1. historical code/integration facts;
2. a proposed governance interpretation;
3. explicit Dada approval; and
4. a future normative freeze.

## 2. Required factual snapshot

| Area | Gate 1 value |
|---|---|
| Integration baseline | `56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172` on `codex/v15-integration-foundation` |
| PR19 | `DONE_INTEGRATION`; GitHub PR #18; merge `c42c19ecb606893b1384fab4a13af2afb6b9981c` |
| PR20 adapter integration | `DONE_INTEGRATION` as historical Integration fact, through PR #20/#21/#22/#23 |
| PR20 live Provider validation | `BLOCKED / H7` |
| H7 | `OPEN` |
| R1 Quality Gate | `BLOCKED / NOT_READY` |
| PR20-03A/#22 deviation | `PENDING_DADA_DISPOSITION` |
| PR20-03B/#23 deviation | `PENDING_DADA_DISPOSITION` |
| ADR-028 | `PROPOSED / AWAITING_DADA_APPROVAL` |
| CI evidence | Run `33035100661`: `quality`, `db-validation`, `browser-qa` SUCCESS; browser report upload skipped; artifacts `supply-chain-governance` and `pr6a-mysql84-evidence` |

The labels GitHub PR #22/#23 must not be confused with canonical task IDs PR22/PR23, which
remain the R3 Shrink tasks and are untouched.

## 3. Gate 1 allowed scope

Gate 1 may only:

- add `docs/adr/ADR-028-v15-pr20-adapter-integration-h7-boundary.md` and keep it
  `PROPOSED / AWAITING_DADA_APPROVAL`;
- add this task contract and keep it `DRAFT / AWAITING_APPROVAL`;
- update `PLANS.md` with live facts, `R1 Quality Gate = BLOCKED / NOT_READY`, the current
  H7 blocking scope, and an explicitly non-effective reconciliation proposal;
- update `.project/v15-execution-state.md`, `.project/context.md`, `.project/session.md`,
  `tasks/PR19.md`, `.project/decisions.md`, `docs/decisions.md`, and `docs/README.md`;
- update the required derived mirrors: `docs/architecture.md`, `docs/roadmap.md`,
  `docs/progress.md`, `docs/changelog.md`, `README.md`, `MASTER_PLAN.md`, `PROJECT_STATUS.md`,
  `SESSION_END.md`, `TODO.md`, and `CHANGELOG.md`;
- record the two historical PR20 deviation entries as `PENDING_DADA_DISPOSITION`;
- append only factual reconciliation/status material to `tasks/PR19.md`; its V10 normative
  scope remains unchanged;
- run local context and diff checks.

## 4. Gate 1 forbidden scope

Gate 1 must not:

- mark ADR-028 `Accepted`;
- set either deviation to `KEEP_AND_RECONCILE` as an approved disposition;
- close H7 or change the active H7 rule;
- mark R1 Quality Gate ready or advance R1;
- modify `docs/40-v15-final-development-baseline.md` or make it V1.2;
- modify ADR-026 or ADR-027 normative content;
- modify `docs/42`, `apps/`, `packages/`, CI workflows, package/lockfile, Prisma/schema/migration,
  environment files, deployment or external resources;
- use real Provider/network/credential/secret, real data, or real-user resources;
- commit, push, create/update PR, mark Ready, merge, rebase, reset, cherry-pick, force, deploy,
  or touch `stash@{0}`.

## 5. Two-stage PR20 proposal

The following is proposed text, not active Gate 1 policy:

```text
PR20 Adapter Integration
= DONE_INTEGRATION

PR20 Live Provider Validation
= BLOCKED / H7

H7 blocks real Provider calls, real credential use, real-data/provider evaluation,
Provider enablement, REL-04 and R1 advancement.

H7 does not retroactively invalidate already-merged mock-only adapter integration.
```

Until Gate 2 approval, the effective rule remains the existing V1.1/ADR-026 rule that H7 is
the PR20 merge gate and an R1 blocker. The already-merged PR20 history is recorded as a pending
scope deviation; it is not silently declared compliant.

## 6. Gate 2 prerequisites

Gate 2 requires an explicit new approval after review of the Gate 1 diff. It may then decide:

1. ADR-028 `Accepted` or rejected;
2. each deviation disposition, with the recommended but not pre-approved value
   `KEEP_AND_RECONCILE`;
3. whether to make the two-stage PR20/H7 semantics effective;
4. whether to update `docs/40` to V1.2 and promote the PLANS proposal.

No Gate 2 action is included in this contract.

## 7. Acceptance and verification

Gate 1 is locally ready for review only when:

- all factual statuses above are synchronized without changing implementation behavior;
- H7 remains `OPEN`, R1 Quality Gate remains `BLOCKED / NOT_READY`, ADR-028 remains proposed,
  and both deviations remain pending;
- `tasks/PR19.md` retains V10 scope and receives factual reconciliation only;
- no forbidden file is changed;
- `npm run check:context` is `PASS`;
- `git diff --check` is `PASS`;
- `git status` shows only the authorized uncommitted documentation changes;
- the original PR20-03A worktree and `stash@{0}` remain untouched.

Every check is reported as `PASS`, `FAIL`, `NOT_RUN`, or `UNABLE_TO_RUN`. Gate 1 ends at the
`COMMIT AUTHORIZATION GATE`; no commit is created by this contract.
