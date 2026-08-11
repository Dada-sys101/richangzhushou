# ADR-027：AI Provider 接入、安全与评测策略

- Version: v1.0 Final
- Date: 2026-08-11
- Status: Accepted
- Accepted by: Dada（人工批准，2026-08-11）
- Related plan: `PLANS.md` v2.1.1 Final
- Related task: `AI-DECISION-001`
- Prerequisites: `V15-CTRL-001`、`PR6a`、ADR-026
- Stage: Stage 1 policy freeze before PR2

## Context

V1.5 将 AI Proposal 纳入 R1，但真实 Provider 尚未评测，AI 数据库、契约、路由、Proposal UI
与 Provider Adapter 也尚未实现。在 PR2 开始前，必须先冻结候选、网络和凭据边界、字段白名单、
日志与保留、预算和韧性参数、评测数据集/方法、provisional thresholds 以及不可降低的安全阈值。

本 ADR 只冻结经人工批准的 v1.0 Final 策略，不执行真实 Provider 评测，不实现 AI 代码、数据库、
API、凭据或云资源，也不冻结唯一 Provider。最终 Provider、模型和效果阈值必须等 PR20 受控真实
评测后再次人工批准。

## Decision

### 1. Provider 与模型候选

Provider 评测顺序固定为：

1. P1：DeepSeek；
2. P2：阿里云百炼 / Qwen；
3. P3：OpenAI，仅作对照。

模型候选固定为：

- DeepSeek V4 Flash（默认 non-thinking）；
- DeepSeek V4 Pro；
- Qwen 3.7 Plus；
- GPT-5.4 nano；
- GPT-5.4 mini。

当前不冻结唯一 Provider。PR20 完成受控真实评测后，才可提出 final provider、final model 和
final effect thresholds，并再次取得人工批准。

### 2. 网络与切换边界

固定调用路径为：

```text
Browser/PWA -> Daily Assistant API -> AiProviderAdapter -> Provider HTTPS
```

浏览器不得直连 Provider，也不得持有 Provider credential。R1 禁止自动跨 Provider fallback；
Provider 只能通过服务端受控配置切换。

### 3. Credential 边界

Credential 只允许来自 server secret/environment reference，或未来经单独批准的 secret manager。
禁止将 credential 放入 frontend bundle、Git、repository、业务数据库明文、日志、telemetry 或
browser storage。本任务不创建、读取或测试任何真实 credential。

### 4. Proposal 链与正式写入

保持 ADR-V15-002 定义的 `AiRequest`、`AiProposal`、`AiOperation`、`AiProviderAttempt`。固定链路为：

```text
Provider response -> parse -> JSON Schema validation -> domain validation -> AiProposal
-> 用户检查/编辑/补充 -> 最终确认 -> 正式 domain service -> business tables
```

Provider output 禁止直接写入业务表，禁止直接调用业务写 API，禁止绕过正式 domain service。
正式业务写入必须 100% 经过用户最终确认。

### 5. 唯一字段白名单

发送给 Provider 的唯一 whitelist 为：

- `userInput`
- `requestType`
- `locale`
- `timeZoneId`
- `currentDateTime`
- `currency`
- `allowedCategoryLabels`
- `explicitSelectedContext`

`explicitSelectedContext` 仅包含用户主动选择的上下文，系统不得自动扩大。默认禁止发送完整历史
账单、完整任务列表、完整日历、联系人、phone、email、真实数据库 `userId`、cookie、access token、
refresh token、API Key、身份证、银行卡、无关个人数据和设备敏感信息。用户主动写入 `userInput`
的内容属于本次输入，但这不允许系统自动扩张或补充额外上下文。

### 6. 日志、标识与数据保留

Raw Provider response 不持久化；request/response 正文不得进入普通日志。仅允许记录以下 metadata：

- `requestId`
- provider/model identifier
- latency
- token usage
- result type
- schema validation status
- error category
- retry count
- circuit breaker state
- cost metadata

metadata 不得包含 raw input/output、secret、token、cookie 或 credential。传给 Provider 的用户标识
仅允许随机或哈希 pseudonymous id，默认不得使用 email、phone 或真实数据库 `userId`。

### 7. 失败时保留输入

所有 timeout、network、provider、schema、domain、circuit、budget、malformed failure 都必须保留
原始输入，不得清空、覆盖或使用户无法恢复。

### 8. Timeout 与 Retry

- timeout：15 seconds；
- 最多 retry 1 次；
- 仅 network、timeout、HTTP 429、HTTP 5xx 允许 retry；
- 普通 HTTP 4xx、authentication、authorization、schema invalid、domain invalid、safety、budget
  不得 retry。

### 9. Circuit Breaker

以下参数为 provisional engineering policy：

- rolling window：20 requests；
- technical failure rate `>=50%` 且 failure count `>=5` 时进入 `OPEN`；
- `OPEN` 60 seconds 后进入 `HALF_OPEN`；
- `HALF_OPEN` 只允许 single probe；
- probe 成功进入 `CLOSED`，失败重新进入 `OPEN`。

### 10. Budget

- 每用户：warning `¥3/month`，hard `¥5/month`；
- 小规模总体：warning `¥30/month`，hard `¥50/month`。

达到 hard budget 后不得发起真实 Provider 调用，必须返回可恢复结果并保留原始输入；客户端不得
绕过服务端 budget gate。

### 11. 评测数据集与方法

评测集固定为 200 条非真实数据，只允许人工构造和脱敏合成，禁止使用真实历史数据。分类数量固定为：

| Category | Count |
| --- | ---: |
| Finance/Transaction | 60 |
| Task | 40 |
| Calendar | 35 |
| Reminder | 30 |
| Trip | 20 |
| Ambiguous/missing/failure | 15 |
| Total | 200 |

数据集必须覆盖中文口语、相对日期/时间、金额、币种、缺时间、缺对象、多意图、冲突/模糊字段、
需要补充而不得猜测、malformed JSON、prompt injection、unsupported intent、provider failure、
schema failure。本任务不执行评测。

### 12. Provisional Effect Thresholds

- Schema success `>=99%`。定义为：parse success AND JSON Schema valid AND field types valid
  AND no non-whitelisted fields。
- 无需完全重录 `>=85%`。定义为：用户可以直接接受、只编辑少量字段，或回答补充问题后完成
  Proposal，而不需要重新输入完整请求。

以上是 PR20 受控真实评测前的 provisional thresholds，不是最终效果承诺。

### 13. Immutable Safety Thresholds

以下四项从 Stage 1 起不可降低，PR20 不得降低：

1. failure 必须保留原始输入；
2. 正式业务写入 100% 经用户最终确认；
3. Provider output 不得直接写业务表或绕过正式 domain service；
4. 敏感字段不得越过唯一 whitelist。

### 14. Two-stage Freeze

Stage 1（本任务）冻结 candidates、network、credential、whitelist、logging、retention、budget、
timeout、retry、breaker、dataset、method、provisional thresholds 和 immutable safety thresholds。

Stage 2（PR20）在受控真实评测后提出 final provider、final model 和 final effect thresholds，必须
再次取得人工批准，且不得降低任何 immutable safety threshold。

## Consequences

- PR2 可以在本任务达到 `DONE_INTEGRATION` 后按已冻结策略继续；本 ADR 不授权自动启动 PR2。
- R1 不得实现浏览器直连、跨 Provider 自动 fallback、raw response 持久化或未经用户最终确认的写入。
- H7 仍保持 OPEN；本次人工批准不等于真实 Provider 验证、PR20 merge 或 R1 发布批准。
- 任何真实 credential、真实调用、真实用户数据、云资源、实现、commit、push、PR、merge 或部署
  仍需各自独立授权。

## Approval Record

- [x] v1.0 Final 人工批准
- [x] Provider/模型候选与评测顺序
- [x] 网络、credential、白名单、日志与保留边界
- [x] timeout/retry/breaker/budget 参数
- [x] 200 条非真实评测数据规范
- [x] provisional effect thresholds
- [x] immutable safety thresholds
- [x] two-stage freeze
- [ ] PR20 受控真实评测
- [ ] final provider/model/effect thresholds 人工批准

本 ADR 的 Stage 1 决策已 Accepted；未勾选项不得被解释为已完成。
