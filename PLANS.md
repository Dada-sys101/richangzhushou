# 日常助手 V1.5 · GPT 逐步执行总规划

版本：v1.1  
日期：2026-08-09  
项目：日常助手 / Daily Assistant  
仓库：`Dada-sys101/richangzhushou`  
计划状态：AWAITING_USER_REVIEW  
当前任务：`V15-CTRL-001a`  
下一任务：`V15-CTRL-001`（仅在用户确认 v1.1 后进入）  

> 当前执行项目唯一指向：`Dada-sys101/richangzhushou`，
> `codex/v15-integration-foundation`，日常助手 V1.5 正式集成阶段。
>
> 历史名称“日常助手 V2”与本项目的关系记为 `NAME-001`，
> 状态：待用户确认。在用户确认前，`NAME-001` 不得作为 GPT/Codex
> 的执行依据，不影响 V1.5 其余任务的正常推进。

## 1. 本计划的用途

本文件是 GPT/Codex 接管日常助手 V1.5 后的唯一执行总计划。它解决以下问题：

- 每次任务开始时知道项目真实状态；
- 自动选择下一项可以执行的任务；
- 一次只处理一个明确范围；
- 每一步都有依赖、输出、测试和完成标准；
- 遇到人工门禁时不会擅自跨过；
- 任务结束后同步代码、文档、计划和证据；
- 新会话或更换模型后可以恢复，不依赖聊天历史。

本计划不是“一次性把全部项目自动做完”的授权。提交、推送、创建 PR、合并、云资源创建、真实服务调用、Staging 和生产部署仍按各自授权边界执行。

## 2. GPT 每次启动必须读取的文件

按以下顺序恢复项目状态，任一文件不存在时先记录缺失，不得自行猜测内容：

1. `AGENTS.md`
2. 本文件：`日常助手V1.5_GPT逐步执行总规划_v1.1.md`，后续入库时建议命名为 `PLANS.md`
3. `docs/40-v15-final-development-baseline.md`
4. `.project/context.md`
5. `.project/session.md`
6. `.project/v15-execution-state.md`（由 `V15-CTRL-001` 创建）
7. `PROJECT_STATUS.md`
8. `MASTER_PLAN.md`
9. `docs/progress.md`
10. `docs/roadmap.md`
11. `docs/decisions.md`
12. 最近相关提交、当前分支、工作树、现有 PR 和 CI

若文档与代码冲突，按以下优先级判断：

```text
GitHub实际代码/PR/CI
  > docs/40冻结基线
  > 本计划及V1.5执行状态
  > Library v1.5完整需求/SRS/Excel
  > main中的旧V1状态文档
  > v1.0～v1.4与PoC草案
```

## 3. 当前冻结事实

### 3.1 Git 状态

- `main`：稳定 V1 基线，当前核验为 `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`。
- `codex/v15-tech-selection-poc`：7 项 PoC 证据分支，只保留证据，不整体合并。
- `codex/v15-integration-foundation`：V1.5 正式集成分支，当前比 `main` 领先 2 个提交。
- PR #8：V1.5 PR1 RRULE 数据库 Expand 已合入集成分支。
- PR1 未进入 `main`，未启用 RRULE 新读写、回填、dual-read 或新调度器。
- Staging 未创建，生产未部署。

### 3.2 产品范围

- iPhone Safari / 主屏幕 PWA 为主要验收端。
- Android 仅支持响应式 Web/PWA。
- 桌面和平板支持响应式 Web。
- 核心范围：统一记录、快速记账、计划、提醒、行程、离线同步、受控 AI 解析。
- 管理员建号、小规模邀请试用；首轮 3～5 人。

当前明确禁止：

- Android Capacitor/Kotlin 原生容器、NotificationListenerService 和 APK；
- 支付后无感自动记账；
- OCR、截图识别、后台静默读取剪贴板；
- 模型直连数据库或直接写正式业务记录；
- 未经人工门禁批准的真实 Push、真实 AI、自动 IndexedDB 迁移和旧数据清理。

### 3.3 已冻结技术决策

- RRULE：`rrule-temporal + Temporal`，通过项目自有 `RecurrenceEngine` 隔离。
- 时间：用户计划默认 `WALL_CLOCK + TZID`；系统严格间隔任务可用 `ABSOLUTE_INSTANT`。
- AI：独立 `AiProposal` / `AiOperation`，只能生成待确认提案。
- 本地加密：Web Crypto AES-256-GCM、非导出设备密钥、按用户/设备/版本隔离。
- IndexedDB：Expand → 影子迁移 → 验证 → dual-read/write → 切换 → 保留 → Shrink。
- v1 本地数据最短保留 7 天，清理窗口 7～14 天且可配置；门禁未通过不清理。
- Web Push：独立 Subscription/Delivery 记录和自定义 Service Worker。
- 导入：CSV 服务端流式；XLSX 受控单并发。
- 新功能全部默认关闭，不得改变当前用户行为。

## 4. GPT 任务状态机

每个任务只能处于以下一种状态：

| 状态 | 含义 |
|---|---|
| `PENDING` | 尚未开始，依赖可能未满足 |
| `READY` | 依赖和当前门禁满足，可以开始 |
| `IN_PROGRESS` | 当前唯一正在执行的任务 |
| `BLOCKED` | 被人工选择、权限、外部资源或失败阻塞 |
| `VERIFYING` | 实现完成，正在执行测试和复核 |
| `DONE_LOCAL` | 本地实现和验证通过，尚未提交 |
| `DONE_COMMITTED` | 已按授权提交，尚未推送 |
| `DONE_PUSHED` | 已按授权推送，尚未合并 |
| `DONE_INTEGRATION` | 已合入 V1.5 集成分支 |
| `DONE_MAIN` | 已满足全部条件并合入 `main` |
| `STAGING_PASS` | Staging 真实验证通过 |
| `RELEASED` | 已获人工批准并发布 |
| `CANCELLED` | 经用户明确决定取消 |

规则：

- 同一时间最多一个任务为 `IN_PROGRESS`。
- 没有测试证据不能进入 `DONE_LOCAL`。
- 没有明确授权不能进入 `DONE_COMMITTED`、`DONE_PUSHED` 或创建 PR。
- 未满足 9 项人工门禁不能进入 `DONE_MAIN`、Staging 用户启用或生产发布。
- “文档写完”不等于“代码完成”，“代码完成”不等于“部署完成”。

## 5. GPT 选择下一任务的算法

每次完成或恢复任务时执行：

1. 检查是否存在 `IN_PROGRESS` 或 `VERIFYING` 任务。
2. 若存在，优先恢复该任务，不另开新任务。
3. 若任务被阻塞，将阻塞原因、需要的用户输入和可恢复条件写入状态文件。
4. 按本计划顺序查找第一个任务依赖已满足，并且其所需人工门禁全部为“已关闭”的 `PENDING` 任务。
5. 将该任务切换为 `READY`，展示任务契约。
6. 用户要求执行后才切换为 `IN_PROGRESS`。
7. 若某任务依赖人工门禁但其他独立任务可执行，允许跳到下一个独立任务；不得把被跳过任务标为完成。
8. 所有可执行项都被阻塞时，停止并输出唯一阻塞清单，不重复尝试破坏性操作。

## 6. 每个任务的标准执行循环

### 6.1 开始前

GPT 必须输出：

- 当前任务 ID 和名称；
- 为什么现在可以执行；
- 依赖是否满足；
- 本次允许修改的文件/模块；
- 明确不包含的范围；
- 预计验证命令；
- 是否需要用户批准外部操作。

开始前检查：

```text
读取状态文件
→ 核验当前分支/HEAD/工作树
→ 检查未提交用户修改
→ 核验依赖PR与人工门禁
→ 更新session为IN_PROGRESS
→ 再开始修改
```

### 6.2 实施中

- 一次只实现当前任务契约。
- 发现需求冲突时停止扩展，创建 ADR 建议，不在代码中暗自改变冻结决策。
- 不修改无关文件，不覆盖用户已有改动。
- 数据库变更必须有 Expand/回滚/兼容说明。
- API 变更必须同步契约、类型、错误码和测试。
- 用户可见行为必须有 E2E 或等价验收。
- 安全或隐私功能必须增加反向测试。

### 6.3 验证

最少执行：

```text
npm run check:context
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate:prisma
npm run validate:openapi
npm run validate:migration
npm run audit:dependencies
git diff --check
```

跨端或用户流程变更追加：

```text
npm run test:e2e:smoke
```

数据库任务必须在临时 MySQL 8.4 空库执行完整 migration，并运行真实数据库专项测试。不得因为普通单元测试阶段显示 skip 就宣称数据库测试通过。

自 PR6a 完成后，PR2、PR3、PR4 及后续数据库任务的临时 MySQL 8.4 空库创建、migration 执行、专项测试和数据库销毁，必须通过 PR6a 提供的统一入口完成，不得由每个数据库任务重复手动搭建。本规则不追溯改变已完成 PR1 的状态和证据。

### 6.3.1 VERIFYING 失败回退规则

若 `VERIFYING` 阶段任意验证命令失败：

1. 不得修改任务范围外的文件、配置或依赖来绕过失败。
2. 首次失败后，允许在同一任务契约范围内修复并重试，最多重试 2 次，即总计最多执行 3 次验证。
3. 第 3 次仍失败时：
   - 立即停止继续修复；
   - 将任务状态改为 `BLOCKED`；
   - 在 `.project/v15-execution-state.md` 的 `Active Task.blockers` 中记录失败命令、错误摘要、已尝试的修复方式和恢复条件；
   - 不得进入 `DONE_LOCAL`，不得扩大修改范围。
4. 不得为了通过验证而放宽测试断言、删除测试用例、跳过必须执行的测试或把失败改为允许失败。
5. 只有用户明确确认测试用例本身错误后，才能修改该测试。

### 6.4 完成前

GPT 必须：

1. 审查完整 diff；
2. 检查是否超出任务范围；
3. 记录测试命令、结果、失败和跳过项；
4. 更新 `.project/session.md`；
5. 更新 `.project/context.md`；
6. 更新 `.project/v15-execution-state.md`；
7. 更新相关计划、进度、决策和 changelog；
8. 明确区分“本地完成、已提交、已推送、已合并、已部署”；
9. 停在授权边界前，等待用户决定提交、推送或 PR。

## 7. 总体阶段与里程碑

Excel 管理排期保留为 2026-08-10 至 2026-11-27、74 个计划工作日。实际推进以依赖、门禁和证据为准。

| 阶段 | 目标 | 默认退出条件 |
|---|---|---|
| A | 项目状态归一 | GPT 可从单一状态恢复并选择下一任务 |
| B | Foundation Expand 和契约 | PR1、PR6a、PR2、PR3、PR4、PR6、PR5 完成，全部新功能默认关闭 |
| C1 | RRULE 集成 | 核心、回填、parity 和调度切换代码完成 |
| C2 | IndexedDB 与加密 | Repository、加密、迁移、dual-read/write 完成 |
| C3 | 导入 | dry-run、正式写入、UI 和样本验收完成 |
| C4 | Web Push | 订阅、发送、重试、真机和许可门禁完成 |
| C5 | AI | Proposal、Router、真实 Provider 门禁完成 |
| D | 观测和 Cutover | 指标、清理资格、回滚和 Shrink 批准完成 |
| E | Staging 和发布 | 真机、备份恢复、3～5 人试用、受控发布完成 |

## 8. 逐步执行任务清单

### A. 项目治理

#### V15-CTRL-001a：执行总规划文档一致性修补 v1.1

状态：`VERIFYING`  
依赖：无。  
范围：只修改执行总规划文档。  
禁止：修改代码、迁移、CI 配置及 `.project/*` 状态文件；不得提交、推送或创建 PR。  
完成：v1.1 完整 diff 已输出并经用户确认。

#### V15-CTRL-001：V1.5 状态归一

状态：`PENDING`  
依赖：V15-CTRL-001a 完成、用户确认 v1.1，且 PR1 已合入 integration。  
目标：建立 GPT 后续可自动恢复的唯一状态源。

交付：

- 创建 `.project/v15-execution-state.md`；
- 更新 `.project/context.md`、`PROJECT_STATUS.md`、`MASTER_PLAN.md`、`docs/README.md`；
- 记录 main、PoC、integration、Staging 四条线；
- 写入 PR1～PR23 的状态、依赖、门禁和证据位置；
- 标明旧文档仅供历史追溯；
- 将当前任务指针设置为 PR2。

完成标准：

- 新会话只读仓库文件即可准确回答当前进度和下一任务；
- `npm run check:context` 与 `npm run quality` 通过；
- 文档不再把 PoC、代码完成、合并和部署混为一谈。

### B. Foundation

本小节任务按 PR6a → PR2 → PR3 → PR4 → PR6 → PR5 顺序执行。此顺序与各任务依赖字段一致；若两者出现不一致，以依赖字段为准。

本节中的 PR1～PR23、PR6a 是开发计划任务编号，不等同于 GitHub 自动分配的 Pull Request 编号。实际 GitHub PR 编号应记录在任务证据字段中。

#### PR1：RRULE 数据库 Expand

状态：`DONE_INTEGRATION`  
证据：GitHub PR #8。  
限制：不回填、不 dual-read、不切换引擎、不修改当前行为。

#### PR6a：本地数据库验证脚本

状态：`PENDING`  
依赖：V15-CTRL-001。  
目标：提供可重复执行的临时 MySQL 8.4 空库验证脚本，建议命名为 `scripts/db-validate.sh`，也可以提供语义等价的 npm script。

范围：

1. 创建隔离的临时 MySQL 8.4 空库；
2. 执行完整 migration 链；
3. 运行调用任务指定的真实数据库专项测试；
4. 无论成功或失败都销毁临时数据库；
5. 输出可读结果并返回正确退出码。

禁止：

- 修改业务 Schema 或已有 migration 的语义；
- 连接 Staging 或生产数据库；
- 写入真实环境凭据；
- 在本任务中修改正式 CI；CI 接入属于 PR6；
- 通过跳过测试或放宽断言获得成功结果。

完成：

- 脚本可通过单一命令重复运行；
- 成功和失败路径均能正确销毁临时数据库；
- 日志不泄露数据库密码或其他敏感信息；
- PR2、PR3、PR4 可以直接调用该脚本执行各自专项验证；
- PR6 可以直接调用该脚本，将同一验证入口接入正式 CI。

#### PR2：AI 数据库 Expand

状态：`PENDING`  
依赖：V15-CTRL-001、PR6a。  
范围：`AiRequest`、`AiProposal`、`AiOperation`、`AiProviderAttempt` 及索引、外键、审计字段。  
禁止：真实 Provider、API Key、真实模型调用、业务表写入。  
完成：通过 PR6a 提供的验证入口，在临时 MySQL 8.4 空库完成完整迁移，并通过关系、级联和非法状态专项测试；默认无运行时读写。

#### PR3：Push 数据库 Expand

状态：`PENDING`  
依赖：V15-CTRL-001、PR6a。  
范围：`PushSubscription`、`NotificationDelivery`、唯一键、租约、状态和失效订阅字段。  
禁止：真实 VAPID、真实订阅、网络投递。  
完成：通过 PR6a 提供的验证入口，在临时 MySQL 8.4 空库完成完整迁移和真实数据库约束测试；运行时开关关闭。

#### PR4：Import 与迁移策略数据库 Expand

状态：`PENDING`  
依赖：V15-CTRL-001、PR6a。  
范围：`ImportBatch`、`ImportItem`、`ClientMigrationPolicy`、SystemSetting 功能开关字段。  
禁止：真实导入、自动迁移、v1 清理。  
完成：通过 PR6a 提供的验证入口，在临时 MySQL 8.4 空库完成完整迁移、策略硬校验和回滚兼容测试；功能默认关闭。

#### PR6：依赖治理迁入正式 CI

状态：`PENDING`  
依赖：V15-CTRL-001、PR6a。  
范围：将 PR6a 产出的本地数据库验证入口接入正式 CI，同时完成许可证矩阵、SBOM、npm audit、异常规则和证据卫生。  
禁止：自动批准 MPL-2.0、为清洁报告擅自换依赖版本。  
完成：正式 CI 能调用 PR6a 的验证入口，数据库验证失败时正确阻断；依赖治理检查强制执行；`web-push` 保持人工 `REVIEW`。

#### PR5：Contracts、DTO 与功能开关

状态：`PENDING`  
依赖：PR1、PR2、PR3、PR4。  
范围：新枚举、DTO、OpenAPI、FeatureFlag、环境总闸、管理员开关、审计。  
完成：所有新功能默认关闭；旧 API 默认行为不变；契约测试和反向测试通过。

### C1. RRULE

#### PR7：RRULE 核心封装

状态：`PENDING`  
依赖：PR1、PR5、PR6。  
范围：规范化、occurrence key、例外计算、`RecurrenceEngine`。  
强制前置：冻结 `dtstartLocal` 编码/持久化/反序列化约定和非法状态校验。  
完成：DST、跨时区、无 DST、CANCEL、REPLACE、仅本次/以后/全系列测试通过；功能关闭。

#### PR8：RRULE Backfill 与 dual-read parity

状态：`PENDING`  
依赖：PR7。  
范围：离线 backfill、parity、差异报告、可恢复状态。  
禁止：自动生产回填、切换主引擎。  
完成：重复运行、失败恢复、差异审计、零破坏旧字段测试通过。

#### PR13：RRULE 主读切换与调度器集成

状态：`PENDING`  
依赖：PR8；人工门禁 1～5。  
禁止：门禁未通过时启用。  
完成：默认关闭的新调度器、回退旧引擎、parity 阈值和切换演练通过。

### C2. IndexedDB 与本地加密

#### PR9：统一 Repository 与 V1PlainRepository

状态：`PENDING`  
依赖：PR5。  
完成：业务代码不再写死 v1/v2 store；实际仍使用 v1。

#### PR10：V2EncryptedRepository

状态：`PENDING`  
依赖：PR9；人工门禁 1～4影响启用。  
完成：AES-GCM、非导出密钥、多账号隔离、AAD、密钥丢失和退出清理测试通过；v2 不激活。

#### PR11：MigrationCoordinator

状态：`PENDING`  
依赖：PR4、PR10；人工门禁 1～4。  
完成：journal、容量预检、Web Locks、中断恢复、回滚和迁移 UI 通过；自动迁移关闭。

#### PR12：dual-read/write 与清理资格

状态：`PENDING`  
依赖：PR11；人工门禁 1～5。  
完成：动态保留、parity、回滚、清理资格测试通过；v2 主读和 v1 清理仍关闭。

### C3. CSV/XLSX 导入

#### PR14：Import Parser 与 dry-run

状态：`PENDING`  
依赖：PR4、PR5、PR6。  
完成：CSV 流式、XLSX 单并发、编码、映射、重复检测、文件/行数/内存门禁、dry-run 通过；入口关闭。

#### PR15：FinanceImportWriter 与导入 UI

状态：`PENDING`  
依赖：PR14。  
完成：批次幂等、部分成功、取消、重试、预览、正式确认和审计通过；真实用户入口仍受门禁控制。

### C4. Web Push

#### PR16：订阅 API、权限 UI 与 Service Worker

状态：`PENDING`  
依赖：PR3、PR5。  
完成：订阅生命周期、当前设备退出、endpoint 跨账号迁移、深链安全、Fake Push 测试通过；真实发送关闭。

#### PR17：真实 Web Push Provider

状态：`BLOCKED`  
依赖：PR16、PR6、人工门禁 6、人工门禁 8。  
完成：真实真机送达、重试、404/410、去重、隐私和许可证评审证据通过。  
门禁未关闭：不得合并、不得发送真实 Push。

### C5. AI

#### PR18：AI Proposal/Operation 与 Fake Provider

状态：`PENDING`  
依赖：PR2、PR5。  
完成：Proposal 状态机、确认/拒绝、幂等、晚到结果、无业务表直写测试通过。

#### PR19：AI Router 与 Stub Provider

状态：`PENDING`  
依赖：PR18、PR6。  
完成：能力缓存、超时、故障转移、熔断、Schema、审计和全失败降级通过；真实调用关闭。

#### PR20：真实 AI Provider

状态：`BLOCKED`  
依赖：PR19、人工门禁 7。  
完成：授权 Provider 的能力、额度、费用上限、延迟、错误和结构化输出证据通过。  
门禁未关闭：只能使用 Fake/Stub，不得配置真实密钥。

### D. 观测、Cutover 与 Shrink

#### PR21：Cutover 观测和管理页

状态：`PENDING`  
依赖：PR12、PR13、PR15、PR17、PR20。  
完成：RRULE parity、IndexedDB 迁移、Import、Push、AI 指标和告警可审计。

#### PR22：Shrink 准备与回滚演练

状态：`PENDING`  
依赖：PR21、人工门禁 1～9。  
完成：清理资格、dry-run、冷启动计数、回滚演练通过；不删除结构和数据。

#### PR23：最终 Shrink

状态：`BLOCKED`  
依赖：PR22、人工门禁 1～9、单独清理批准。  
完成：逐项停止旧写入，只清理满足资格的数据；旧数据库字段删除需再次单独批准。

### E. Staging 与发布

#### REL-01：Staging 决策冻结

状态：`BLOCKED`  
依赖：用户确认服务器、MySQL、OSS、域名/隧道、首批测试账号。  
完成：资源表、费用、权限、回滚和不触碰现有站点的边界确认。

#### REL-02：Staging 基础设施

状态：`PENDING`  
依赖：REL-01 和逐项授权。  
范围：Node 24、MySQL 8.4、独立库/账号、私有 OSS、RAM、HTTPS、隔离目录和服务。  
禁止：未授权创建资源、真实密钥入库、公开 3306。

#### REL-03：部署流水线与恢复演练

状态：`PENDING`  
依赖：REL-02。  
完成：手动 `workflow_dispatch`、不可变 release、health、Smoke、自动回退、加密备份和隔离恢复通过。

#### REL-04：真机和真实服务门禁

状态：`PENDING`  
依赖：REL-03 和相应功能 PR。  
完成：人工门禁 1～8 全部归档。

#### REL-05：3～5 人封闭试用

状态：`PENDING`  
依赖：REL-04。  
完成：至少 7～14 天试用，无 P0/P1 阻断，问题和指标归档。

#### REL-06：受控灰度发布

状态：`BLOCKED`  
依赖：REL-05、PR23、人工批准。  
完成：Smoke、监控、回滚点、发布记录和用户影响确认。

## 9. 九项人工门禁

| 门禁 | 内容 | 当前状态 |
|---|---|---|
| H1 | iPhone Safari 普通网页正式验收记录 | 部分完成 |
| H2 | iPhone 主屏幕 PWA、关闭/强制关闭、离线重开 | 部分完成 |
| H3 | Safari 无痕浏览行为独立记录 | 已观察，未归档 |
| H4 | Android Chrome 网页/PWA/离线/IndexedDB | 未关闭 |
| H5 | iOS 长时间存储保留观察 | 未关闭 |
| H6 | iPhone/Android/桌面真实 Web Push 送达 | 未关闭 |
| H7 | 授权真实 AI Provider 的额度、延迟、格式 | 未关闭 |
| H8 | `web-push@3.6.7` MPL-2.0 人工评审 | 未关闭 |
| H9 | PoC 到生产集成评审 | 已关闭 |

规则：H1～H9 全部关闭前，不合并 V1.5 到 `main`、不部署生产、不发送真实 Push、不调用真实/付费 AI、不自动迁移真实用户数据、不清理 v1。

### 人工门禁中间状态处理规则

- 人工门禁只有状态为“已关闭”时，才视为依赖满足。
- “部分完成”“已观察，未归档”和“未关闭”均视为依赖未满足。
- 依赖上述门禁的任务不得进入 `READY`。
- 例如，H1～H5 中任意一项不是“已关闭”时，PR13 不得进入 `READY`。
- “部分完成”和“已观察，未归档”只允许作为临时状态。
- 下一次涉及该门禁的验收活动结束后，必须由用户明确归档为“已关闭”或“未关闭”，不得长期停留在中间状态。
- GPT/Codex 不得根据测试、截图、历史描述或推测自动关闭人工门禁。

## 10. `.project/v15-execution-state.md` 模板

`V15-CTRL-001` 应创建以下格式：

```markdown
# V1.5 Execution State

updatedAt: YYYY-MM-DDTHH:mm:ss+08:00
mainHead: <sha>
integrationHead: <sha>
pocHead: <sha>
currentTask: V15-CTRL-001
currentStatus: IN_PROGRESS
nextCandidate: PR2

## Active Task
- id:
- scope:
- branch:
- startedAt:
- dependencies:
- allowedFiles:
- forbiddenScope:
- validation:
- blockers:

## Task Ledger
| ID | Status | Dependencies | Gate | Branch/PR | Evidence | Next action |
|---|---|---|---|---|---|---|

## Human Gates
| Gate | Status | Evidence | Owner | Next action |
|---|---|---|---|---|

## Last Verified
- commands:
- tests:
- CI:
- known skips:
- workingTree:
```

## 11. 直接交给 GPT/Codex 的启动指令

```text
请接管“日常助手 / Daily Assistant V1.5”项目，并严格按照仓库中的执行总规划逐步推进。

开始前必须：
1. 读取 AGENTS.md。
2. 读取 PLANS.md（若尚未入库，则读取《日常助手V1.5_GPT逐步执行总规划_v1.1.md》）。
3. 读取 docs/40-v15-final-development-baseline.md。
4. 读取 .project/context.md、.project/session.md、.project/v15-execution-state.md、PROJECT_STATUS.md 和 MASTER_PLAN.md。
5. 核验当前分支、HEAD、工作树、最近提交、相关 PR 与 CI；不得只相信旧文档。
6. 如果存在 IN_PROGRESS 或 VERIFYING 任务，先恢复它；否则按计划的依赖和门禁算法选择第一个 READY 任务。
7. 在修改前输出本次任务契约：目标、依赖、范围、不包含项、修改文件、验证方法和授权边界。
8. 一次只执行一个任务，不得跨 PR 扩展范围。
9. 完成实现后运行相关测试、npm run quality、git diff --check，并审查完整 diff。
10. 更新所有项目状态文件，明确区分本地完成、提交、推送、PR、合并、Staging 和发布。

强制限制：
- 未获得明确授权，不提交、不推送、不创建 PR、不合并、不部署、不创建云资源。
- 九项人工门禁全部关闭前，不合并 V1.5 到 main，不部署生产，不发送真实 Push，不调用真实/付费 AI，不自动迁移或清理真实用户数据。
- PoC 分支只作为证据，不得整体合并；需要的逻辑必须按正式架构重新实现并保留等价测试。
- 新功能必须默认关闭，不得改变当前用户行为。
- 文档中的“已完成”不能覆盖代码、测试、CI 或部署的真实状态。

当前已知状态：
- main = 13bfad4d32157166fa6e8f5215ce5f813a1ad67c。
- codex/v15-integration-foundation 比 main 领先 2 个提交。
- PR #8（V1.5 PR1 RRULE 数据库 Expand）已合入 integration，未进入 main、未启用。
- 当前任务为 V15-CTRL-001a：执行总规划文档一致性修补 v1.1，状态为 VERIFYING。
- V15-CTRL-001a 的完整 diff 未经用户确认前，不得进入 V15-CTRL-001。

先只恢复并核验 V15-CTRL-001a；用户确认 v1.1 后，再输出 V15-CTRL-001 的详细执行计划，确认范围后实施。
```

## 12. 用户日常使用方式

第一次把本计划交给 GPT 时，发送第 11 节启动指令。

以后只需要使用以下短指令：

```text
读取项目执行总规划和当前状态，恢复上次任务。若上次任务已完成，则选择下一项满足依赖与门禁的任务。先报告任务契约，再继续执行；未经我明确授权不要提交、推送、创建PR、合并或部署。
```

当 GPT 请求外部授权时，只批准当前明确动作，不把一次授权扩展到提交、推送、PR、合并或部署的其他步骤。

## 13. 本计划的维护规则

- 产品范围、技术路线、数据生命周期或人工门禁变化时，先写 ADR，再更新本计划版本。
- 每个 PR 合并到 integration 后更新任务状态和证据。
- 每周更新一次 Excel 管理进度；GitHub 和 execution state 保持实时。
- 状态冲突时先修复状态，不继续开发。
- GPT 连续两次出现同类错误时，将对应约束加入 `AGENTS.md`。
- 本计划过长时，`AGENTS.md` 只保留强制规则并引用本文件，不复制整份内容。

## 14. 证据入口

- Repository: https://github.com/Dada-sys101/richangzhushou
- Frozen baseline: https://github.com/Dada-sys101/richangzhushou/blob/codex/v15-integration-foundation/docs/40-v15-final-development-baseline.md
- RRULE PR1: https://github.com/Dada-sys101/richangzhushou/pull/8
- Integration compare: https://github.com/Dada-sys101/richangzhushou/compare/main...codex/v15-integration-foundation
- PoC final status: https://github.com/Dada-sys101/richangzhushou/blob/codex/v15-tech-selection-poc/pocs/v15-tech-selection/TECH-SELECTION-FINAL-STATUS.md
- OpenAI Codex best practices: https://learn.chatgpt.com/guides/best-practices
- OpenAI AGENTS.md guidance: https://learn.chatgpt.com/docs/agent-configuration/agents-md

## 15. 待用户确认

### NAME-001：日常助手 V1.5 与历史名称“日常助手 V2”的关系

状态：`PENDING_USER_CONFIRMATION`  
阻塞性：非阻塞。

当前仓库文件未明确证明“日常助手 V2”与当前 V1.5 正式集成阶段的对应关系。

处理规则：

- 当前所有开发任务只以 `Dada-sys101/richangzhushou`、`codex/v15-integration-foundation` 和 V1.5 冻结基线为执行依据；
- GPT/Codex 不得自行推断、补写或传播 V2 与 V1.5 的对应关系；
- NAME-001 未确认不影响 V1.5 其他任务进入 `READY`；
- 用户确认后，再更新版本命名说明和相关状态文档。
