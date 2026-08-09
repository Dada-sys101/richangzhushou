# 技术决策记录（Decisions）

更新：2026-08-10

DEC-001～DEC-139 和 ADR-001～ADR-025 的完整内容保留在 Git 历史和
`codex/v15-integration-foundation` 基线提交
`bc747b7ba4232adf888d68243f30573f1ca7866f` 中。本任务不改变既有决定。

当前事实：

- 邮箱、邀请码和截图 OCR 已下线；
- Playwright/browser-qa 已进入仓库和 CI；
- OSS Adapter 已进入 main，真实资源/Staging 未完成；
- V1.5 是 V1 的增量集成。

## DEC-V15-026：首发范围与发布分层

- Status: Proposed
- ADR: `docs/adr/ADR-026-v15-release-scope-r1.md`
- 保留原任务编号；
- 使用 releaseTarget/blocksR1Release/featureGate；
- AI 阻塞 R1，Push 只阻塞启用；
- Import、新 RRULE、完整本地迁移和 Shrink 后移不取消；
- REL-06 不依赖 PR23；
- 项目负责人批准前不得 Accepted。

## AI-DECISION-001

阻塞 PR2，不阻塞 PR6a。需确认 Provider、模型、网络、凭据、配额、预算、超时、
数据字段、日志保留和真实评测。
