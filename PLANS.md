# Daily Assistant V1.5 唯一总执行规划

版本：v2.1.1 Final
批准日期：2026-08-10
状态：`APPROVED / ACTIVE`
仓库：`Dada-sys101/richangzhushou`
集成分支：`codex/v15-integration-foundation`
当前 canonical 任务：`PR19`（Contract `V10 / FROZEN / GPT_ACCEPT`；landing commit `LOCAL_COMMITTED / NOT_PUSHED`；implementation `NOT_STARTED / NOT_AUTHORIZED`）
PR18 Integration：`7caf892022c9bb6833c7316893bfddeb169b7243`
Integration CI #264：`SUCCESS`
PR19 Contract：`tasks/PR19.md`（`PR19-CONTRACT-REVIEW09 = ACCEPT`；landing commit `bc8bc413c6862e0d92247d7e6608dd6e99f505d7`）
Remote Integration：`50f4f936a4ce46ac746f23478a929287d6e17c94`；local `AHEAD 1 / BEHIND 0`
Repository Persisted Gate：`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`
Repository landing state：`WORKTREE_FIXED / UNCOMMITTED`
Persisted Successor Gate：`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`

## 1. 版本目标与边界

本规划服务于 **Daily Assistant V1.5**，不是 V2。目标是在稳定 V1 基础上增量完成：

- AI Proposal 能力；
- 项目治理与质量体系收口；
- Staging 上线准备；
- 3→5→约 10 人的小规模试用；
- 经 integration、main 和 release tag 晋级后正式发布。

R1 不包含真实 Push、新 RRULE 切换、完整 IndexedDB 加密迁移、Import 正式开放或 Shrink。
这些能力分别进入 R1.1、R2、R3；后移不等于取消。所有新能力默认关闭，未通过对应门禁不得启用。

## 2. 唯一状态体系与事实优先级

### 2.1 三个事实层级

1. **实时事实源**：GitHub、Git、CI 和实际部署环境；
2. **唯一任务定义**：`PLANS.md`；
3. **唯一仓库内执行状态快照**：`.project/v15-execution-state.md`。

`execution-state` 不是 GitHub CI 或部署环境的实时镜像。若仓库快照与实时事实不同，先以
GitHub、实际代码、CI 和环境为准，再在下一个合法治理更新点同步快照。不得只为追逐 CI 状态
而制造提交触发 CI、再同步 CI、再触发 CI 的无限循环。

`TODO.md`、`SESSION_END.md`、`MASTER_PLAN.md`、`docs/progress.md` 和 `docs/roadmap.md`
均为派生说明或历史参考，不得成为平行任务源。发生冲突时必须停止执行并按上述层级归一。

### 2.2 冻结基线与 ADR

`docs/40-v15-final-development-baseline.md` V1.1 冻结核心技术架构；Accepted ADR-026 是对其
发布范围和门禁映射的正式增量修订；Accepted ADR-027 冻结 AI Stage 1 接入、安全与评测策略。
三者共同生效且不得存在冲突规则：

- docs/40 保留 RRULE 技术选型、AI Proposal 模型、Repository 架构、渐进式数据库迁移和
  Feature Flag 安全边界；
- ADR-026 决定 R1/R1.1/R2/R3 映射、门禁 blockingScope、Staging 和发布晋级规则；
- ADR-027 决定 AI Provider/模型候选、服务端接入、credential/字段/日志/保留边界、预算与
  韧性参数、200 条非真实评测数据规范、provisional thresholds 和不可降低安全阈值；
- 若未来再次改变上述有效规则，必须先形成 ADR、获得人工批准，再同步 PLANS、docs/40 和状态快照。

## 3. 状态模型

每个任务必须同时记录两个维度：

```yaml
executionStatus: PENDING | READY | IN_PROGRESS | BLOCKED | VERIFYING | DONE | CANCELLED
deliveryStatus: NOT_STARTED | DONE_LOCAL | DONE_COMMITTED | DONE_PUSHED | PR_OPEN |
  DONE_INTEGRATION | DONE_MAIN | STAGING_PASS | RELEASE_CANDIDATE | RELEASED
```

- `executionStatus` 描述任务执行进程；`deliveryStatus` 描述交付物所在晋级层级；
- 没有直接证据不得升级；`DONE_LOCAL` 不等于提交，`PR_OPEN` 不等于合并；
- 同一时刻只执行一个 canonical 任务，不得因多个任务 READY 自动并行；
- 人工门禁只能由人工依据证据关闭，代码任务不得自动关闭门禁。

## 4. V1.5 总体路线

| Phase | 目标 | Canonical 任务 | 退出条件 |
|---|---|---|---|
| 0 治理收口 | 状态源、发布范围、冻结基线一致 | V15-CTRL-001 | PR #10 经批准、CI、独立 merge 授权，合入并核验 integration HEAD |
| 1 基础能力 | DB 验证、AI 决策、契约、CI、Repository 基础 | PR6a、AI-DECISION-001、PR2、PR5、PR6、PR9；REL-01 可提前 | 空库/CI/契约/Repository 证据齐全，REL-01 仅冻结方案 |
| 2 R1 AI 核心 | Proposal、安全路由、受控真实 Provider | PR18、PR19、PR20 | Fake 全流程通过；H7 人工关闭后 PR20 才可合入 |
| 3 质量安全 | E2E、安全、License/SBOM、恢复验证 | 由 PR6、REL-03/04 及各任务验收覆盖 | R1 Quality Gate 全绿且证据归档 |
| 4 Staging | 资源、部署、监控、备份、回滚 | REL-01～REL-04 | REL-02 获独立授权后创建资源；Staging 全流程通过 |
| 5 试用 | 3→5→约 10 人，累计至少 7 个有效日历日 | REL-05 | 每阶段版本可追溯，无未解决 P0/P1、数据丢失或串号 |
| 6 发布 | RC 晋级 main/tag 并生产发布 | REL-06 | 仅部署已核验 main/tag commit，观察与回滚就绪 |

## 5. 发布分层与 canonical 总账

| 层级 | Canonical 任务 | 是否阻塞 R1 |
|---|---|---|
| R1 | V15-CTRL-001、PR6a、AI-DECISION-001、PR2、PR5、PR6、PR9、PR18、PR19、PR20、REL-01～REL-06 | 是 |
| R1.1 | PR3、PR16、PR17 | 否；仅阻塞真实 Push |
| R2 | PR4、PR7、PR8、PR13、PR14、PR15、PR21 | 否 |
| R3 | PR10、PR11、PR12、PR22、PR23 | 否 |

历史治理任务 `V15-CTRL-001a` 已通过 PR #9 达到 `DONE_INTEGRATION`，仅作证据，不是新任务 ID。

### 5.1 当前依赖基线

| ID | displayName | releaseTarget | 冻结依赖/门禁 |
|---|---|---|---|
| V15-CTRL-001 | 治理重基线 | R1 | PR #8/#9 已合入；十二项完成条件 |
| PR1 | RRULE DB Expand | Foundation | 已通过 PR #8 合入 integration |
| PR6a | 临时 MySQL 8.4 验证入口 | R1 | V15-CTRL-001 `DONE_INTEGRATION` |
| AI-DECISION-001 | AI 接入与评测方法冻结 | R1 | V15-CTRL-001；必须在 PR2 前完成首层决策 |
| PR2 | AI DB Expand | R1 | V15-CTRL-001、PR6a、AI-DECISION-001 首层决策 |
| PR3 | Push DB Expand | R1.1 | V15-CTRL-001、PR6a |
| PR4 | Import/迁移策略 DB Expand | R2 | V15-CTRL-001、PR6a |
| PR5 | 共享 Flag 与 AI Contracts | R1 | PR1、PR2、PR6a |
| PR6 | DB 验证接入 CI 与依赖治理 | R1 | V15-CTRL-001、PR6a |
| PR7 | RRULE 核心封装 | R2 | PR1、PR5、PR6 |
| PR8 | RRULE Backfill/parity | R2 | PR7 |
| PR9 | Repository 抽象与 V1PlainRepository | R1 | PR5 |
| PR10 | V2EncryptedRepository | R3 | PR9 |
| PR11 | MigrationCoordinator | R3 | PR4、PR10 |
| PR12 | dual-read/write 与清理资格 | R3 | PR11；H1～H5 影响启用/清理 |
| PR13 | RRULE 主读与调度切换 | R2 | PR8；对应迁移门禁 |
| PR14 | Import Parser/dry-run | R2 | PR4、PR5、PR6 |
| PR15 | Import Writer/UI | R2 | PR14；移动端验收门禁 |
| PR16 | Push 契约、订阅 API、权限 UI、SW | R1.1 | PR3、PR5 |
| PR17 | 真实 Push Provider | R1.1 | PR16、PR6；H6、H8 merge/enable gate |
| PR18 | AI Proposal / Operation、确认 UI 与 Fake Provider | R1 | PR2、PR5 |
| PR19 | AI Router、Stub 与安全降级 | R1 | PR18、PR6 |
| PR20 | 真实 AI Provider Adapter | R1 | `developmentDependency: PR19`；`humanValidationGate/mergeGate: H7` |
| PR21 | Cutover 观测与管理页 | R2 | PR12、PR13、PR15、PR17、PR20 |
| PR22 | Shrink 准备与回滚演练 | R3 | PR21；对应迁移/清理门禁 |
| PR23 | 最终 Shrink | R3 | PR22；全部清理资格和独立不可逆授权 |
| REL-01 | Staging 架构/资源决策冻结 | R1 | V15-CTRL-001；可在基础阶段提前，仅设计不建资源 |
| REL-02 | 创建 Staging 资源 | R1 | REL-01、R1 Quality Gate、独立资源授权 |
| REL-03 | 部署、备份、恢复与回滚演练 | R1 | REL-02 |
| REL-04 | Staging 真机与真实服务验收 | R1 | REL-03、PR20、H1/H2/H7；真实调用另行授权 |
| REL-05 | 分阶段封闭试用 | R1 | REL-04 |
| REL-06 | RC、main/tag 与生产发布 | R1 | REL-05、H1/H2/H7、发布门禁和独立生产授权；不依赖 PR23 |

上述依赖已随 v2.1.1 获人工批准。相对 PLANS v1.2 的 REL-01 提前和 REL-02 Quality Gate
调整不再是待定提案；未来依赖变更仍须标记 `DEPENDENCY_CHANGE_PROPOSED`，列出原依赖、
新依赖、理由、关键路径影响和是否需要 ADR，在批准前不得当作冻结依赖。

## 6. 人工门禁与决策

| Gate | 内容 | 当前状态 | blockingScope |
|---|---|---|---|
| H1 | iPhone Safari 正式记录 | PARTIAL | R1 |
| H2 | iPhone PWA/离线重开正式记录 | PARTIAL | R1 |
| H3 | Safari 无痕模式归档 | OBSERVED_NOT_ARCHIVED | 非阻塞限制 |
| H4 | Android Chrome Smoke | OPEN | Android 正式支持声明 |
| H5 | iOS 长期存储观察 | OPEN | 非阻塞观察/后续迁移策略 |
| H6 | 真实 Push 送达 | OPEN | Push merge/enable |
| H7 | 真实 AI Provider 受控验证 | OPEN | PR20 merge、R1 |
| H8 | MPL-2.0 人工评审 | OPEN | Push merge/enable |
| H9 | PoC 集成评审 | CLOSED | 已满足 |

H1/H2/H7 阻塞 R1；H6/H8 只阻塞 Push；H4 只阻塞 Android 支持声明；H3/H5 必须记录，
但不自动阻塞 R1。任何门禁都不得由代码任务自行关闭。

### 6.1 AI-DECISION-001 两层冻结

Stage 1 已由 ADR-027 v1.0 Final 人工批准并在本任务本地冻结：

- Provider 顺序：P1 DeepSeek、P2 阿里云百炼 / Qwen、P3 OpenAI（仅对照）；模型候选为
  DeepSeek V4 Flash（默认 non-thinking）、DeepSeek V4 Pro、Qwen 3.7 Plus、GPT-5.4 nano、
  GPT-5.4 mini；当前不冻结唯一 Provider；
- 网络固定为 `Browser/PWA -> Daily Assistant API -> AiProviderAdapter -> Provider HTTPS`；浏览器
  不直连、不持 credential，R1 禁止自动跨 Provider fallback，仅允许服务端受控配置切换；
- credential 仅允许 server secret/env reference 或未来经批准的 secret manager；唯一字段白名单、
  raw response 不持久化、正文不入普通日志及 metadata/pseudonymous id 边界见 ADR-027；
- 数据保留（canonical summary，权威细节见 ADR-027 6.1/6.2）：Raw body 不做 durable persistence、
  普通日志 retention 0；AiRequest unresolved/failed 输入最长 30 days 或用户提前删除；AiProposal
  最长 30 days；AiProviderAttempt 仅 redacted/normalized metadata、90 days；AI operational logs
  仅 metadata、30 days；正式业务记录遵循各自 domain retention；Provider 侧 retention 不冻结，
  PR20 真实调用前必须重新核验 privacy terms、data retention、processing region、model/API
  availability、credential mechanism 与 contractual/data-processing capability。
- timeout 15 seconds、最多 retry 1 次且仅限 network/timeout/HTTP 429/HTTP 5xx；rolling 20 requests，
  technical failure rate `>=50%` 且 count `>=5` 时 OPEN，60 seconds 后单 probe HALF_OPEN；
- 每用户 warning `¥3/month`、hard `¥5/month`；总体 warning `¥30/month`、hard `¥50/month`；
- 200 条人工构造/脱敏合成非真实数据：Finance/Transaction 60、Task 40、Calendar 35、Reminder 30、
  Trip 20、Ambiguous/missing/failure 15；本任务不执行评测。

provisional targets：Schema success `>=99%`（parse success AND JSON Schema valid AND field types valid
AND no non-whitelisted fields）；无需完全重录 `>=85%`（直接接受、少量字段编辑或回答补充问题后
完成 Proposal，无需重新输入完整请求）。

从项目开始即不可降低的安全阈值：

- 失败必须保留原输入；
- 正式业务写入 100% 经用户确认；
- Provider 输出不得直接写业务表；
- 敏感字段不得越过白名单。

PR20 完成受控真实评测后，依据真实 Provider 结果提出 final provider、final model 和 final effect
thresholds，经再次人工批准写入 AI ADR，再关闭效果门禁。最终效果阈值的校准不得降低上述安全阈值。
本任务只冻结策略，不执行真实评测、实现、credential 或云资源。

## 7. 关键任务卡

### V15-CTRL-001 — 治理重基线

- **目标**：形成唯一、可恢复、无冲突的 V1.5 执行控制体系。
- **背景/输入**：PR #10、ADR-026、docs/40、PLANS、execution-state、GitHub/CI 实时事实。
- **依赖**：PR #8、PR #9 已合入 integration。
- **允许修改**：治理/规划/状态/索引文档和必要的 context 校验脚本。
- **禁止修改**：业务代码、数据库、依赖、正式 CI、云资源、环境和部署。
- **步骤**：落地批准文本 → 本地校验 → 人工审查最终 diff → 独立 commit/push/PR 更新授权 →
  CI → 独立 merge 授权 → integration HEAD 核验。
- **验证**：`npm run check:context`、`git diff --check`、PR #10 全量 CI、合并后 HEAD/内容核验。
- **完成标准**：见第 11 节十二项条件；证据、文档、状态快照必须同步。
- **风险**：提前标记完成会使 PR6a 在错误基线上启动。

### PR6a — 临时 MySQL 8.4 验证入口

- **目标**：提供可重复的空库 migration 与数据库专项测试入口。
- **输入/依赖**：V15-CTRL-001 `DONE_INTEGRATION`；现有 migrations 与测试。
- **允许修改**：测试/脚本/治理配置及对应文档；**禁止**业务功能、生产数据库和云资源。
- **步骤**：设计临时库生命周期 → 空库全迁移 → 专项测试 → 销毁 → 脱敏日志/退出码。
- **验证**：本地临时 MySQL 8.4、失败路径、清理路径和 CI 可复现性。
- **完成标准**：代码、测试、文档、状态证据齐全；未获授权不 commit/push/开 PR。
- **风险**：误连非临时数据库；必须强校验连接目标和销毁边界。

### AI-DECISION-001 — AI 接入与评测方法冻结

- **目标**：在 PR2 前冻结第 6.1 节首层决策，并为 PR20 后最终阈值保留校准点。
- **状态**：`DONE / DONE_INTEGRATION`；ADR-027 v1.0 Final Accepted；PR2 前置门禁已按历史顺序完成。
- **冻结依赖/门禁（PLANS v2.1.1）**：V15-CTRL-001；必须在 PR2 前完成首层决策；不需要真实调用即可完成首层决策。
- **已核验决策输入**：PR6a = `DONE / DONE_INTEGRATION`；ADR-026 = `Accepted`。
- **已完成的历史交付/执行门禁**：AI-DECISION-001 在 PR2 前完成并达到 `DONE_INTEGRATION`；PR2 现为 `DONE / DONE_INTEGRATION`。该历史门禁不改写 PLANS v2.1.1 冻结依赖图。
- **允许修改**：ADR、评测方案、脱敏样本说明和规划状态；**禁止**写密钥或发起真实调用。
- **结果**：Provider/模型候选、服务端接入与 credential 边界、唯一 whitelist、日志/保留（数据保留
  期限矩阵已人工批准并冻结）、预算、timeout/retry/breaker、200 条非真实数据规范、provisional 和
  immutable safety thresholds 已冻结。
- **验证/完成标准**：决策字段完整、数值不变、不可降低安全阈值明确、人工批准证据和状态更新齐全；
  AI-DECISION-001 → PR2 的历史门禁已完成，PR2 已达到 `DONE / DONE_INTEGRATION`。
- **风险**：将 provisional 目标误当最终效果承诺。

### PR2 / PR5 / PR6 / PR9 — R1 Foundation 工程卡

| ID | 目标 | 允许修改 | 禁止项 | 验证与完成标准 |
|---|---|---|---|---|
| PR2 | Expand AI 四表，不改变现有行为 | Prisma/schema、migration、DB 测试、数据字典 | 真实 Provider/密钥/正式业务写入 | 空库迁移、回滚策略、隔离/索引测试；代码/测试/文档/状态证据 |
| PR5 | 共享 Flag、AI DTO/OpenAPI/错误码/审计契约 | contracts/config/对应测试文档 | Push/Import 具体契约、默认启用 | 契约兼容、默认关闭、OpenAPI/类型/审计测试和证据 |
| PR6 | DB 验证正式接入 CI、依赖治理、安全/License/SBOM 基线 | CI/工具/测试/治理文档 | 自动批准许可证、业务代码扩张 | lint/type/test/build/空库迁移/扫描；失败可诊断且不泄密 |
| PR9 | Repository 接口与 V1PlainRepository | web repository 层/测试/文档 | 激活 v2、迁移/清理用户数据 | 现有读写行为等价、离线/隔离/Back/恢复测试和证据 |

每项执行步骤均为：核验依赖 → 明确 diff 范围 → 实现单一职责 → 聚焦测试 → 全量质量检查 →
更新契约/文档/状态 → 等待各 Git 动作独立授权。不得把其中一项完成自动扩展为下一项授权。

### PR18 — AI Proposal / Operation、确认 UI 与 Fake Provider

- **目标**：实现完整且仅由用户最终确认的 Proposal 流程。
- **依赖/输入**：PR2、PR5 `DONE_INTEGRATION`；现有正式领域 Service；AI 合同。
- **允许修改**：AI Proposal/Operation 服务、Fake Provider、确认 UI、测试和相关文档。
- **禁止修改/行为**：AI 自动确认；AI 直接写业务表；Provider 输出直接调用正式写接口；真实 AI 调用。
- **执行流程**：用户输入 → Fake Provider → Proposal → 查看 Proposal → 不确定字段提示 →
  编辑/补充字段 → 接受或拒绝 → 用户最终确认 → 调用现有正式领域 Service → 正式业务记录。
- **必须覆盖**：Proposal 展示、用户编辑、接受、拒绝、重复确认、网络失败、浏览器返回、输入恢复、
  用户隔离和幂等。
- **验证/完成标准**：正反向 UI/E2E、隔离/幂等/失败恢复测试通过；代码、测试、文档、状态证据齐全。
- **风险**：把“接受 Proposal”和“最终业务写入确认”错误合并。

### PR19 — AI Router、Stub 与安全降级

- **目标**：在无真实调用条件下实现 Provider 路由、Schema 校验、超时、重试、熔断和降级。
- **依赖/输入**：PR18、PR6；AI 合同和 Fake/Stub。
- **允许修改**：AI Router/Provider adapter 接口、缓存、Stub、可观测性和测试。
- **禁止项**：真实凭据、真实调用、默认启用、绕过 Proposal/确认链。
- **步骤/验证**：成功、超时、格式错误、熔断、降级、输入恢复、预算拒绝场景；敏感日志检查。
- **完成标准**：代码、测试、文档、状态证据齐全并合入 integration。
- **冻结契约**：`tasks/PR19.md` = `PR19_TASK_CONTRACT_DRAFT_V10`；
  `PR19-CONTRACT-REVIEW09 = ACCEPT`；当前为
  `V10 / FROZEN / GPT_ACCEPT`；landing commit `bc8bc413...` is
  `LOCAL_COMMITTED / NOT_PUSHED`.
- **Repository Persisted Gate**：`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`；
  **Repository landing state**：`WORKTREE_FIXED / UNCOMMITTED`；**Persisted
  Successor Gate**：`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`。契约
  landing commit 不等于
  implementation started；PR19 implementation、push 和 PR operation 均保持
  `NOT_AUTHORIZED`，且不授权额外 commit。
- **READ_ONLY_GATE_PERSISTENCE_RULE**：`REPOSITORY_PERSISTED_GATE` 是最后一次
  已物化到治理文件的仓库写入检查点；`PERSISTED_SUCCESSOR_GATE` 是该检查点完成后
  预期的直接编排 Gate；`GPT_ACTIVE_GATE` 是外部控制的当前编排 Gate。Write Gate
  必须记录 checkpoint 和 successor；只读 Review 可不修改仓库而消费 successor，且
  successor 可保留至后续获授权 Write Gate 物化新状态。不得仅因 GPT Active Gate
  不等于 Persisted Gate、或已越过已消费 successor 而 REQUEST_CHANGES；仅当
  successor 在其 checkpoint 产生时已过期，才构成不一致。Git 事实仍须精确。
- **关键冻结边界**：existing `AiRequest.locale/timeZoneId` persistence remains
  unchanged；new persistence is limited to `originalUserInput`,
  `originalInputExpiresAt` and the minimal expiry index；no real Provider,
  credentials, PR20, H7 closure or deploy.

### PR20 — 真实 AI Provider Adapter

```yaml
developmentDependency:
  - PR19
humanValidationGate:
  - H7
mergeGate:
  - H7
```

- **目标**：实现一个默认关闭、可受控验证的真实 Provider Adapter。
- **允许修改**：Provider Adapter、凭据引用配置、受控测试与脱敏观测；**禁止**提交密钥、默认启用、
  向真实用户开放或 Provider 直接写正式业务。
- **状态语义**：PR19 `DONE_INTEGRATION` 后可开发 Adapter 并以 Fake/Stub 测试；真实调用必须获得独立授权。
  受控真实评测满足 H7 关闭标准后，由人工确认关闭 H7，PR20 才允许 merge integration。
- **验证/完成标准**：真实结果用于提出最终效果阈值；人工批准 AI ADR；安全阈值不变；代码/测试/文档/状态证据齐全。
- **风险**：把代码完成误当 H7 关闭，形成循环依赖或未授权真实调用。

## 8. 其余 canonical 任务卡

以下卡片与第 5.1 节依赖共同构成完整任务定义。每项均只允许修改其模块实现、测试、契约和文档；
禁止无关重构、默认启用、真实数据/资源操作。通用步骤为“核验依赖→实现单一范围→聚焦测试→质量检查→
更新文档/状态→等待独立 Git/外部动作授权”；通用完成标准为代码证据、测试证据、文档更新和状态更新齐全。

| ID | 目标/输入 | 专项验证与风险 |
|---|---|---|
| PR1 | RRULE Rule/Exception Expand（已合入） | 证据 PR #8；不得回填、切换或改变现有行为 |
| PR3 | PushSubscription/Delivery Expand | 空库迁移、用户隔离；不得引入真实发送或启用 |
| PR4 | ImportBatch/Item、ClientMigrationPolicy 与基础契约 | R2 空库/兼容测试；R1 不预建其专属字段 |
| PR7 | RecurrenceEngine、规范化、occurrence key、exception | DST/TZ/边界性质测试；不得切主引擎 |
| PR8 | RRULE Backfill 与 dual-read parity | 可恢复、幂等、差异报告；不得写生产数据 |
| PR10 | V2EncryptedRepository 与本地密钥 | 加密/隔离/失败恢复；不得激活 v2 |
| PR11 | MigrationCoordinator、journal、迁移 UI | 崩溃恢复/幂等/Back；不得自动迁移真实用户 |
| PR12 | dual-read/write、保留与清理资格 | parity/回滚/保留期；不得清理 v1 |
| PR13 | RRULE 主读与调度切换 | shadow/parity/回滚；R2 门禁前保持关闭 |
| PR14 | CSV 流式、XLSX 单并发、dry-run | 文件限制、恶意输入、资源上限；不得正式写入 |
| PR15 | Import Writer 与确认 UI | dry-run→确认→幂等写入、隔离/回滚；不得默认开放 |
| PR16 | Push 契约、订阅 API、权限 UI、自定义 SW | 权限拒绝/重复订阅/隔离；不得真实发送 |
| PR17 | 真实 Push Provider、重试和失效订阅 | H6/H8 人工关闭前不得 merge/enable；真实发送另行授权 |
| PR21 | parity、迁移、Import、Push、AI 观测页 | 指标正确、脱敏、权限；不扩大模块启用范围 |
| PR22 | Shrink 资格检查和回滚演练 | 备份/恢复/阻断条件；不得删除结构/数据 |
| PR23 | 最终 Shrink | 独立不可逆授权、备份恢复证据；逐项执行，不得批量假定合格 |

## 9. REL 任务卡

| ID | 目标与范围 | 依赖/授权 | 验证与完成标准 |
|---|---|---|---|
| REL-01 | 冻结环境设计、资源选择、成本/权限边界、MySQL/OSS/域名、RPO/RTO、部署拓扑 | V15-CTRL-001；仅方案设计，不创建资源 | ADR/拓扑/成本/权限/RPO-RTO 人工批准并更新状态 |
| REL-02 | 按已批方案创建实际 Staging 资源 | REL-01 + R1 Quality Gate + 独立云资源授权 | 资源清单、最小权限、费用告警、销毁/回收说明；不得触及生产 |
| REL-03 | 部署 Staging，完成监控、日志、备份、恢复和回滚演练 | REL-02；部署、迁移分别独立授权 | 可重复部署、备份恢复、回滚目标、告警证据 |
| REL-04 | 真机与受控真实服务验收 | REL-03、PR20、H1/H2/H7；真实调用独立授权 | 核心 E2E、隔离、失败恢复、安全和真机记录 |
| REL-05 | 3→5→约 10 人封闭试用，累计至少 7 个有效日历日 | REL-04；用户/数据范围人工批准 | 每阶段记录明确 commit/版本、人数、问题和退出结论 |
| REL-06 | 形成 RC，晋级 main/tag，生产发布并观察 | REL-05 + 发布门禁 + 独立生产授权 | main/tag/生产 commit 一致，监控/备份/回滚就绪 |

REL-05 稳定窗口规则：

- 每阶段必须记录明确 commit/版本；
- 用户可感知核心功能或数据行为变化时，重新计算受影响阶段的观察窗口；
- P0/P1 修复必须重新进入对应试用阶段；
- 最终 RC 必须能追溯到有效试用版本；
- 不得把完全不同 HEAD 的运行时间机械累计为 7 天。

## 10. 发布门禁

```text
开发完成
→ Integration 通过
→ Staging 部署
→ 分阶段试用
→ Release Candidate
→ integration → main 发布 PR
→ Production
```

| 晋级 | 必须证据 |
|---|---|
| 开发完成→Integration | 任务依赖满足；聚焦测试与全量质量检查；契约/文档/状态更新；人工 Review；独立 merge 授权；合并 HEAD 核验 |
| Integration→Staging | R1 Quality Gate；安全/License/SBOM；迁移/恢复/回滚方案；REL-01 批准；REL-02 独立资源授权 |
| Staging→试用 | 部署 commit 可追溯；核心 E2E/真机/隔离/备份恢复/监控通过；无开放 P0/P1 |
| 试用→RC | 3→5→约 10 人有效窗口；无 P0/P1、丢失、串号；RC 可追溯至有效试用版本 |
| RC→main/tag | 固定 integration RC HEAD；创建 integration→main 发布 PR；全量 CI；人工 Review；单独 merge 授权；merge main；核验 main HEAD；创建 release tag |
| tag→Production | 独立生产授权；只能部署该 main/tag commit；迁移/备份/回滚/监控/值守清单通过 |

不得直接从开发分支或未进入 main 的 integration commit 部署生产。

## 11. V15-CTRL-001 十二项完成条件

1. v2.1.1 Final 人工批准；
2. ADR-026 人工批准并 Accepted；
3. REL-01 依赖调整批准；
4. REL-02 Quality Gate 调整批准；
5. main/tag 发布门禁批准；
6. docs/40 必要章节完成 V1.1 同步；
7. PLANS、execution-state、ADR、docs/40 不存在有效冲突；
8. PR #10 最终 diff 经人工批准；
9. PR #10 CI 成功；
10. 获得独立 merge 授权；
11. 合入 `codex/v15-integration-foundation`；
12. 核验 integration HEAD 与正式规划完全一致。

截至 2026-08-11，PR #11 已合并，PR6a 达到 `DONE / DONE_INTEGRATION`；
`codex/v15-integration-foundation` HEAD `01292ef7a6bcf97addfd139fe39a3576fc05f9c9` 已核验。
AI-DECISION-001 已完成 ADR-027 v1.0 Final Accepted，当前为 `DONE / DONE_INTEGRATION`；
其 PR2 前置门禁已经完成。

## 12. Task Selection Policy

只要 `PLANS.md` 明确存在 `nextCanonicalTask`，GPT/Codex 在核验依赖和门禁后必须执行该任务，
不得自行重新排序；若该任务被阻塞，不得随机改做其他 READY 任务，除非计划明确 fallback 或人工改序。

优先级：

1. 当前 `IN_PROGRESS` / `VERIFYING` 任务；
2. 阻塞当前 R1 关键路径的人工决策；
3. 当前 R1 关键路径工程任务；
4. R1 CI / 安全 / 治理任务；
5. REL-01 等允许提前的非资源决策任务；
6. R1.1；
7. R2；
8. R3。

```yaml
currentTask: PR19
nextCanonicalTask: PR19
nextCanonicalTaskAfterCompletion: PR19
```

当前交付/执行门禁：PR18 已达到 `DONE / DONE_INTEGRATION`；source HEAD 为
`9bee2f8fb1401caaeebff96912a21e01e57c655c`，PR #17 已 Squash Merge 到
Integration，merge SHA 为 `7caf892022c9bb6833c7316893bfddeb169b7243`，
Integration CI #264 SUCCESS。PR19 依赖已满足，状态为
`READY / NOT_STARTED`；V10 契约已获得 `PR19-CONTRACT-REVIEW09 = ACCEPT`，
landing commit 为 `bc8bc413c6862e0d92247d7e6608dd6e99f505d7`
(`LOCAL_COMMITTED / NOT_PUSHED`)，remote Integration 为 `50f4f936...`，
local `AHEAD 1 / BEHIND 0`。Repository Persisted Gate 为
`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-FIX02`，Repository landing
state 为 `WORKTREE_FIXED / UNCOMMITTED`，Persisted Successor Gate 为
`PR19-TASK-CONTRACT-LAND-COMMIT-STATE-SEMANTICS-REVIEW02`。只读 review 可消费
该 successor 而不修改仓库；GPT Active Gate 的后续推进本身不构成不一致，也不授权
implementation、额外 commit、push 或 PR operation；不改写 PLANS v2.1.1 冻结
依赖图。
多个任务同时 READY 时仍不得自动并行：先比较 R1 关键路径影响，再遵循明确 next 指针，
决策阻塞优先于非阻塞工程；仍无法唯一确定时停止并请求人工选择。

## 13. 人工授权点

以下动作均需各自独立批准，一个动作的授权不自动扩展到后续动作：

- commit；push；创建或更新 PR；将 Draft 转 Ready；merge；
- 创建、修改或删除云资源；执行数据库 migration；
- 配置或使用真实 AI/Push/OCR/邮件等第三方凭据；
- 真实 AI 调用、真实 Push、真实用户试用；
- Staging 部署、main 发布 PR、release tag、Production 部署；
- 不可逆数据清理、Shrink、备份恢复影响真实数据的操作。

## 14. 执行与恢复规则

每次只执行一个任务。开始时读取本规划和 execution-state，再核验 GitHub/Git/CI/环境实时事实；
输出目标、依赖、允许/禁止范围、涉及文件、验证方式和授权边界。结束时更新实现、测试、文档、状态和证据，
并明确区分本地完成、提交、推送、PR、integration、main、Staging、RC 和发布。

任何结论缺少证据时标记 `待验证`。计划声明不得覆盖代码、测试、CI、PR 或部署事实。
