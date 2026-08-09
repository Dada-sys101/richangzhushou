# Technical Decisions

ADR-001～ADR-025 的完整内容保留在 Git 历史和
`codex/v15-integration-foundation` 基线提交
`bc747b7ba4232adf888d68243f30573f1ca7866f` 中。本任务不改变其 Accepted 状态。

## ADR-026：V1.5 首发范围、发布目标与任务后移策略

- Date: 2026-08-10
- Status: Proposed
- File: `docs/adr/ADR-026-v15-release-scope-r1.md`
- Summary:
  - 保留原任务编号；
  - R1/R1.1/R2/R3 分层；
  - AI 阻塞 R1，Push 只阻塞启用；
  - REL-06 不依赖 PR23；
  - 后移不等于取消。
- Acceptance: 需项目负责人明确审阅。

## AI-DECISION-001

- Status: PENDING_USER_DECISION
- Blocks: PR2
- Does not block: V15-CTRL-001, PR6a
- Deadline: PR2 开始前
- Required: Provider、模型、网络、凭据、限制、预算、超时、数据字段、保留、评测
