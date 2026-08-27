# ADR-028：PR20 Adapter Integration 与 H7 真实验证边界

- Version: Draft v0.1
- Date: 2026-08-27
- Status: `PROPOSED / AWAITING_DADA_APPROVAL`
- Proposed by: Codex，待 Dada 人工审查
- Related plan: `PLANS.md` v2.1.1 Final（Gate 1 仅登记提案，不改变其已生效规则）
- Related task: `tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md`
- Related baseline: `codex/v15-integration-foundation@56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172`
- Existing normative sources: `docs/40-v15-final-development-baseline.md` V1.1、Accepted ADR-026、Accepted ADR-027

> 本 ADR 在 Gate 1 仅作为事实归档与治理提案存在，尚未 Accepted，也不改变
> `docs/40` V1.1、ADR-026 或 ADR-027 的有效规则。只有 Gate 2 获得 Dada 明确批准后，
> 才能把本 ADR 的边界转为生效规范。

## Context

现行有效规则将 PR19 作为 PR20 的 development dependency，并把 H7 同时列为
`humanValidationGate` 与 `mergeGate`。该规则在 PR20 开始前成立：H7 关闭前不得合并
PR20，R1 也必须等待 H7。

随后 PR20 被拆成四个实现切片并已合入 Integration。需要在不重写 Git 历史、不把 CI 绿灯
误写成真实 Provider 验证、也不提前使新政策生效的前提下，记录历史偏离并提出可审查的
两阶段语义。

## Observed facts

以下事实已于 2026-08-27 重新从 Git、GitHub PR 与 CI 只读核验：

| 项目 | 已核验事实 |
|---|---|
| Integration | `origin/codex/v15-integration-foundation` 精确指向 `56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172` |
| PR19 | GitHub PR #18 已合入，merge commit `c42c19ecb606893b1384fab4a13af2afb6b9981c`；对应 canonical PR19 已达到 `DONE_INTEGRATION` |
| 无关 PR | GitHub PR #19 是 Preview workflow，合入 `main`，不是 canonical PR19 |
| PR20-01 | GitHub PR #20，provider adapter foundation，merge `c7914cfe961cfebc58d93034c21019c8184599f0` |
| PR20-02 | GitHub PR #21，provider configuration，merge `6c903073b6499f17d2a025d4fbf4f53f375c3a28` |
| PR20-03A | GitHub PR #22，DeepSeek adapter，merge `7445ba3d4d1d1222ac7a9be4515dc5d6625cc195` |
| PR20-03B | GitHub PR #23，OpenAI adapter，merge `56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172` |
| Integration CI | Run `33035100661` 针对 `56ffd3dc…` 的 `quality`、`db-validation`、`browser-qa` 均为 SUCCESS |
| CI 证据 | `supply-chain-governance` 与 `pr6a-mysql84-evidence` artifact 存在；`browser-qa` 成功时 Playwright 报告上传步骤被跳过，因此不能宣称存在完整浏览器报告 |
| H7 | 仍为 `OPEN`；没有以本次 CI 结果关闭 H7，也没有把 CI 结果当作真实 Provider 调用或真实数据评测证据 |

## Historical scope deviations

### Deviation A — PR20 slices integrated before H7 closure

PR20 的 adapter foundation、configuration、DeepSeek adapter 与 OpenAI adapter 已经进入
Integration，而 H7 仍未关闭。这个历史事实与当时的
`humanValidationGate/mergeGate: H7` 语义存在偏离，必须登记而不能通过文档追溯性改写消除。

当前处置必须保持：

```text
currentDisposition: PENDING_DADA_DISPOSITION
recommendedDisposition: KEEP_AND_RECONCILE
```

`KEEP_AND_RECONCILE` 只是待人工决定的建议，不是本 ADR 的批准结果。

### Deviation B — PR number 与 canonical task ID 的歧义

GitHub PR #22 和 #23 是 PR20-03A/PR20-03B 的历史实现切片；canonical task `PR22` 和
`PR23` 仍分别是 R3 的 Shrink 准备与最终 Shrink。两组编号不能互换。R3 的 canonical
PR22/PR23 本轮没有实现、没有变更、没有得到任何清理或不可逆操作授权。

## Proposed decision — not effective in Gate 1

待 Gate 2 批准的两阶段语义如下：

```text
PR20 Adapter Integration
= DONE_INTEGRATION

PR20 Live Provider Validation
= BLOCKED / H7
```

如果该提案获批，H7 继续阻塞：

- real Provider calls；
- real credential/secret use；
- real-data/provider evaluation；
- Provider enablement；
- REL-04；
- R1 advancement。

H7 不再追溯性地使已经合入 Integration 的 mock-only adapter implementation、
injected-transport tests 或 adapter integration 事实失效；但这一句在 Gate 2 批准前不是
当前生效规则。

无论是否批准，以下安全边界都不变：Provider output 不得直接写正式业务表，正式写入必须
经过用户最终确认；浏览器不得持有 Provider credential；不得自动跨 Provider fallback；
失败必须保留原输入；不可降低的安全阈值不得降低。

## Two-gate transition

### Gate 1 — Governance Draft Write

只物化历史事实、偏离登记、ADR-028 草案、QUALITY-R1 task contract 草案与状态快照。
ADR-028 保持 `PROPOSED / AWAITING_DADA_APPROVAL`，PR20 deviation 保持
`PENDING_DADA_DISPOSITION`，H7 保持 `OPEN`，R1 Quality Gate 保持
`BLOCKED / NOT_READY`。`docs/40` 保持 V1.1，本 Gate 不让新边界生效。

### Gate 2 — Governance Approval / Normative Freeze

只有在 Gate 1 diff 经审查且 Dada 单独明确批准后，才可：

1. 将 ADR-028 改为 `Accepted`；
2. 将两项 deviation 定为 `KEEP_AND_RECONCILE`；
3. 使 PR20 两阶段语义和 H7 新边界生效；
4. 将 `docs/40` 从 V1.1 升为 V1.2；
5. 把 `PLANS.md` 的 reconciliation proposal 转为 active normative rule。

Gate 2 不由代码、CI、本 ADR 草案或 Gate 1 自动触发。

## Non-scope

本 ADR 不授权真实 Provider、真实 credential、真实数据评测、H7 closure、Provider enablement、
Staging/Production、资源创建、部署、commit、push、PR、merge，也不修改 ADR-026、ADR-027、
`docs/40`、`docs/42`、CI workflow、Prisma/migration、package/lockfile、`apps/` 或
`packages/`。

## Decision status

```text
ADR-028: PROPOSED / AWAITING_DADA_APPROVAL
PR20-03A/#22 deviation: PENDING_DADA_DISPOSITION
PR20-03B/#23 deviation: PENDING_DADA_DISPOSITION
H7: OPEN
R1 Quality Gate: BLOCKED / NOT_READY
effective rule during Gate 1: existing H7 rule remains unchanged
```
