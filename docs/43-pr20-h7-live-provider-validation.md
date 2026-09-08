# PR20 H7 真实 Provider 受控验证记录

> 本记录只保存脱敏后的验证结果，不包含 API Key、Token、Cookie、真实用户数据、原始 Provider 响应或可恢复的敏感输入。

## 1. 验证范围与边界

- 验证日期：2026-09-01。
- 运行位置：本机一次性 MySQL 8.4.11 环境，运行时位于 `D:\daily-assistant-runtime`，不安装在 C: 盘；测试库为一次性 disposable database `daily_assistant_h7_20260901`。
- Provider：DeepSeek；模型：`deepseek-v4-flash`。
- 数据：仅使用 ADR-027 规定的 200 条合成、脱敏评测数据，不使用真实用户数据、真实账单、真实日程或真实凭据内容。
- 浏览器不持有 Provider credential；credential 只通过本机 API 进程环境引用，仓库文件和日志不保存 secret。
- `v15.ai.proposal=true`、`v15.ai.liveProvider=true`，但 `v15.ai.businessWrite=false`；本轮不向正式业务表写入，不创建真实用户 Proposal。
- 本轮只验证受控 adapter、结构化输出、失败保留、脱敏观测和正式写入隔离；不执行 Provider enablement、部署、提交、推送、PR、合并或 H7 自动关闭。

DeepSeek API 的本轮调用遵循官方 Chat Completions、JSON Output 和模型列表接口约定：
[Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)、
[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、
[Models](https://api-docs.deepseek.com/api/list-models/)。Dada 已接受本轮条款复核作为当前阶段决策输入；正式生产批准仍须经过组织隐私与发布审查，不能仅凭本机测试自动取得。

## 2. 本轮代码修正

DeepSeek adapter 的系统提示已收紧为 Proposal 合同可验证的 JSON 形状，明确要求：

- 顶层只允许 `resultType`、`providerId`、`modelId`、`clarification`、`missingFields`、`operations`；
- `providerId`、`modelId`、`operationType`、PENDING 状态和字段白名单必须与请求一致；
- 日期时间使用 ISO 8601，金额使用字符串定点表示；
- 信息不足时返回 `UNCERTAIN`，不得猜测，不得加入 `userId`、secret 或未授权字段。

对应文件：

- `apps/api/src/ai/deepseek-provider/deepseek-ai-provider.adapter.ts`
- `apps/api/src/ai/deepseek-provider/deepseek-ai-provider.adapter.test.ts`

修正后 adapter 定向测试为 1 个文件、6 项全部通过，API lint 也通过。

本轮同时新增了可重复的本机评估入口：

- `apps/api/src/cli/h7-live-provider-evaluation.ts`，API 脚本入口为 `npm run h7:evaluate --workspace @daily-assistant/api`；
- 数据集版本：`h7-adr027-fixed-v1`；
- 默认固定生成 ADR-027 规定数量的 200 条合成样例，支持通过
  `H7_EVAL_CASE_IDS` 做定向复测；
- 评估器只输出脱敏汇总，不打印原始输入、Provider 原始响应或凭据；结束时只删除本轮生成的评估用户，
  不删除其他用户或其他数据库对象。

该数据集按 ADR-027 的类别和数量固定生成，但不是此前一次性手工样例的可证明字节级复现；因此本轮结果是
“ADR-027 结构合规的可重复评估证据”，不能表述为对历史原始 200 条样例的逐字重放。

## 3. 结果摘要

### 3.1 Canary 与小样本 Pilot

- Canary：HTTP 成功，生成 1 个待审核 Proposal 和 1 个 operation；未发生正式业务写入。
- Pilot：10/10 请求成功；任务、日程、提醒、交易和行程字段均落在预期范围内；2 条信息不足样例返回不确定结果。
- Pilot 延迟：779–1544 ms，平均 1181 ms。

### 3.2 提示词补强后的 ADR-027 结构化 200 条评测

| 类别 | 数量 | 结构有效 | 备注 |
|---|---:|---:|---|
| Finance / Transaction | 60 | 60 | 全部通过 |
| Task | 40 | 40 | 全部通过 |
| Calendar | 35 | 35 | 全部通过 |
| Reminder | 30 | 29 | `case-146` 一次性 HTTP 502 / `SCHEMA_INVALID` |
| Trip | 20 | 20 | 全部通过 |
| Ambiguous / missing / failure | 15 | 15 | 15 条均按预期进入不确定处理 |
| **合计** | **200** | **199** | **99.5%** |

- Provider 请求成功：199/200；失败：1/200。
- Schema success rate：`199/200 = 99.5%`，达到 ADR-027 provisional target `>=99%`。
- 服务端延迟：658–2262 ms，平均 1182 ms，p95 1589 ms；客户端观测延迟：712–2317 ms，平均 1236 ms，p95 1644 ms。
- 受控“无需完整重录”代理指标：`(184 条正向成功 + 15 条不确定处理)/200 = 99.5%`；正向样例成功
  `184/185`，不确定样例按预期处理 `15/15`。这只是本轮评估代理指标，不是最终人工批准的 effect threshold。
- 唯一异常为 `case-146`（Reminder，预期正向）：一次 HTTP 502，Provider attempt 分类为
  `SCHEMA_INVALID`。原始输入被保留以便重试，未记录原始 Provider 输出；随后对该 case 做了 3 次定向
  复测，3/3 成功，暂未发现稳定可复现的确定性缺陷。Dada 已确认接受本轮评估结果及该随机失败样本作为当前阶段证据。
- 评估器记录的 token 元数据：输入合计 145,318、单次最多 780；输出合计 22,974、单次最多 209。

### 3.3 数据库与观测证据

- 本轮 200 条评估对应 200 次 `DeepSeek / deepseek-v4-flash` attempt：199 条成功、1 条失败；数据库中的
  `requestStatusCounts` 为 `SUCCEEDED=199、FAILED=1`，失败分类为 `SCHEMA_INVALID=1`。
- 评估期间生成 199 个 Proposal，均为 `PENDING_REVIEW`；未接受为正式业务写入。
- 失败请求保留原输入：1/1。
- 本轮评估用户对应的正式业务表计数均为 0：`transactions=0`、`tasks=0`、`calendar_events=0`、
  `reminders=0`、`trips=0`；这不代表其他用户或其他数据库的全局计数。
- 持久化观测只使用 provider/model/status/failure/latency/token 等规范化元数据；不持久化 raw provider response。

## 4. 安全隔离验证

本轮选取一个待审核 Proposal 执行“接受后最终确认”路径。由于 `v15.ai.businessWrite=false`，最终确认返回 HTTP 403、错误码 `AI_DISABLED`；正式业务表没有增长。该结果证明本机验证没有绕过最终业务写入闸门。

不可降低的安全条件仍保持：

- 失败输入保留；
- 正式业务写入必须经过用户最终确认；
- Provider 输出不得直接写业务表；
- 敏感字段不得越过固定白名单。

## 5. 提示词补强后的定向回归

在提示词补强后，除完整评估外，又用本机真实 Provider 做了 3 条新的合成样例复测：

- “买东西”：服务端 Proposal operation 的置信度为 `0.0000`，字段为空，并要求补充具体内容；
- “帮我处理一下”：服务端 Proposal operation 的置信度为 `0.0000`，字段为空，并要求补充任务内容；
- “周五下午五点前提交周报”：服务端生成 `title`、`dueAt`、`priority` 字段，置信度为 `0.9000`。

这组复测表明，新增的“禁止占位标题、模糊输入必须不确定”提示约束对已发现的两个失败模式有效；它是
定向回归证据。完整评估中的唯一异常 `case-146` 也已连续复测 3/3 成功，但仍应将其作为随机失败
样本保留在人工审阅记录中。

## 6. Provider 条款复核状态

2026-09-01 仅查阅 DeepSeek 官方公开条款和文档，未把公开页面直接视为生产批准：

- [DeepSeek Open Platform Terms of Service](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html)
  要求下游开发者自行承担终端用户隐私告知、同意/合法处理基础、权利响应和安全措施责任，并要求 API Key
  保持在服务端，不暴露给浏览器或客户端；
- [DeepSeek Privacy Policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)
  适用于其服务（包括 API），但明确下游应用终端用户数据处理不由该政策替代；政策列出用户输入/提示词等
  数据处理，并涉及服务改进/技术训练等用途描述；
- [DeepSeek API 文档](https://api-docs.deepseek.com/) 当前公开列出 `deepseek-v4-flash`、
  `deepseek-v4-pro` 等模型，本轮只实际评估了 `deepseek-v4-flash`。

因此，以下事项仍不能由本机评估自动得出“已批准”：Provider 侧实际保留期限、处理区域、是否使用输入改进/训练、
企业/DPA 或等效数据处理条款、终端用户告知与同意方式、异常/删除请求处理，以及本项目是否允许将账单、日程、
待办和行程文本发送给该 Provider。由于这些数据可能包含财务和行程信息，在组织隐私或法务责任人完成正式
生产审查前，不得启用生产 Provider。

## 7. 检查结果

- DeepSeek adapter 定向单元测试：PASS，1 file / 6 tests。
- API lint：PASS。
- API typecheck：PASS。
- API unit：PASS，32 files / 277 passed，12 files / 133 skipped（410 total）；提示词、评估器和状态文档更新后的回归已重跑。
- API build：PASS。
- 评估器、提示词及状态同步后的 `npm run check:context`：PASS；`npm run format:check`：PASS；`git diff --check`：PASS。
- 根 `npm run quality` 的既有依赖审计问题仍未解决：`@prisma/adapter-mariadb`、`mariadb` 被判定为未批准的高/严重风险依赖；本轮没有修改依赖或 lockfile。

## 8. H7 关闭结论与剩余发布门槛

H7 已由 Dada 于 2026-09-01 明确关闭；PR20 交付记为 `DONE_LOCAL / H7_CLOSED`。该关闭仅表示本轮
受控验证证据和当前阶段决策已通过人工门禁，不表示 Provider 已启用或 R1 已放行。

本轮人工决策已确认：

1. 当前阶段暂定使用 DeepSeek `deepseek-v4-flash`，不要求本轮再做 Qwen/OpenAI 对照；
2. 接受当前已复核的 Provider 条款作为本阶段决策输入；正式上线仍须遵守组织隐私与发布审查流程；
3. 接受本轮评估结果及当前 provisional schema/effect 判断，包括 `case-146` 的随机失败和 15 条不确定样例；
4. 预算采用 `Asia/Shanghai` 自然月，当前暂不固定金额上限，具体临时策略见 ADR-029。

因此，H7 的人工关闭动作已完成；Provider enablement、REL-04 和 R1 advancement 仍需各自遵循发布门禁。
本记录将 H7 标记为 `CLOSED`，但不把该状态扩展解释为生产 Provider 批准、真实用户试用或发布验收通过。

本记录不能替代 H7 关闭之外的生产隐私审查、真实用户试用或发布验收。
