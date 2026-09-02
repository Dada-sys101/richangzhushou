# ADR-029：AI 预算自然月观察与临时不设金额上限

- Version: v1.0
- Date: 2026-09-01
- Status: `Accepted / Temporary`
- Accepted by: Dada（明确确认，2026-09-01）
- Related task: `PR20 Live Provider Validation`
- Related ADR: `docs/adr/ADR-027-ai-provider-evaluation-policy.md`

## Context

ADR-027 原定每用户和总体 AI 金额 warning/hard limit。PR20 H7 复核时需要明确预算周期和当前阶段的
金额上限策略。Dada 已明确确认：预算周期采用 `Asia/Shanghai` 自然月，当前暂不固定费用上限。

## Decision

在当前临时策略有效期间：

1. AI 用量统计周期按 `Asia/Shanghai` 的自然月解释；月初为当地时间当月 00:00:00，月末为下月 00:00:00，
   边界转换使用时区规则，不使用服务器本地时区推断。
2. 暂不配置固定金额 warning 或 hard ceiling，因此不因金额累计返回 `BUDGET_BLOCKED`；这不是费用为零，
   也不是 Provider 无限责任的安全保证。
3. 继续记录现有 `AiProviderAttempt` 的规范化 `inputTokens`、`outputTokens`、provider、model、状态和时间，
   作为后续自然月用量核对依据；当前不把 token 换算为金额，因为 Provider 费率和计费口径尚未冻结。
4. 现有 `AllowFakeAiBudgetGate` 保持“无金额上限时允许继续”的临时行为；本决策不新增费用账本、价格配置、
   管理端用量页面或数据库 migration。后续需要这些能力时，必须另立实施任务并补充并发、保留和权限验收。
5. 其他安全边界不变：Provider 只由服务端调用，凭据不进入浏览器或仓库；失败保留原始输入；Provider 输出
   不直接写正式业务表；正式写入仍需用户最终确认；AI feature flag 和 `businessWrite` 闸门仍然有效。

## Consequences and limits

- 当前策略降低了实现复杂度，但没有金额超支保护；不能把它描述为“生产预算 enforcement 已完成”。
- H7 的本机评估证据、Provider/model 暂定选择和效果阈值确认可以继续作为人工审阅输入，但本 ADR 不自动
  关闭 H7，也不自动启用 Provider、推进 REL-04 或 R1。
- 在正式生产启用前，应重新确认是否接受无金额上限风险，并决定 Provider 费率来源、失败/重试如何计费、
  用量报表、告警、硬限制和并发原子性；若恢复 ADR-027 的金额上限，需实现 fail-closed 的服务端预算闸门。

## Non-scope

本 ADR 不授权生产 Provider、真实用户数据评测、部署、资源创建、commit、push、PR、merge 或 H7 自动关闭；
不改变 ADR-027 的四项不可降低安全阈值，也不改变现有数据库 schema 或 API 契约。
