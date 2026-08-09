# 日常助手 V1.5 · GPT 逐步执行总规划

版本：v1.2  
日期：2026-08-10  
项目：日常助手 / Daily Assistant  
仓库：`Dada-sys101/richangzhushou`  
计划状态：ACTIVE  
当前执行任务：`V15-CTRL-001`（`DONE_PUSHED / HUMAN_REVIEW`）  
当前任务分支：`codex/v15-ctrl-001-rebaseline`  
最近完成任务：`V15-CTRL-001a`（`DONE_INTEGRATION`，GitHub PR #9）  
完成后的唯一下一工程任务：`PR6a`

> 当前执行项目唯一指向 `Dada-sys101/richangzhushou`、
> `codex/v15-integration-foundation` 和 V1.5 正式集成阶段。
> 历史名称“日常助手 V2”与本项目的关系仍记为 `NAME-001`，
> 状态 `PENDING_USER_CONFIRMATION`，不阻塞其他 V1.5 任务。

## 1. 用途

本文件是 GPT/Codex 接管 V1.5 后的唯一执行总计划，负责：

- 恢复 GitHub、代码、计划、状态和人工门禁；
- 一次只执行一个明确任务；
- 保存依赖、范围、验证、证据和授权边界；
- 区分本地、提交、推送、合并、Staging 和发布；
- 在新会话或更换模型后恢复，不依赖聊天记录。

本计划不构成无限授权。合并、云资源、真实外部服务、Staging、生产部署和
不可逆数据清理仍需独立批准。

## 2. 强制读取顺序

1. `AGENTS.md`
2. `PLANS.md`
3. `docs/40-v15-final-development-baseline.md`
4. `.project/v15-execution-state.md`
5. `.project/context.md`
6. `.project/session.md`
7. `tasks/<current-task>.md`
8. `PROJECT_STATUS.md`
9. `MASTER_PLAN.md`
10. `docs/progress.md`
11. `docs/roadmap.md`
12. `docs/decisions.md`
13. 当前 GitHub 分支、HEAD、开放 PR、CI 和实际代码

优先级：

```text
GitHub 实际代码 / PR / CI
> docs/40 冻结基线
> PLANS.md / execution state / 当前任务契约
> 完整需求与系统设计
> main 中的旧 V1 状态文档
> 历史草案与 PoC
```

## 3. 当前冻结事实

### 3.1 Git 与环境

- `main`：稳定 V1 基线，
  `13bfad4d32157166fa6e8f5215ce5f813a1ad67c`。
- `codex/v15-integration-foundation`：V1.5 集成线，
  `bc747b7ba4232adf888d68243f30573f1ca7866f`。
- `codex/v15-tech-selection-poc`：PoC 证据分支，不整体合并。
- PR #8：计划任务 PR1 已合入 integration。
- PR #9：V15-CTRL-001a / PLANS v1.1 已合入 integration。
- Staging 未创建，生产未部署。
- V1.5 新功能尚未进入 main，默认未启用。

### 3.2 已有 V1

V1 已实现：

- 管理员建号、认证、会话、容量、审计和用户隔离；
- 记账、账户、分类、预算、草稿和附件；
- 快捷指令、日历、待办、提醒和行程；
- Vue PWA、IndexedDB 缓存、离线队列、同步和冲突；
- Playwright E2E、GitHub Actions 和 OSS Adapter。

V1.5 必须增量集成，不得按新项目重复开发这些能力。

### 3.3 冻结技术路线

- NestJS 单体 + Prisma 7 + MySQL 8.4；
- Vue 3 + TypeScript + Vite PWA；Vue 3 + Element Plus 管理端；
- OpenAPI 3.1 + 共享类型；
- RRULE：`rrule-temporal + Temporal`，经 `RecurrenceEngine` 隔离；
- AI：`AiRequest / AiProposal / AiOperation / AiProviderAttempt`；
- 本地加密：AES-256-GCM、非导出密钥、用户/设备/版本隔离；
- IndexedDB：Expand → 影子迁移 → 验证 → dual-read/write → 切换 → 保留 → Shrink；
- Push：独立 Subscription/Delivery + 自定义 Service Worker；
- Import：CSV 流式，XLSX 受控单并发；
- 所有新功能默认关闭。

## 4. 状态机

| 状态 | 含义 |
|---|---|
| `PENDING` | 尚未开始 |
| `READY` | 依赖和门禁满足 |
| `IN_PROGRESS` | 当前唯一正在执行 |
| `BLOCKED` | 被决策、权限、资源或失败阻塞 |
| `VERIFYING` | 正在验证 |
| `DONE_LOCAL` | 本地完成 |
| `DONE_COMMITTED` | 已提交 |
| `DONE_PUSHED` | 已推送 |
| `DONE_INTEGRATION` | 已合入 integration |
| `DONE_MAIN` | 已合入 main |
| `STAGING_PASS` | Staging 通过 |
| `RELEASED` | 已发布 |
| `CANCELLED` | 用户取消 |

同一时间最多一个工程任务为 `IN_PROGRESS`。没有证据不得升级状态。
人工门禁按 `blockingScope` 生效。

## 5. 发布分层

```yaml
releaseTarget: R1 | R1.1 | R2 | R3
blocksR1Release: true | false
featureGate: core | ai | push | migration | import | cleanup
```

| 层级 | 任务 | 是否阻塞 R1 |
|---|---|---|
| R1 | V15-CTRL-001、PR6a、PR2、PR5、PR6、PR9、PR18～20、REL-01～06 | 是 |
| R1.1 | PR3、PR16、PR17 | 否，只阻塞 Push |
| R2 | PR4、PR7、PR8、PR13、PR14、PR15、PR21 | 否 |
| R3 | PR10、PR11、PR12、PR22、PR23 | 否 |

正式首发目标 6 周，第 7 周只处理阻断问题，不用于扩大范围。

## 6. 人工门禁

| 门禁 | 内容 | 状态 | blockingScope |
|---|---|---|---|
| H1 | iPhone Safari | 部分完成 | R1 |
| H2 | iPhone PWA/离线重开 | 部分完成 | R1 |
| H3 | Safari 无痕模式记录 | 已观察未归档 | 非阻塞限制 |
| H4 | Android Chrome Smoke | 未关闭 | Android 支持声明 |
| H5 | iOS 长期存储观察 | 未关闭 | 非阻塞观察 |
| H6 | 真实 Push 送达 | 未关闭 | Push 启用 |
| H7 | 真实 AI Provider | 未关闭 | R1 |
| H8 | MPL-2.0 评审 | 未关闭 | Push 启用 |
| H9 | PoC 集成评审 | 已关闭 | 已满足 |

H1/H2/H7 阻塞 R1；H6/H8 只阻塞 Push；H4 只阻塞 Android 正式支持声明；
H3/H5 需记录但不自动阻塞 R1。GPT 不得自动关闭门禁。

## 7. AI-DECISION-001

状态：`PENDING_USER_DECISION`  
阻塞：PR2  
不阻塞：V15-CTRL-001、PR6a  
截止：PR2 开始前，最迟首发第 1 周结束。

必须确认 Provider、模型、网络、凭据、单用户限制、总预算、超时、可发送字段、
日志/保留和真实评测标准。

草案目标：

- Schema 校验成功率 ≥99%；
- 核心样本无需完全重录比例 ≥85%；
- 失败 100% 保留原输入并可手工继续；
- 正式写入 100% 经用户确认。

前两项在 PR20 后校准，不作为 ADR-026 冻结条款。

## 8. 任务总账

### A. 治理

#### V15-CTRL-001a
- status: `DONE_INTEGRATION`
- evidence: GitHub PR #9 / merge `bc747b7...`

#### V15-CTRL-001
- status: `DONE_PUSHED`
- releaseTarget: `R1`
- blocksR1Release: `true`
- branch: `codex/v15-ctrl-001-rebaseline`
- contract: `tasks/V15-CTRL-001.md`
- next: `PR6a`
- completion: Draft PR、CI、人工审阅和 integration 合并

### B. Foundation

#### PR1：RRULE DB Expand
- status: `DONE_INTEGRATION`
- evidence: GitHub PR #8
- restriction: 不回填、不切换、不改变现有行为

#### PR6a：临时 MySQL 8.4 验证入口
- status: `PENDING`
- releaseTarget: `R1`
- dependency: V15-CTRL-001
- scope: 空库、完整 migration、专项测试、销毁、正确退出码和脱敏日志

#### PR2：AI DB Expand
- status: `BLOCKED`
- releaseTarget: `R1`
- dependencies: V15-CTRL-001、PR6a、AI-DECISION-001
- scope: AiRequest、AiProposal、AiOperation、AiProviderAttempt
- forbidden: 真实 Provider、密钥、模型调用、业务表写入

#### PR3：Push DB Expand
- status: `PENDING`
- releaseTarget: `R1.1`
- dependencies: V15-CTRL-001、PR6a

#### PR4：Import/迁移策略 DB Expand
- status: `PENDING`
- releaseTarget: `R2`
- dependencies: V15-CTRL-001、PR6a
- scope: ImportBatch、ImportItem、ClientMigrationPolicy 和基础契约
- rule: 整体后移，R1 不预建 PR4 专属字段

#### PR6：DB 验证接入 CI 和依赖治理
- status: `PENDING`
- releaseTarget: `R1`
- dependencies: V15-CTRL-001、PR6a

#### PR5：共享 Flag 与 AI Contracts
- status: `PENDING`
- releaseTarget: `R1`
- dependencies: PR1、PR2、PR6a
- scope: 共享 Flag、AI DTO/OpenAPI/错误码/审计
- excludes: Push 和 Import 具体契约

职责：
- PR16：Push 契约；
- PR4/PR14：Import 契约。

### C1. RRULE（R2）

- PR7：核心封装，`PENDING`；
- PR8：Backfill/parity，`PENDING`；
- PR13：主读/调度切换，`PENDING`。

R1 使用现有提醒路径。

### C2. Repository/本地数据

- PR9：统一 Repository + V1PlainRepository，R1；
- PR10：V2EncryptedRepository，R3；
- PR11：MigrationCoordinator，R3；
- PR12：dual-read/write 和清理资格，R3。

### C3. Import（R2）

- PR14：Parser/dry-run，负责映射、解析和资源限制 API；
- PR15：Writer/UI。

### C4. Push（R1.1）

- PR16：订阅 API、权限 UI、Service Worker 和 Push 契约；
- PR17：真实 Provider，依赖 H6/H8。

门禁未关闭时保持关闭，不阻塞 R1。

### C5. AI（R1）

- PR18：Proposal/Operation + Fake Provider；
- PR19：Router/Stub、Schema、超时、错误、熔断和降级；
- PR20：一个真实 Provider，依赖 H7。

### D. 观测与清理

- PR21：完整 Cutover 观测/管理页，R2；R1 只保留基础日志和指标；
- PR22：Shrink 准备，R3；
- PR23：最终 Shrink，R3，不阻塞 REL-06。

### E. Staging/发布（R1）

- REL-01：资源决策，`BLOCKED`；
- REL-02：Staging 基础设施；
- REL-03：发布和恢复演练；
- REL-04：真机和真实服务门禁；
- REL-05：3→5→约 10 人，至少 7 个日历日，无 P0/P1/丢失/串号；
- REL-06：依赖 REL-05、PR20、H1/H2/H7 和人工批准，不依赖 PR23。

## 9. 标准执行循环

开始前：

```text
读取状态和契约
→ 核验分支/HEAD/PR/CI
→ 审查任务与当前进度
→ 输出范围、禁止项、验证和授权
```

验证至少：

```bash
npm run check:context
npm run quality
git diff --check
```

无法运行必须标记 `NOT_RUN`，不得虚构通过。

完成前：

- 审查完整 diff；
- 更新 execution state/context/session/progress/roadmap；
- 区分 DONE_LOCAL/COMMITTED/PUSHED/INTEGRATION/RELEASED；
- 未获批准不得 merge、部署或创建云资源。

## 10. Execution State 必填项

顶层字段：updatedAt、mainHead、integrationHead、pocHead、currentTask、
currentStatus、nextCandidate、openPullRequests。

必填章节：

- Active Task
- Task Ledger
- Human Gates
- Evidence
- Last Verified
- Recovery Rules

## 11. 当前任务完成模型

- `DONE_PUSHED`：单一提交已推送，Draft PR 已创建，等待 CI/审阅；
- `DONE_INTEGRATION`：ADR、PLANS、execution state 获批准，CI 通过并合入。

V15-CTRL-001 未合入前不得开始 PR6a。

## 12. 证据

- Frozen baseline: `docs/40-v15-final-development-baseline.md`
- PR1 evidence: GitHub PR #8
- Plan evidence: GitHub PR #9
- Contract: `tasks/V15-CTRL-001.md`
- ADR: `docs/adr/ADR-026-v15-release-scope-r1.md`

## 13. 维护规则

- 范围、技术路线、数据生命周期、blockingScope 变化先写 ADR；
- 每个任务合入 integration 后更新状态和证据；
- GitHub 与文档冲突时停止开发并归一；
- 延后不等于取消；
- 第 7 周不得扩展非阻塞功能。
