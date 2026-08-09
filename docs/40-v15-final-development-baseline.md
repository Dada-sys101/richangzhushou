# 日常助手 V1.5 最终开发需求与集成基线

> 文档路径：`docs/40-v15-final-development-baseline.md`  
> 文档版本：V1.0  
> 当前状态：`FROZEN`  
> 确认人：Dada  
> 确认日期：2026-08-09  
> 生效分支：`codex/v15-integration-foundation`  
> 取代文档：PoC 证据分支中的 `docs/30-v15-technology-selection-freeze-draft.md`  
> PoC 证据分支：`codex/v15-tech-selection-poc`  
> PoC 关闭提交：`abeaa6444c116a59f5c139b2f56488a2f97b53f4`

> [!CAUTION]
> **本文档为 V1.5 正式开发的唯一依据，取代旧版技术选型草案中的简化模型。**
>
> **在门禁 1～8 全部关闭前，严禁：合并 main、部署生产、自动激活 IndexedDB v2、清理用户 v1 数据、发送真实 Web Push、接入真实或付费 AI API、将新 RRULE 调度器切为生产主引擎、向用户开放真实导入功能。**

## 0. 文档适用范围

本文件冻结以下内容：

1. V1.5 已确认的技术与架构决策；
2. PoC 到正式项目代码的集成边界；
3. 数据库 Expand 阶段目标结构；
4. 功能开关和启用权限；
5. PR1～PR23 的开发与评审顺序；
6. 人工门禁与各模块的启用关系；
7. 第一批允许开始编码的范围。

本文件不代表：

- 生产上线批准；
- 数据库 Shrink 批准；
- IndexedDB v1 数据删除批准；
- 真实推送发送批准；
- 真实 AI 服务调用批准；
- 第三方许可证人工法律结论；
- 门禁 1～8 已完成。

出现冲突时，执行优先级为：

```text
本文件
→ 已批准的补充 ADR/变更记录
→ V1.5 PR 验收标准
→ 旧版需求或技术选型文档
```

旧文档与本文件冲突的内容一律失效。

# 一、架构决策冻结清单

## ADR-V15-001：重复规则采用 rrule-temporal

### 决策

V1.5 重复事件和重复提醒正式采用：

- `rrule-temporal`；
- 显式 IANA `TZID`；
- 默认 `WALL_CLOCK` 时间语义；
- 统一通过项目内部 `RecurrenceEngine` 接口访问；
- 第三方 RRULE 库不得直接渗透到 Controller、业务实体或前端 Store。

正式规则数据至少必须保存：

- 标准化 RRULE；
- `timeZoneId`；
- `timeMode`；
- 本地墙钟起始时间；
- 对应 UTC instant；
- 规则版本；
- canonical hash。

用户创建的日程和提醒默认使用：

```text
WALL_CLOCK + 系列 TZID
```

只有明确属于系统绝对时间任务的场景，才能使用：

```text
ABSOLUTE_INSTANT
```

### 理由

用户通常期望“每天当地时间 08:00”在夏令时变化后仍保持当地 08:00，而不是保持固定 UTC 偏移；显式 TZID 和 WALL_CLOCK 能避免服务器时区、设备时区与 DST 造成语义漂移。

## ADR-V15-002：AI 使用独立 AiProposal / AiOperation 体系

### 决策

AI 功能新建独立领域模型：

- `AiRequest`；
- `AiProposal`；
- `AiOperation`；
- `AiProviderAttempt`。

不得通过扩展现有 `DraftRecord` 承载完整 AI 功能。

`DraftRecord` 继续服务于当前交易草稿流程。AI 提案可以通过可选引用与 DraftRecord 关联，但 AiProposal 不依赖 DraftRecord 才能存在。

所有 AI 输出必须经过：

1. Provider 响应解析；
2. JSON Schema 校验；
3. 领域规则校验；
4. 生成只读提案；
5. 用户逐项接受、拒绝或补充；
6. 由正式领域 Service 写入业务表。

禁止原始 Provider 输出直接写入：

- Transaction；
- CalendarEvent；
- Task；
- Reminder；
- Trip；
- 其他业务实体。

### 理由

现有 DraftRecord 只支持交易草稿，而 AI 提案可能同时包含交易、任务、日程、提醒和行程；独立模型可以避免把多领域状态机强行塞入单一交易草稿结构，并保证用户确认边界清晰。

## ADR-V15-003：IndexedDB 使用 v1→v2 双版本 Repository

### 决策

客户端采用统一的 `MigrationAwareRepository`，底层包含：

- `V1PlainRepository`；
- `V2EncryptedRepository`；
- `MigrationAwareRepository`；
- `MigrationCoordinator`；
- `StartupStateMachine`。

业务组件、Pinia Store、同步模块和导入功能不得直接访问：

- `entities`；
- `pending`；
- `entities_v2`；
- `pending_v2`；
- 其他具体 object store 名称。

迁移阶段采用：

```text
v1 主读
→ v2 shadow copy
→ 解密/数量/hash 校验
→ 原子 activeSchema 切换
→ v2 主读、v1/v2 双写保留期
→ 满足清理条件后 v2-only
```

迁移过程中：

- 允许读取 v1；
- 阻塞业务写入；
- 暂停同步 pull/flush；
- 支持关闭页面后恢复；
- 使用 Web Lock 避免多标签页并发迁移；
- 迁移失败不得破坏 v1。

### 本地加密规则

v2 受保护内容采用：

- Web Crypto AES-256-GCM；
- 不可导出的设备级 CryptoKey；
- 每条记录使用唯一 IV；
- AAD 绑定用户、实体类型、实体 ID 和密钥版本；
- 密钥包含显式版本；
- 明确退出、关闭账号或删除账号时同时删除密钥和密文。

### 动态保留策略

v1 保留时间不得写死在客户端代码中。

由 `ClientMigrationPolicy` 提供：

- 最短保留天数；
- 清理窗口开始天数；
- 清理窗口结束天数；
- 当前策略版本；
- 是否允许迁移；
- 是否允许清理。

初始估算值可以配置为：

```text
minRetentionDays = 7
cleanupWindowStartDays = 7
cleanupWindowEndDays = 14
```

但这些只是初始配置，不是代码常量。

门禁 5 的 iOS 长时间存储观察完成后，可以通过发布新策略版本调整天数，不修改迁移算法本身。

客户端离线、策略缺失或策略过期时：

- 可以根据安全条件完成 v1→v2 复制；
- 可以使用已经验证的 v2；
- 不得自动清理 v1。

### 理由

双版本 Repository 能让现有业务代码不感知底层 store，并在迁移失败或激活后早期异常时保留回退能力；动态策略可以等待真实 iOS 存储结果后调整保留周期，而不需要重新修改和发布迁移核心逻辑。

## ADR-V15-004：Web Push 使用独立订阅和送达记录

### 决策

Web Push 使用独立模型：

- `PushSubscription`；
- `PushDelivery`。

订阅、端点状态、设备信息和发送记录不得塞入 Reminder 表。

正式 PWA 使用自定义 Service Worker，支持：

- `push` 事件；
- `notificationclick` 事件；
- 安全相对深链；
- 订阅更新；
- 订阅失效处理；
- 可选客户端展示确认回传。

Push 是 best-effort 通道，不是提醒事实源。

以下状态必须明确区分：

- 系统已排队；
- 服务端正在发送；
- Push Service 已接受；
- 订阅已过期；
- 永久失败；
- 客户端确认已展示。

`ACCEPTED_BY_PUSH_SERVICE` 不得被描述为“用户已经收到”。

### 理由

一个用户可能有多台设备和多个订阅，单一 Reminder 无法表达逐端点的发送生命周期；独立表结构也能支持重试、幂等、过期订阅清理和审计。

## ADR-V15-005：CSV 流式处理，XLSX 受限单并发

### 决策

账单导入正式采用：

- CSV：服务端流式解析；
- XLSX：服务端受控解析；
- XLSX 默认单实例单并发；
- 文件大小、行数、工作表数量和处理时间必须设上限；
- 先预检，再由用户确认写入；
- 通过 `FinanceImportWriter` 和现有 FinanceService/Repository 写入。

导入模块不得直接写入：

- IndexedDB `entities`；
- IndexedDB `entities_v2`；
- 迁移 shadow stores；
- Prisma Transaction 表的绕过式原始 SQL。

正式写入路径固定为：

```text
Parser
→ Validator
→ ImportBatchService
→ FinanceImportWriter
→ FinanceService / TransactionRepository
→ Sync Change Flow
→ 客户端当前活动 Repository
```

### 理由

CSV 适合流式处理，而 XLSX 解压和解析存在显著内存放大；受控单并发可以避免小型部署环境因多个 XLSX 同时解析而耗尽内存，同时保持业务写入、去重和同步规则一致。

## ADR-V15-006：数据库统一采用渐进式变更

### 决策

所有 V1.5 数据库结构变更统一采用：

```text
expand
→ backfill
→ dual-read
→ cutover
→ shrink
```

具体要求：

- Expand 只增加新表、新字段、新索引和兼容接口；
- Expand 阶段不删除旧字段；
- Backfill 必须可重复执行、可暂停、可审计；
- Dual-read 必须记录新旧结果一致性；
- Cutover 由功能开关控制；
- Shrink 必须独立 PR；
- Shrink 不得与首次功能上线处于同一个 PR；
- 旧字段和旧数据的删除必须另行批准。

### 理由

渐进式迁移能让新旧客户端、后台任务和数据库结构在过渡期共存，并在发现不一致时通过关闭开关恢复旧路径，避免一次性替换造成不可逆故障。

## ADR-V15-007：依赖治理进入正式 CI

### 决策

PoC 中的依赖治理能力迁移到正式 `tools/dependency-governance/`，并接入主 CI。

正式 CI 至少强制：

- 许可证 allow/review/deny；
- CycloneDX SBOM；
- npm audit；
- THIRD_PARTY_NOTICES；
- 例外负责人；
- 例外原因；
- 例外到期时间；
- SBOM、许可证矩阵和 notices 覆盖一致性。

`web-push@3.6.7` 的 MPL-2.0 保持人工评审状态，不得被自动标记为法律批准。

### 理由

许可证、漏洞和供应链证据必须伴随正式依赖持续更新，而不能只在 PoC 阶段生成一次。

# 二、功能开关机制

## 2.1 选定机制

V1.5 不引入外部 SaaS Feature Flag 服务。

采用：

```text
环境变量安全总闸
+
MySQL SystemSetting.featureFlagsJson 运行时开关
+
AdminAudit 审计
```

现有 `SystemSetting` 保持 singleton 模式，Expand 阶段新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `featureFlagsJson` | JSON | 各模块运行时开关 |
| `featureFlagsVersion` | Int | 配置结构版本 |
| `featureFlagsUpdatedAt` | DateTime nullable | 最后更新时间 |
| `featureFlagsUpdatedBy` | String nullable | 管理员 ID |

有效状态计算规则：

```text
effectiveFlag = environmentAllowSwitch AND databaseFeatureFlag
```

环境变量为硬总闸。即使数据库配置被误开启，只要环境变量不允许，对应功能仍保持关闭。

## 2.2 模块粒度

功能开关不是单一 V1.5 总开关，而是按模块、按阶段拆分。

### RRULE

- `v15.rrule.write`
- `v15.rrule.dualRead`
- `v15.rrule.primaryRead`
- `v15.rrule.scheduler`

### IndexedDB

- `v15.indexeddb.v2Schema`
- `v15.indexeddb.migration`
- `v15.indexeddb.v2Primary`
- `v15.indexeddb.dualWrite`
- `v15.indexeddb.cleanup`

### Import

- `v15.import.upload`
- `v15.import.dryRun`
- `v15.import.write`
- `v15.import.userVisible`

### Web Push

- `v15.push.subscription`
- `v15.push.serviceWorker`
- `v15.push.enqueue`
- `v15.push.send`

### AI

- `v15.ai.proposal`
- `v15.ai.fakeProvider`
- `v15.ai.liveProvider`
- `v15.ai.businessWrite`

### Governance

依赖治理属于 CI 强制规则，不设置运行时业务开关。

## 2.3 环境变量总闸

建议对应环境变量：

```text
V15_RRULE_ALLOWED=false
V15_INDEXEDDB_V2_ALLOWED=false
V15_IMPORT_ALLOWED=false
V15_WEB_PUSH_ALLOWED=false
V15_AI_ALLOWED=false
V15_LIVE_PUSH_ALLOWED=false
V15_LIVE_AI_ALLOWED=false
V15_INDEXEDDB_CLEANUP_ALLOWED=false
```

默认值全部为 `false`。

任何变量缺失、无法解析或值不在允许集合内，都按 `false` 处理。

## 2.4 默认状态

V1.5 第一批代码进入隔离开发分支后：

- 所有新业务开关默认关闭；
- 当前用户界面和行为不得发生变化；
- 不创建真实订阅；
- 不迁移用户 IndexedDB；
- 不读取新 RRULE 作为生产主规则；
- 不发送 Push；
- 不访问真实 AI；
- 不写入真实导入交易。

允许在自动化测试中使用：

- 内存配置；
- Fake Provider；
- Stub Push Adapter；
- 测试数据库；
- 临时 IndexedDB；
- 合成导入文件。

## 2.5 权限和修改方式

### 环境变量

只能由具备部署配置权限的维护者修改。

修改环境变量必须：

- 有变更记录；
- 指定对应门禁；
- 说明回滚方式；
- 经 Dada 批准。

### 数据库运行时开关

只能通过管理员 API 或后台设置页修改。

权限要求：

- `ADMIN` 角色；
- 重新验证当前登录状态；
- 必须填写变更原因；
- 写入 `AdminAudit`；
- 记录 before/after；
- 记录操作者、requestId 和时间。

普通用户、客户端 JavaScript 和 Service Worker 不得直接修改功能开关。

### 开启顺序

任何模块必须按阶段开启，不得直接跳到最终开关。

RRULE：

```text
write → dualRead → primaryRead → scheduler
```

IndexedDB：

```text
v2Schema → migration → dualWrite → v2Primary → cleanup
```

# 三、数据库 Expand 阶段表结构

本节冻结目标字段集合。具体 Prisma 语法、索引名称和迁移 SQL 在对应 PR 中实现，但不得偏离本节语义。

## 3.1 RRULE 表组

### 3.1.1 `ReminderRecurrenceRule`

映射表名：`reminder_recurrence_rules`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `reminderId` | String | 唯一外键，关联 Reminder |
| `engine` | Enum/String | `RRULE_TEMPORAL` |
| `schemaVersion` | SmallInt | 规则结构版本 |
| `rruleText` | Text | 标准化 RRULE |
| `timeZoneId` | VarChar(64) | IANA TZID |
| `timeMode` | Enum | `WALL_CLOCK` / `ABSOLUTE_INSTANT` |
| `dtstartLocal` | DateTime nullable | 墙钟起始时间 |
| `dtstartInstant` | DateTime | UTC instant |
| `canonicalHash` | Char(64) | 规范化规则摘要 |
| `parentRuleId` | String nullable | 系列拆分来源 |
| `splitFromOccurrenceKey` | VarChar(128) nullable | 拆分 occurrence |
| `backfillStatus` | Enum | 回填状态 |
| `backfilledAt` | DateTime nullable | 回填时间 |
| `dualReadVerifiedAt` | DateTime nullable | 一致性验证时间 |
| `parityMismatchCount` | Int | 不一致次数 |
| `version` | Int | 乐观锁 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

主要约束和索引：

- `reminderId` 唯一；
- `parentRuleId` 索引；
- `backfillStatus` 索引；
- `timeZoneId` 索引；
- `dualReadVerifiedAt` 索引。

### 3.1.2 `ReminderRecurrenceException`

映射表名：`reminder_recurrence_exceptions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `recurrenceRuleId` | String | 规则外键 |
| `occurrenceKey` | VarChar(128) | 稳定 occurrence 标识 |
| `originalOccurrenceAt` | DateTime | 原始 UTC 时间 |
| `exceptionType` | Enum | `CANCEL` / `REPLACE` |
| `replacementLocalAt` | DateTime nullable | 替换墙钟时间 |
| `replacementInstantAt` | DateTime nullable | 替换 UTC 时间 |
| `replacementTimeZoneId` | VarChar(64) nullable | 替换 TZID |
| `replacementPayloadJson` | JSON nullable | 有限覆盖字段 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

主要约束：

- `recurrenceRuleId + occurrenceKey` 唯一；
- 删除 RecurrenceRule 时级联删除；
- “本次及以后”通过新系列实现，不写入本表。

## 3.2 AI 表组

### 3.2.1 `AiRequest`

映射表名：`ai_requests`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `userId` | String | 用户外键 |
| `requestId` | VarChar(100) | 客户端请求 ID |
| `idempotencyKey` | VarChar(200) | 幂等键，唯一 |
| `inputFingerprint` | Char(64) | 输入摘要 |
| `locale` | VarChar(20) | 语言 |
| `timeZoneId` | VarChar(64) | 请求 TZID |
| `status` | Enum | `CLAIMED/RUNNING/SUCCEEDED/FAILED/CANCELLED` |
| `proposalId` | String nullable | 成功提案 |
| `failureCategory` | VarChar(50) nullable | 失败分类 |
| `failureCode` | VarChar(100) nullable | 稳定错误码 |
| `startedAt` | DateTime nullable | 开始时间 |
| `completedAt` | DateTime nullable | 结束时间 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

不得默认保存完整原始提示正文。

### 3.2.2 `AiProposal`

映射表名：`ai_proposals`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `userId` | String | 用户外键 |
| `aiRequestId` | String | 唯一请求外键 |
| `sourceDraftId` | String nullable | 可选 DraftRecord 引用 |
| `providerId` | VarChar(80) | Provider |
| `modelId` | VarChar(120) | 模型 ID |
| `status` | Enum | 提案状态 |
| `schemaVersion` | SmallInt | 响应结构版本 |
| `responseFingerprint` | Char(64) | 响应摘要 |
| `usageJson` | JSON nullable | Token/用量 |
| `expiresAt` | DateTime nullable | 过期时间 |
| `reviewedAt` | DateTime nullable | 审核时间 |
| `completedAt` | DateTime nullable | 完成时间 |
| `version` | Int | 乐观锁 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

Proposal 状态：

```text
PENDING_REVIEW
PARTIALLY_APPLIED
APPLIED
REJECTED
EXPIRED
FAILED
CANCELLED
```

### 3.2.3 `AiOperation`

映射表名：`ai_operations`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `proposalId` | String | Proposal 外键 |
| `ordinal` | SmallInt | 提案内顺序 |
| `operationType` | Enum | 交易/日程/任务/提醒/行程 |
| `status` | Enum | 操作状态 |
| `confidence` | Decimal(5,4) | 置信度 |
| `fieldsJson` | JSON | 结构化字段 |
| `fieldsFingerprint` | Char(64) | 确认前防替换摘要 |
| `clarification` | VarChar(500) nullable | 补充问题 |
| `resultEntityType` | VarChar(50) nullable | 结果实体类型 |
| `resultEntityId` | String nullable | 结果实体 ID |
| `resultDraftId` | String nullable | 可选 DraftRecord 引用 |
| `errorCode` | VarChar(100) nullable | 错误码 |
| `errorMessage` | VarChar(500) nullable | 安全错误摘要 |
| `acceptedAt` | DateTime nullable | 接受时间 |
| `rejectedAt` | DateTime nullable | 拒绝时间 |
| `appliedAt` | DateTime nullable | 写入时间 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

Operation 状态：

```text
PENDING
ACCEPTED
REJECTED
APPLIED
FAILED
EXPIRED
```

唯一约束：`proposalId + ordinal`。

### 3.2.4 `AiProviderAttempt`

映射表名：`ai_provider_attempts`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `aiRequestId` | String | 请求外键 |
| `attemptNo` | SmallInt | 尝试顺序 |
| `providerId` | VarChar(80) | Provider |
| `modelId` | VarChar(120) nullable | 模型 |
| `status` | Enum | 尝试状态 |
| `failureCategory` | VarChar(50) nullable | 失败分类 |
| `httpStatus` | SmallInt nullable | HTTP 状态 |
| `latencyMs` | Int nullable | 延迟 |
| `inputTokens` | Int nullable | 输入 Token |
| `outputTokens` | Int nullable | 输出 Token |
| `startedAt` | DateTime | 开始时间 |
| `completedAt` | DateTime nullable | 完成时间 |

唯一约束：`aiRequestId + attemptNo`。

## 3.3 Web Push 表组

### 3.3.1 `PushSubscription`

映射表名：`push_subscriptions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `userId` | String | 用户外键 |
| `deviceId` | VarChar(100) | 稳定设备标识 |
| `deviceLabel` | VarChar(100) nullable | 用户可见名称 |
| `platform` | Enum | iOS PWA/Android/Desktop 等 |
| `browserName` | VarChar(50) nullable | 浏览器 |
| `browserVersion` | VarChar(50) nullable | 浏览器版本 |
| `osName` | VarChar(50) nullable | 系统 |
| `osVersion` | VarChar(50) nullable | 系统版本 |
| `userAgentHash` | Char(64) nullable | UA 摘要 |
| `endpointHash` | Char(64) | endpoint 摘要 |
| `endpointCiphertext` | Text | 加密 endpoint |
| `p256dhCiphertext` | Text | 加密 p256dh |
| `authCiphertext` | Text | 加密 auth |
| `encryptionKeyVersion` | Int | 字段加密版本 |
| `contentEncoding` | VarChar(30) | 内容编码 |
| `permissionState` | Enum | DEFAULT/GRANTED/DENIED |
| `status` | Enum | ACTIVE/EXPIRED/REVOKED/INVALID |
| `failureCount` | Int | 连续失败 |
| `subscribedAt` | DateTime | 订阅时间 |
| `lastSeenAt` | DateTime nullable | 最后确认 |
| `lastSuccessAt` | DateTime nullable | 最后成功接受 |
| `expiresAt` | DateTime nullable | 过期时间 |
| `revokedAt` | DateTime nullable | 撤销时间 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

唯一约束：`userId + endpointHash`。

### 3.3.2 `PushDelivery`

映射表名：`push_deliveries`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `pushId` | VarChar(100) | 逻辑推送 ID |
| `userId` | String | 用户外键 |
| `subscriptionId` | String nullable | Subscription 外键 |
| `reminderId` | String nullable | 来源 Reminder |
| `idempotencyKey` | VarChar(200) | 唯一幂等键 |
| `payloadFingerprint` | Char(64) | 负载摘要 |
| `deepLink` | VarChar(500) nullable | 安全相对路径 |
| `topic` | VarChar(64) nullable | Push topic |
| `urgency` | Enum | VERY_LOW/LOW/NORMAL/HIGH |
| `ttlSeconds` | Int | TTL |
| `status` | Enum | 发送状态 |
| `attemptCount` | Int | 尝试次数 |
| `nextAttemptAt` | DateTime nullable | 下次重试 |
| `lastAttemptAt` | DateTime nullable | 最近尝试 |
| `acceptedAt` | DateTime nullable | Push Service 接受 |
| `failedAt` | DateTime nullable | 最终失败 |
| `httpStatus` | SmallInt nullable | HTTP 状态 |
| `failureCategory` | VarChar(50) nullable | 失败分类 |
| `failureCode` | VarChar(100) nullable | 错误码 |
| `retryAfterSeconds` | Int nullable | 重试等待 |
| `clientAcknowledgedAt` | DateTime nullable | 客户端展示确认 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

状态：

```text
QUEUED
CLAIMED
SENDING
ACCEPTED_BY_PUSH_SERVICE
RETRY_SCHEDULED
EXPIRED_SUBSCRIPTION
PERMANENT_FAILURE
CANCELLED
```

订阅删除后 Delivery 使用 `SetNull`，保留审计记录。

## 3.4 Import 表组

### 3.4.1 `ImportBatch`

映射表名：`import_batches`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `userId` | String | 用户外键 |
| `sourceSystem` | Enum | WECHAT/ALIPAY/GENERIC |
| `fileName` | VarChar(255) | 文件名 |
| `fileExtension` | VarChar(10) | csv/xlsx |
| `mimeType` | VarChar(100) | MIME |
| `fileSizeBytes` | BigInt | 文件大小 |
| `fileSha256` | Char(64) | 文件摘要 |
| `sourceObjectKey` | VarChar(500) nullable | 临时存储键 |
| `sourceRetentionUntil` | DateTime nullable | 文件保留截止 |
| `sourceDeletedAt` | DateTime nullable | 文件删除时间 |
| `parserVersion` | VarChar(30) | 解析器版本 |
| `mappingProfileVersion` | VarChar(30) | 映射版本 |
| `importPolicy` | Enum | ATOMIC/VALID_ROWS |
| `status` | Enum | 批次状态 |
| `totalRows` | Int | 数据行数 |
| `validRows` | Int | 有效行数 |
| `successCount` | Int | 成功 |
| `failureCount` | Int | 失败 |
| `skippedCount` | Int | 跳过 |
| `duplicateCount` | Int | 重复 |
| `warningCount` | Int | 警告 |
| `errorSummaryJson` | JSON nullable | 错误汇总 |
| `writerVersion` | VarChar(30) | 活动仓储写入器版本 |
| `startedAt` | DateTime nullable | 开始 |
| `completedAt` | DateTime nullable | 完成 |
| `createdBy` | String | 操作人 |
| `version` | Int | 乐观锁 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

完成后必须满足：

```text
successCount + failureCount + skippedCount + duplicateCount = totalRows
```

### 3.4.2 `ImportItem`

映射表名：`import_items`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `batchId` | String | Batch 外键 |
| `userId` | String | 用户 |
| `sourceSystem` | Enum | 来源系统 |
| `sourceRowNumber` | Int | 原文件行号 |
| `externalTransactionId` | VarChar(150) nullable | 来源交易号 |
| `deduplicationKey` | Char(64) | 去重摘要 |
| `status` | Enum | 行状态 |
| `transactionId` | String nullable | 成功交易 ID |
| `sourceRowFingerprint` | Char(64) | 原行摘要 |
| `errorCode` | VarChar(100) nullable | 错误码 |
| `errorMessage` | VarChar(500) nullable | 安全错误信息 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

约束：

- `batchId + sourceRowNumber` 唯一；
- `userId + sourceSystem + deduplicationKey` 唯一或由等价去重表保证；
- 写入必须调用当前活动业务仓储接口。

## 3.5 `ClientMigrationPolicy`

映射表名：`client_migration_policies`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String/CUID | 主键 |
| `migrationId` | VarChar(100) | 迁移标识，唯一 |
| `sourceSchemaVersion` | Int | 源版本 |
| `targetSchemaVersion` | Int | 目标版本 |
| `policyVersion` | Int | 当前策略版本号 |
| `minRetentionDays` | Int | 最短保留天数 |
| `cleanupWindowStartDays` | Int | 清理窗口开始天数 |
| `cleanupWindowEndDays` | Int | 清理窗口结束天数 |
| `requiredColdStartCount` | Int | 要求冷启动次数 |
| `enabled` | Boolean | 是否允许迁移 |
| `cleanupEnabled` | Boolean | 是否允许清理 |
| `effectiveFrom` | DateTime | 生效时间 |
| `effectiveUntil` | DateTime nullable | 失效时间 |
| `updatedBy` | String nullable | 管理员 |
| `createdAt` | DateTime | 创建 |
| `updatedAt` | DateTime | 更新 |

硬校验：

```text
minRetentionDays >= 0
cleanupWindowStartDays >= minRetentionDays
cleanupWindowEndDays >= cleanupWindowStartDays
policyVersion >= 1
requiredColdStartCount >= 1
```

策略更新必须：

- 创建新版本或提高 `policyVersion`；
- 记录管理员审计；
- 不覆盖客户端已经使用的策略快照；
- 不允许通过缩短时间绕过已经开始的安全保留期。

# 四、PR1～PR23 拆分简表

## 4.1 全局规则

以下 PR 可以在隔离分支开发并创建 Draft PR。

但在门禁 1～8 全部关闭前：

- 不得合并到 `main`；
- 不得部署生产；
- 不得开启真实业务功能。

“功能开关状态”表示代码默认运行状态，不表示允许上线。

| PR编号 | 内容 | 前置依赖 | 依赖门禁 | 功能开关状态 |
|---|---|---|---|---|
| PR1 | 数据库 Expand：RRULE Rule/Exception 表 | 无 | 无专项门禁；全局禁止合并 main | 关闭，无运行时读写 |
| PR2 | 数据库 Expand：AiRequest/Proposal/Operation/Attempt 表 | 无 | 无专项门禁；全局禁止合并 main | 关闭 |
| PR3 | 数据库 Expand：PushSubscription/Delivery 表 | 无 | 引入 web-push 前依赖门禁8 | 关闭 |
| PR4 | 数据库 Expand：ImportBatch/Item、ClientMigrationPolicy 和 SystemSetting 开关字段 | 无 | 无专项门禁；全局禁止合并 main | 关闭 |
| PR5 | API Contracts、枚举、DTO 和分模块功能开关 | PR1～PR4 | 无专项门禁 | 全部关闭 |
| PR6 | 依赖治理工具迁入正式 CI | 无 | web-push 最终许可依赖门禁8 | CI 强制；业务开关不适用 |
| PR7 | RRULE 核心封装、规范化、occurrence key、exception 计算 | PR1、PR5、PR6 | 无专项门禁 | RRULE 全部关闭 |
| PR8 | RRULE Backfill 工具和 dual-read parity | PR7 | 不得切主引擎 | 仅测试/离线工具 |
| PR9 | IndexedDB 统一 Repository 接口和 V1PlainRepository | PR5 | 门禁1～4影响后续切换 | 仍使用 v1 |
| PR10 | V2EncryptedRepository、本地密钥与加密 metadata | PR9 | 门禁1～4 | v2 不激活 |
| PR11 | IndexedDB MigrationCoordinator、journal、启动状态机和迁移 UI | PR4、PR10 | 门禁1、2、3、4 | 自动迁移关闭 |
| PR12 | v2 dual-read/dual-write、动态保留和清理资格 | PR11 | 门禁1～5 | v2 主读与清理关闭 |
| PR13 | RRULE 主读切换和调度器集成 | PR8 | 门禁1～5；生产切换仍依赖1～8 | 新调度器关闭 |
| PR14 | Import Parser、CSV流式、XLSX单并发、dry-run | PR4、PR5、PR6 | 无真实用户开放 | 仅 dry-run，入口关闭 |
| PR15 | FinanceImportWriter、正式批次写入和导入 UI | PR14 | 门禁1、2、4影响移动验收 | 写入与用户入口关闭 |
| PR16 | Push 订阅 API、自定义 Service Worker 和权限 UI | PR3、PR5 | 门禁1、2、4 | 订阅与 SW 功能关闭 |
| PR17 | 真实 Web Push Provider、重试和失效订阅处理 | PR16、PR6 | 门禁6、8；未关闭不得合并 | 真实发送强制关闭 |
| PR18 | AiProposal/AiOperation Service、确认 UI、Fake Provider | PR2、PR5 | 无真实 AI 调用 | 仅 Fake，功能关闭 |
| PR19 | AI Router、能力缓存、超时、熔断和 Stub Provider | PR18、PR6 | 无真实 AI 调用 | live provider 关闭 |
| PR20 | 真实 AI Provider 配置与调用适配 | PR19 | 门禁7；未关闭不得合并 | 真实 Provider 强制关闭 |
| PR21 | Cutover 观测和管理页：parity、迁移、Import、Push、AI 指标 | PR12、PR13、PR15、PR17、PR20 | 继承各模块门禁 | 管理入口关闭 |
| PR22 | Shrink 准备、清理资格检查和回滚演练，不删除结构 | PR21 | 门禁1～8 | 不执行 Shrink |
| PR23 | 最终 Shrink：停止旧写入、清理合格 v1；旧数据库字段删除另行批准 | PR22 | 门禁1～8及单独清理批准 | 默认关闭，逐项批准 |

# 五、人工门禁现状

## 5.1 跟踪清单

- [ ] **1. 真实iPhone Safari普通网页测试**
  - 负责人：Dada本人
  - 当前状态：部分完成
  - 关闭条件：按正式协议归档设备型号、iOS版本、Safari版本、测试时间、结果和异常。

- [ ] **2. iPhone主屏幕PWA、关闭重开、离线重开测试**
  - 负责人：Dada本人
  - 当前状态：部分完成
  - 关闭条件：归档主屏幕安装、正常关闭、强制关闭、离线重开和恢复联网结果。

- [ ] **3. Safari无痕浏览行为单独记录**
  - 负责人：Dada本人
  - 当前状态：已观察，未形成独立验收记录
  - 关闭条件：明确记录无痕模式存储、关闭后保留和与普通模式差异。

- [ ] **4. 真实Android Chrome测试**
  - 负责人：Dada本人
  - 当前状态：未关闭
  - 关闭条件：完成 Android Chrome 普通网页、PWA、关闭重开、离线重开和 IndexedDB 验证。

- [ ] **5. iOS长时间存储保留观察**
  - 负责人：Dada本人
  - 当前状态：未关闭
  - 关闭条件：完成约定观察周期，记录存储是否被系统清除，并据此确认或修改 ClientMigrationPolicy 初始值。

- [ ] **6. 真实订阅的iPhone/Android/桌面Web Push送达测试**
  - 负责人：Dada本人
  - 当前状态：未关闭
  - 关闭条件：使用明确授权的测试订阅完成受控发送，并区分 Push Service 接受和设备实际展示。

- [ ] **7. 授权密钥对真实AI服务的额度、延迟、响应格式测试**
  - 负责人：Dada本人
  - 当前状态：未关闭
  - 关闭条件：明确 Provider、测试账号、费用上限和停止条件，记录能力、额度、延迟、错误和结构化响应结果。

- [ ] **8. web-push的MPL-2.0人工许可证评审**
  - 负责人：Dada本人
  - 当前状态：未关闭
  - 关闭条件：明确 MPL-2.0 对分发、修改、源码提供和 notices 的实际义务并形成评审记录。

- [x] **9. PoC模块到生产代码、数据库、UI的集成评审(即本文档)**
  - 负责人：Dada本人
  - 当前状态：已关闭
  - 完成内容：模块映射、迁移策略、数据库字段、Repository、启动状态机、PR拆分和关键架构决策已确认。

## 5.2 门禁与 PR 对应关系

### Web Push

真实发送 PR17 依赖：

```text
门禁6 + 门禁8
```

任一未关闭：

- 不得合并真实 Provider；
- `V15_LIVE_PUSH_ALLOWED=false`；
- `v15.push.send=false`。

### AI

真实 AI Provider PR20 依赖：

```text
门禁7
```

门禁未关闭：

- 只能使用 Fake/Stub；
- 不允许配置生产密钥；
- `V15_LIVE_AI_ALLOWED=false`；
- `v15.ai.liveProvider=false`。

### IndexedDB

自动迁移、v2 主读、双写和清理依赖：

```text
门禁1～5
```

门禁未关闭：

- 可以开发 Repository 和迁移代码；
- 可以运行自动化和专用测试；
- 不得对真实用户自动迁移；
- 不得自动激活 v2；
- 不得清理 v1。

### 最终生产切换

以下操作依赖门禁 1～8 全部关闭：

- 合并至 main；
- 部署生产；
- RRULE 新引擎成为生产主引擎；
- 用户可见真实导入；
- IndexedDB v2 自动激活；
- v1 清理；
- 真实 Push；
- 真实 AI Provider。

# 六、第一批可开发范围

## 6.1 允许立即开始

本文件已经 Dada 确认并正式冻结。可以在 `codex/v15-integration-foundation` 分支开始以下工作。

### 1. 本基线文档

- 添加 `docs/40-v15-final-development-baseline.md`；
- 标记 `FROZEN`；
- 写入确认日期和确认人；
- PoC 证据分支中的旧 `docs/30-v15-technology-selection-freeze-draft.md` 保留历史，不再作为实现依据。

### 2. 数据库 Expand Schema

实现本文件第三章对应结构：

- RRULE 表组；
- AI 表组；
- Push 表组；
- Import 表组；
- ClientMigrationPolicy；
- SystemSetting 功能开关字段。

Expand 阶段：

- 不删除旧字段；
- 不回填生产数据；
- 不改变当前业务读写路径；
- 不启用新功能。

### 3. API Contracts 和功能开关

允许开发：

- 新枚举；
- 新 DTO；
- OpenAPI Schema；
- FeatureFlag 解析器；
- 环境变量总闸；
- 管理员开关 API；
- AdminAudit 记录；
- 默认关闭验证。

### 4. 依赖治理工具迁入正式 CI

允许将 PoC 中已验证的治理能力迁入：

```text
tools/dependency-governance/
```

并接入正式 CI。

不得自动把 MPL-2.0 标为人工批准。

### 5. 纯核心模块和 Fake/Stub 实现

允许开发：

- RRULE 核心封装；
- Repository 接口；
- V1 Repository 适配；
- V2 加密 Repository；
- 本地加密模块；
- 迁移状态机的自动化测试；
- Import dry-run；
- AI Fake Provider；
- AI Proposal 状态机；
- Push Subscription 数据结构；
- Fake/Stub Push Adapter；
- 自定义 Service Worker 的非真实发送逻辑。

## 6.2 第一批代码的强制要求

所有第一批代码必须：

- 默认关闭功能开关；
- 不改变当前用户行为；
- 不改变现有 API 默认响应；
- 不自动执行 backfill；
- 不自动迁移 IndexedDB；
- 不创建真实 Push 订阅；
- 不发送真实 Push；
- 不访问真实 AI；
- 不执行真实导入写入；
- 保持旧 Reminder 规则为生产主读；
- 保持 IndexedDB v1 为实际活动 schema。

自动化测试可以显式打开测试开关，但测试配置不得进入默认生产配置。

# 七、开发分支和证据分支规则

## 7.1 PoC 证据分支

```text
codex/v15-tech-selection-poc
```

用途：

- 保留 7 项 PoC；
- 保留自动化测试；
- 保留报告；
- 保留真机测试工具；
- 保留治理证据。

禁止：

- 继续编写正式业务实现；
- 作为生产集成分支；
- 直接合并 main。

## 7.2 正式集成分支

```text
codex/v15-integration-foundation
```

创建来源：

```text
main@13bfad4d32157166fa6e8f5215ce5f813a1ad67c
```

不得从 PoC 分支直接创建，以避免将 PoC 专用 Workflow、测试夹具和临时代码整体带入正式集成历史。

需要复用的 PoC 逻辑必须：

1. 重新实现为 TypeScript；
2. 放入正式目录；
3. 接入现有依赖注入和 Repository；
4. 保留等价测试；
5. 在 PR 中标明 PoC 来源文件和行为对应关系。

# 八、偏离基线的处理方式

开发过程中发现本文件需要修改时，不允许直接在代码中绕过。

必须：

1. 提交 Architecture Decision Record；
2. 说明原决定；
3. 说明变更原因；
4. 说明兼容和迁移影响；
5. 说明门禁影响；
6. 说明回滚方案；
7. 由 Dada 明确批准；
8. 更新本文件版本号。

未经批准的实现偏离应在 Code Review 中阻断。

# 九、冻结确认

```text
status: FROZEN
confirmedBy: Dada
confirmedAt: 2026-08-09
```

冻结后，Codex 的正式开发任务必须先读取本文件，不再以 PoC 证据分支中的 `docs/30-v15-technology-selection-freeze-draft.md` 作为实现依据。
