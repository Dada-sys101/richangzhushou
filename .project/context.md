# Project Context

## Last Updated

2026-08-10 +08:00（v2.1.1 Final 已获人工批准并在本地落地，未提交、未推送、未更新 PR）

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `bc747b7ba4232adf888d68243f30573f1ca7866f`
- Active branch: `codex/v15-ctrl-001-rebaseline`
- Remote Draft PR: `#10`, observed head `06b11e15fbcc7cfde8c494bcd0bd3682b87858b6`
- Local target worktree: modified/uncommitted governance documents
- Staging: not created; Production: not deployed

## Project Summary

V1 核心已在 main。V1.5 是增量交付：AI 为 R1，Push 为 R1.1，新 RRULE/Import 为 R2，
完整本地迁移和 Shrink 为 R3。PLANS 是唯一任务定义，execution-state 是仓库内快照，
GitHub/Git/CI/环境是实时事实。

## Last Completed Task

- `V15-CTRL-001a`: `DONE / DONE_INTEGRATION`，证据 PR #9。

## Current Task

- ID: `V15-CTRL-001`
- Status: `VERIFYING / PR_OPEN`
- Local state: approved content applied but not committed or pushed
- Contract: `tasks/V15-CTRL-001.md`
- Remaining: diff approval、commit/push/PR update authorization、updated-head CI、merge authorization、merge、HEAD verification

## Blockers

- V15-CTRL-001 十二项条件尚未全部满足；
- H1/H2/H7 阻塞 R1；H6/H8 仅阻塞 Push；
- 云资源、migration、真实 AI、Staging 和 Production 均需独立授权。

## Verification Status

- PR #10 远端旧 head CI：PASS；该结果不覆盖本地未提交修订；
- 本地 `npm run check:context`：PASS；
- 本地 `git diff --check`：PASS；checker syntax：PASS；
- commit/push/PR update/merge/deploy：NOT_RUN。

## Next Recommended Task

当前仍为 `V15-CTRL-001`。只有达到 `DONE_INTEGRATION` 后，唯一下一工程任务才是 `PR6a`。

## Handoff Instructions

1. 读取 PLANS v2.1.1、execution-state、ADR-026、docs/40 V1.1 和任务契约；
2. 核验 GitHub/Git/CI 实时事实，不把快照当实时镜像；
3. 人工审查本地完整 diff；
4. 未获独立授权不得 commit、push、更新 PR 或 merge；
5. PR6a 不得提前开始。
