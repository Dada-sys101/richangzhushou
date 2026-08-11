# Project Context

## Last Updated

2026-08-11 +08:00（AI-DECISION-001 v1.0 Final 策略已本地落地，停在 DONE_LOCAL）

## Repository State

- Repository: `Dada-sys101/richangzhushou`
- Main: `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
- Integration: `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`
- Active branch: `codex/v15-ai-decision-001`
- Base: `origin/codex/v15-integration-foundation@01292ef7a6bcf97addfd139fe39a3576fc05f9c9`
- Remote PR #11: merged; merge commit `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`; no open PR
- Local target worktree: AI governance/documentation modified and uncommitted; no code changes
- Staging: not created; Production: not deployed

## Project Summary

V1 核心已在 main。V1.5 是增量交付：AI 为 R1，Push 为 R1.1，新 RRULE/Import 为 R2，
完整本地迁移和 Shrink 为 R3。PLANS 是唯一任务定义，execution-state 是仓库内快照，
GitHub/Git/CI/环境是实时事实。

## Last Completed Task

- `PR6a`: `DONE / DONE_INTEGRATION`，证据 PR #11 / integration HEAD `01292ef...`。

## Current Task

- ID: `AI-DECISION-001`
- Status: `DONE / DONE_LOCAL`
- Branch: `codex/v15-ai-decision-001`
- Contract: `tasks/AI-DECISION-001.md`
- Result: ADR-027 v1.0 Final 已冻结 Provider/模型候选、服务端网络/credential/字段/日志/保留边界、
  预算与韧性、200 条非真实数据规范、provisional thresholds 和四项 immutable safety thresholds；
  未执行真实评测或实现

## Blockers

- H1/H2/H7 阻塞 R1；H6/H8 仅阻塞 Push；
- 云资源、非临时/生产 migration、真实 AI、Staging 和 Production 均需独立授权。

## Verification Status

- PR #11 merged；PR6a `DONE / DONE_INTEGRATION`；integration HEAD `01292ef...` 已核验；
- PR6a focused tests：1 file / 26 tests PASS；
- MySQL 8.4.9 success 2/2：每次 9 migrations、14 files / 105 DB tests、隔离与 cleanup PASS；
- failure / SIGINT：预期非零、完整 cleanup、DB/user/process 残留 0；四个 evidence SHA256 匹配；
- AI-DECISION-001 文档 diff、`npm run check:context`、`npm run quality`、`git diff --check`：
  PASS（主代理独立复核）；
- commit/push/PR/deploy：NOT_RUN。

## Next Recommended Task

当前唯一任务仍为 `AI-DECISION-001`，状态为 `DONE / DONE_LOCAL`。达到 `DONE_INTEGRATION` 前
`nextCanonicalTask` 保持 AI-DECISION-001；之后下一 canonical 任务为 `PR2`。不得自动 commit、
晋级交付或启动 PR2。

## Handoff Instructions

1. 读取 PLANS v2.1.1、execution-state、`tasks/AI-DECISION-001.md` 与 ADR-027；
2. 审查当前完整 diff 和工作树范围；
3. 保持 `DONE_LOCAL`，不得自动开始 PR2、PR6 或其他 READY 任务；
4. commit、push、创建 PR、merge 或部署均需各自独立授权。
