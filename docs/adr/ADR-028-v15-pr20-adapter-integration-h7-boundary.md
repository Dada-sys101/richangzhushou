# ADR-028：PR20 Adapter Integration 与 H7 真实验证边界

- Version: v1.0 Final
- Date: 2026-08-27
- Status: `Accepted`
- Accepted by: Dada（明确批准，2026-08-27）
- Related plan: `PLANS.md` v2.1.1 Final（本 ADR 对 PR20 历史解释作有限 supersede）
- Related task: `tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md`
- Related baseline: `codex/v15-integration-foundation@d53f84a4ff99208f69d209e98a1d3f07c588d760`
- Existing normative sources: `docs/40-v15-final-development-baseline.md` V1.2、Accepted ADR-026、Accepted ADR-027

> 本 ADR 已于 2026-08-27 获 Dada 明确批准，并与 `docs/40` V1.2、`PLANS.md` 同步生效。
> 它只有限 supersede PR20 已合入历史与 live Provider validation 的追溯性解释，不修改
> ADR-026 或 ADR-027 的 normative content，不授权真实 Provider、credential、数据评测或部署。

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
| Integration | `origin/codex/v15-integration-foundation` 精确指向 `d53f84a4ff99208f69d209e98a1d3f07c588d760` |
| PR19 | GitHub PR #18 已合入，merge commit `c42c19ecb606893b1384fab4a13af2afb6b9981c`；对应 canonical PR19 已达到 `DONE_INTEGRATION` |
| 无关 PR | GitHub PR #19 是 Preview workflow，合入 `main`，不是 canonical PR19 |
| PR20-01 | GitHub PR #20，provider adapter foundation，merge `c7914cfe961cfebc58d93034c21019c8184599f0` |
| PR20-02 | GitHub PR #21，provider configuration，merge `6c903073b6499f17d2a025d4fbf4f53f375c3a28` |
| PR20-03A | GitHub PR #22，DeepSeek adapter，merge `7445ba3d4d1d1222ac7a9be4515dc5d6625cc195` |
| PR20-03B | GitHub PR #23，OpenAI adapter，merge `d53f84a4ff99208f69d209e98a1d3f07c588d760` |
| Integration CI | Run `33043413216` 针对 `d53f84a4…` 的 `quality`、`db-validation`、`browser-qa` 均为 SUCCESS |
| CI 证据 | `supply-chain-governance` 与 `pr6a-mysql84-evidence` artifact 存在；`browser-qa` 成功时 Playwright 报告上传步骤被跳过，因此不能宣称存在完整浏览器报告 |
| H7 | 仍为 `OPEN`；没有以本次 CI 结果关闭 H7，也没有把 CI 结果当作真实 Provider 调用或真实数据评测证据 |

## Historical scope deviations

### Deviation A — PR20 slices integrated before H7 closure

PR20 的 adapter foundation、configuration、DeepSeek adapter 与 OpenAI adapter 已经进入
Integration，而 H7 仍未关闭。这个历史事实与当时的
`humanValidationGate/mergeGate: H7` 语义存在偏离，必须登记而不能通过文档追溯性改写消除。

当前处置为：

```text
currentDisposition: KEEP_AND_RECONCILE
approvedDisposition: KEEP_AND_RECONCILE
approvedBy: Dada (2026-08-27)
```

`KEEP_AND_RECONCILE` 表示保留已发生的 Integration 历史并纳入本 ADR 的边界归一；不追溯改写
Git 历史，也不授权未来真实 Provider 行为。

### Deviation B — PR number 与 canonical task ID 的歧义

GitHub PR #22 和 #23 是 PR20-03A/PR20-03B 的历史实现切片；canonical task `PR22` 和
`PR23` 仍分别是 R3 的 Shrink 准备与最终 Shrink。两组编号不能互换。R3 的 canonical
PR22/PR23 本轮没有实现、没有变更、没有得到任何清理或不可逆操作授权。

```text
currentDisposition: KEEP_AND_RECONCILE
approvedDisposition: KEEP_AND_RECONCILE
approvedBy: Dada (2026-08-27)
```

## Decision — effective

经 Dada 批准，以下两阶段语义正式生效：

```text
PR20 Adapter Integration
= DONE_INTEGRATION

PR20 Live Provider Validation
= BLOCKED / H7
```

H7 继续阻塞：

- real Provider calls；
- real credential/secret use；
- real-data/provider evaluation；
- Provider enablement；
- REL-04；
- R1 advancement。

H7 不再追溯性地使已经合入 Integration 的 mock-only adapter implementation、
injected-transport tests 或 adapter integration 事实失效。该有限解释不改变 H7 `OPEN`，
也不改变 R1 Quality Gate `BLOCKED / NOT_READY`。

以下安全边界保持不变：Provider output 不得直接写正式业务表，正式写入必须
经过用户最终确认；浏览器不得持有 Provider credential；不得自动跨 Provider fallback；
失败必须保留原输入；不可降低的安全阈值不得降低。

## Two-gate transition

### Gate 1 — Governance Draft Write（completed）

Gate 1 只物化了历史事实、偏离登记、ADR-028 草案、QUALITY-R1 task contract 草案与状态快照，
并停在人工批准门前。

### Gate 2 — Governance Approval / Normative Freeze（approved and written locally）

2026-08-27，Dada 已明确批准：ADR-028、Deviation A/B 的
`KEEP_AND_RECONCILE` disposition、PR20 两阶段语义、H7 blockingScope 的有限解释、
`docs/40` V1.2 以及 `PLANS.md` active rule。上述批准已写入本地治理 Markdown；仍未创建
commit，也未扩大到代码、CI、真实 Provider、资源或部署动作。

### Next gate — NORMATIVE FREEZE POST-WRITE REVIEW GATE

下一步只进行授权文件清单、语义一致性、`npm run check:context`、`git diff --check`、
Git status 和 stash 完整性复核；不得由本 ADR 自动触发 commit、push、PR、merge 或部署。

## Non-scope

本 ADR 不授权真实 Provider、真实 credential、真实数据评测、H7 closure、Provider enablement、
Staging/Production、资源创建、部署、commit、push、PR、merge；除本次已记录的 `docs/40` V1.2
有限边界修订外，不修改 ADR-026、ADR-027 的 normative content、`docs/42`、CI workflow、
Prisma/migration、package/lockfile、`apps/` 或 `packages/`。

## Decision status

```text
ADR-028: Accepted
PR20-03A/#22 deviation: KEEP_AND_RECONCILE
PR20-03B/#23 deviation: KEEP_AND_RECONCILE
H7: OPEN
H7 blockingScope: real Provider calls; real credential/secret use; real-data/provider evaluation; Provider enablement; REL-04; R1 advancement
PR20 Adapter Integration: DONE_INTEGRATION
PR20 Live Provider Validation: BLOCKED / H7
R1 Quality Gate: BLOCKED / NOT_READY
docs/40: V1.2
normative freeze write: DONE_LOCAL / UNCOMMITTED
next gate: NORMATIVE FREEZE POST-WRITE REVIEW GATE
```
