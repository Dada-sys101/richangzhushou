# Technical Decisions

说明：只记录能够从代码、文档或 Git 历史确认的决策；无法确认原因时写 `Reason not confirmed from repository history.`，不自行编造历史原因。更完整的决策表见 `docs/decisions.md`。

## ADR-001: Monorepo npm workspaces 结构

- Date: 2026-08-05
- Status: Accepted
- Context: 需要同时维护用户端、管理端、API 与共享契约/配置。
- Decision: 采用 npm workspaces，目录为 `apps/{web,admin,api}` 与 `packages/{api-contracts,config}`。
- Alternatives Considered: Not documented in repository history.
- Consequences: 单仓库统一管理依赖与质量门；需要共享配置与契约包保持同步。
- Related Files: `package.json`、`apps/*`、`packages/*`
- Related Commit: `6169ac0`

## ADR-002: NestJS 单体 + Prisma 7 + MySQL 8

- Date: 2026-08-05
- Status: Accepted
- Context: 架构不变量要求单一后端、单一数据库，不引入微服务或消息队列。
- Decision: 后端使用 NestJS 单体，数据层使用 Prisma 7 + MySQL 8 provider。
- Alternatives Considered: Reason not confirmed from repository history.
- Consequences: WP1–WP3 已按此实现并通过验收；真实 MySQL 集成测试依赖外部数据库。
- Related Files: `apps/api`、`apps/api/prisma/schema.prisma`
- Related Commit: `6169ac0`、`3fcf1df`

## ADR-003: Vue 3 + Vite PWA 用户端、Vue 3 + Element Plus 管理端

- Date: 2026-08-05
- Status: Accepted
- Context: V1.0 需要 iPhone 可安装 PWA 与桌面管理端。
- Decision: 用户端 Vue 3 + TypeScript + Vite + vite-plugin-pwa；管理端 Vue 3 + Element Plus。
- Alternatives Considered: Reason not confirmed from repository history.
- Consequences: 两端独立构建，端口 5173/5174；PWA 离线业务能力留待 WP7。
- Related Files: `apps/web`、`apps/admin`
- Related Commit: `6169ac0`、`3fe6739`

## ADR-004: OpenAPI 3.1 契约优先 + 共享类型/枚举

- Date: 2026-08-05
- Status: Accepted
- Context: 需要保证 API、数据库、前端枚举一致并避免契约漂移。
- Decision: 以 `packages/api-contracts` 维护 OpenAPI 3.1、共享 TypeScript 类型与枚举，并用契约测试对齐。
- Alternatives Considered: Not documented in repository history.
- Consequences: 业务实现滞后于契约时存在漂移风险；已通过测试强制枚举一致。
- Related Files: `packages/api-contracts`
- Related Commit: `6169ac0`、`c1c8f92`

## ADR-005: API 边界约定（/api/v1、字符串 ID、ISO 8601、定点金额）

- Date: 2026-08-05
- Status: Accepted
- Context: 产品不变量要求 ID 为字符串、时间为 ISO 8601、金额避免浮点误差。
- Decision: 基础路径 `/api/v1`；ID 字符串；时间 ISO 8601；金额为定点字符串（`^-?\d+\.\d{2}$`）。
- Alternatives Considered: Not documented in repository history.
- Consequences: 所有业务 DTO 与错误响应遵循该约定；金额计算在服务层用 Decimal。
- Related Files: `packages/api-contracts/src/types.ts`、`apps/api/src`
- Related Commit: `6169ac0`、`e7b971c`

## ADR-006: WP2 认证与会话方案

- Date: 2026-08-05
- Status: Accepted
- Context: 需要安全密码存储、可撤销会话与刷新轮换。
- Decision: Argon2id 密码哈希；短期访问令牌仅存内存；刷新令牌哈希入库并经 HttpOnly Cookie 轮换/撤销；密码恢复使用一次性恢复码。
- Alternatives Considered: Not documented in repository history.
- Consequences: 通过 QA-SEC-003；刷新会话与关闭/暂停账号的撤销路径已实现。
- Related Files: `apps/api/src/auth`
- Related Commit: `ee0d3c9`（WP2 本地完成）

## ADR-007: 容量并发控制（SystemSetting 单例锁 + 事务 + 有上限重试）

- Date: 2026-08-05
- Status: Accepted
- Context: 邀请码不能绕过全局有效用户上限，并发抢最后名额不能超限。
- Decision: 注册/恢复/容量设置变更锁定 SystemSetting 单例行，固定锁顺序，邀请码兑换与用户创建同事务，冲突重试有上限。
- Alternatives Considered: Not documented in repository history.
- Consequences: QA-CAP-001~006 通过；容量正确性依赖真实 MySQL 集成测试。
- Related Files: `apps/api/src/capacity`、`apps/api/src/auth`
- Related Commit: `ee0d3c9`

## ADR-008: 管理端审计与隐私边界

- Date: 2026-08-05
- Status: Accepted
- Context: 所有管理写操作和高风险用户操作必须审计；管理员默认不能读用户生活数据正文。
- Decision: AdminAudit 记录脱敏前后值与原因，不可从产品 API 删除；用户内容 API 强制 USER 角色与 userId 范围，跨用户返回 404。
- Alternatives Considered: Not documented in repository history.
- Consequences: QA-SEC-001/002 通过；WP3 Finance 路由延续该边界。
- Related Files: `apps/api/src/admin`、`apps/api/src/audit`
- Related Commit: `ee0d3c9`、`e7b971c`

## ADR-009: 跨会话/跨模型/跨任务状态恢复机制

- Date: 2026-08-05
- Status: Accepted
- Context: 需要让不同模型在不同任务间自动恢复项目状态，并强制任务结束前更新状态。
- Decision: AGENTS.md 固化 Project State Recovery / Required Workflow Before Every Task / Task Completion State Updates / Safety Rules；`.project/context.md` 管长期状态、`.project/session.md` 管当前/暂停任务、`.project/decisions.md` 管 ADR；提供 `npm run check:context` 校验脚本与可选 pre-commit Hook。
- Alternatives Considered: 仅依赖聊天记录（否决：不可跨模型持久）；仅依赖文档（否决：缺少强制校验）。
- Consequences: 新任务默认先恢复状态；状态文件一致性可由脚本校验；非 Codex 工具是否自动读取 AGENTS.md 仍需其自身支持。
- Related Files: `AGENTS.md`、`.project/context.md`、`.project/session.md`、`.project/decisions.md`、`scripts/check-project-context.mjs`、`scripts/pre-commit-context-check.mjs`
- Related Commit: 本次提交（`chore: add persistent project state recovery workflow`，哈希以 `git log -1` 为准）

## ADR-010: WP4 ShortcutScope 与设备凭证存储

- Date: 2026-08-05
- Status: Accepted
- Context: 快捷指令凭证需要最小范围枚举，但范围值包含冒号（
  `transaction:draft:create`），不适合 MySQL ENUM。
- Decision: `ShortcutScope` 以共享 TypeScript/OpenAPI 字符串枚举定义；
  `DeviceCredential.scopes` 使用 JSON 数组存储；凭证明文只在创建时展示一次，
  数据库只存 SHA-256 哈希与 8 位前缀。
- Alternatives Considered: MySQL ENUM 存冒号值（否决：枚举扩展与工具兼容差）。
- Consequences: 通过 QA-SEC-003；作用域校验在 `DeviceCredentialGuard` 完成。
- Related Files: `packages/api-contracts/src/enums.ts`、
  `apps/api/prisma/schema.prisma`、`apps/api/src/shortcuts`
- Related Commit: `7cb7656`、`4be9524`、`4cd75e9`

## ADR-011: 附件上传意图 + 一次性令牌 + 完成确认

- Date: 2026-08-05
- Status: Accepted
- Context: 文档要求“短期上传意图 + 完成确认”，失败不得产生悬空正式附件。
- Decision: `POST /attachments/upload-intents` 返回一次性
  `uploadToken`（只存哈希）与短期有效期；`PUT /attachments/:id/content` 上传
  原始字节；`POST /attachments/:id/complete` 执行扫描并门控后续 OCR。
- Alternatives Considered: 直接 multipart 上传（否决：无意图/完成生命周期）。
- Consequences: 非法类型/超限/过期/扫描失败均有结构化错误；本地存储适配器写入
  `apps/api/.local-storage`。
- Related Files: `apps/api/src/attachments`、`apps/api/src/integrations`
- Related Commit: `4cd75e9`

## ADR-012: 草稿确认事务与 resultId

- Date: 2026-08-05
- Status: Accepted
- Context: 草稿确认必须原子地标记 `CONFIRMED` 并创建 `CONFIRMED` 交易。
- Decision: `DraftsService.confirmDraft` 在 `prisma.$transaction` 内调用
  `FinanceService.createTransaction(userId, dto, tx)`，并写
  `DraftRecord.resultId`；未确认草稿不计入统计。
- Alternatives Considered: 先建交易再更新草稿（否决：存在中间不一致）。
- Consequences: 通过 QA-DRAFT-002；FinanceService 支持可选事务客户端。
- Related Files: `apps/api/src/drafts/drafts.service.ts`、
  `apps/api/src/finance/finance.service.ts`
- Related Commit: `4cd75e9`

## ADR-013: 批量丢弃两阶段确认与审计

- Date: 2026-08-05
- Status: Accepted
- Context: BR-AI-004 要求批量丢弃/清空草稿二次确认并留下可追溯记录。
- Decision: 第一步返回 HMAC 短期确认令牌（绑定 userId/草稿 ID/reason/过期时间）；
  第二步校验后批量置 `DISCARDED` 并写 `AdminAudit`
  （action=`DRAFT_BATCH_DISCARD`）。
- Alternatives Considered: 单请求带确认标志（否决：无真实二次确认语义）。
- Consequences: 通过 QA-DRAFT-003；令牌最长 512 字符。
- Related Files: `apps/api/src/common/security.service.ts`、
  `apps/api/src/drafts`
- Related Commit: `4cd75e9`

## ADR-014: WP5 日程/待办/提醒契约与枚举

- Date: 2026-08-05
- Status: Accepted
- Context: WP5 需要 Calendar/Tasks/Reminders 的 OpenAPI 契约，并新增
  `CalendarEventStatus`、`ReminderScheduleType` 与 `ReminderTargetType`。
- Decision: 契约先行补齐 `/calendar-events`、`/tasks`、`/reminders` 及恢复
  端点；`CalendarEventStatus`（SCHEDULED/CANCELLED）、`ReminderTargetType`
  （含 STANDALONE）与提醒 `title`/`note` 属 `[关键假设]`，待产品确认。
- Alternatives Considered: 将提醒目标限定为事件/待办（否决：无法表达独立提醒）。
- Consequences: 契约测试 118/118；枚举与数据字典、Prisma、前端映射保持一致。
- Related Files: `packages/api-contracts`、`apps/api/prisma/schema.prisma`、
  `docs/05`、`docs/06`
- Related Commit: WP5 contracts commit

## ADR-015: 提醒重复规则 JSON 与调度器字段

- Date: 2026-08-05
- Status: Accepted
- Context: BR-REM-001 支持一次性/日/周/月；调度器需要可诊断状态与防重。
- Decision: `recurrence_json` 存 `{ interval?, weekdays?, dayOfMonth?, until? }`，
  `starts_at` 为重复锚点，`scheduled_at` 恒为下一次应发送时间；调度器用
  `attempt_count`/`next_attempt_at`/`last_attempt_at` 原子领取，失败重试上限 3 次，
  账号非 `ACTIVE` 时标记 `SUPPRESSED`。
- Alternatives Considered: 消息队列（否决：违反架构不变量）；状态枚举增加
  PROCESSING（否决：保持规划的五态语义，用重试字段表达在途）。
- Consequences: 集成测试覆盖防重、重试上限与抑制；多实例部署前需数据库租约。
- Related Files: `apps/api/src/reminders`、`apps/api/prisma/schema.prisma`
- Related Commit: WP5 db/reminders commit

## ADR-016: NotificationAdapter 适配层与本地假实现

- Date: 2026-08-05
- Status: Accepted
- Context: OPEN-005 通知通道未定；外部能力必须通过适配层并明确降级。
- Decision: `NotificationAdapter` 接口由 `IntegrationsModule` 提供
  `FakeNotificationAdapter`；`FAKE_NOTIFICATION_FAIL=true` 可模拟失败；无推送
  权限时保留应用内提醒并显示“通知未开启”。
- Alternatives Considered: 直接写浏览器推送（否决：通道/权限未定，且违反适配层约束）。
- Consequences: 调度失败可测试；真实 Web Push 接入时替换适配器实现。
- Related Files: `apps/api/src/integrations`、`apps/web/src/views/RemindersView.vue`
- Related Commit: WP5 api/web commit

## ADR-017: 提醒调度器单进程周期扫描

- Date: 2026-08-05
- Status: Accepted
- Context: 架构不变量禁止消息队列；V1 单实例部署。
- Decision: `RemindersScheduler` 以 `REMINDER_SCHEDULER_ENABLED=true` 开启
  周期扫描（默认 30 秒），通过原子 `updateMany` 领取任务；多实例部署前必须引入
  数据库租约或等价互斥。
- Alternatives Considered: 常驻 worker 进程（否决：增加部署复杂度）。
- Consequences: 集成测试验证并发双跑仅发送一次；文档记录多实例前置条件。
- Related Files: `apps/api/src/reminders/reminders.scheduler.ts`、`docs/07`
- Related Commit: WP5 api commit

## ADR-018: WP6 TripItemType 与行程/节点/行李实体

- Date: 2026-08-06
- Status: Accepted
- Context: WP6 需要节点类型枚举与三张新表；数据字典未定义具体取值。
- Decision: `TripItemType`（TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）为 `[关键假设]`；
  `Trip`/`TripItem`/`PackingItem` 沿用软删除、`version`、`clientMutationId`
  唯一键与同步资源约定；索引 `userId+startDate`、`tripId+position`。
- Alternatives Considered: 无类型字段（否决：无法区分节点形态）。
- Consequences: 契约/数据字典/Prisma/前端映射保持一致；枚举待产品确认。
- Related Files: `packages/api-contracts`、`apps/api/prisma/schema.prisma`、
  `docs/05`、`docs/decisions.md` DEC-121
- Related Commit: WP6 contracts/db commit

## ADR-019: 行程详情聚合与日期范围内日历入口

- Date: 2026-08-06
- Status: Accepted
- Context: `docs/12` 要求“行程详情提供日期范围内的日历查看；今日安排跳转入口”，
  具体形态 `[待确认]`，且不得擅自新增跨实体外键。
- Decision: `GET /trips/:id` 返回行程 + 节点 + 行李 + 服务端费用汇总 + 关联账单 +
  行程日期范围内日历事件；前端详情页提供日历跳转链接，首页增加“最近行程”入口。
- Alternatives Considered: 独立日历查询参数（否决：增加前端往返，且无既有范围查询）。
- Consequences: 日历关联为只读展示与跳转，不新增 `CalendarEvent.tripId`。
- Related Files: `apps/api/src/trips/trips.service.ts`、`apps/web/src/views/TripDetailView.vue`
- Related Commit: WP6 api/web commit

## ADR-020: 超范围节点两段式确认

- Date: 2026-08-06
- Status: Accepted
- Context: BR-TRIP-002 要求超范围提示且“未确认不保存；确认后允许保存”。
- Decision: 创建/更新节点超范围时，未传 `confirmOutOfRange=true` 返回
  `VALIDATION_ERROR`；确认后保存并返回 `TripItemOutOfRangeWarning`；前端在收到
  超范围错误时展示确认条，二次提交携带确认标记。
- Alternatives Considered: 首次调用直接保存并附警告（否决：违反“未确认不保存”）。
- Consequences: 接口语义清晰；前端交互包含明确确认步骤。
- Related Files: `apps/api/src/trips/trips.service.ts`、`apps/web/src/views/TripDetailView.vue`
- Related Commit: WP6 api/web commit

## ADR-021: Transaction.tripId 与费用汇总

- Date: 2026-08-06
- Status: Accepted
- Context: BR-TRIP-003 要求账单可关联行程，实际支出=已确认支出−退款。
- Decision: `transactions.trip_id` 可空外键（ON DELETE SET NULL），创建/更新仅允许
  关联当前用户未删除行程（跨用户/不存在 404）；行程费用汇总在服务端用
  `Prisma.Decimal` 计算（只计 CONFIRMED 未删除），前端不自算累计。
- Alternatives Considered: 统计时按日期归属行程（否决：与“账单关联”契约不一致）。
- Consequences: QA-TRIP-001 通过；CSV 导出增加 `tripId` 列。
- Related Files: `apps/api/src/finance/*`、`apps/api/src/trips/trips.service.ts`
- Related Commit: WP6 db/api commit

## ADR-022: WP6 不新增批量删除/清空端点

- Date: 2026-08-06
- Status: Accepted
- Context: `docs/06` 未声明批量端点；BR-AI-004 要求高风险操作二次确认与审计。
- Decision: WP6 仅实现单资源 CRUD/软删除/恢复；如后续新增批量删除/清空节点或行李，
  必须按 WP4 `confirmationToken` 模式二次确认并写脱敏审计。
- Alternatives Considered: 实现批量端点（否决：超出 `docs/06` 契约与当前工作包范围）。
- Consequences: 当前范围无新增高风险操作；决策记录在 `docs/decisions.md` DEC-125。
- Related Files: `apps/api/src/trips/*`、`docs/06`
- Related Commit: WP6 api commit

## ADR-023: WP7 同步游标为服务端键集游标

- Date: 2026-08-06
- Status: Accepted
- Context: 需要用户范围的增量变更流（创建/更新/删除墓碑），且架构不变量禁止
  引入消息队列或事件总线；规划文档 `docs/23` 将游标方案列为实现期决策。
- Decision: `GET /sync/changes` 按 `(updated_at, id)` 升序聚合 11 类同步实体，
  游标为不透明字符串（`{t, id}` 的 base64url）；软删除记录以墓碑
  `DELETE` 变更下发；并发更新按至少一次语义幂等重放，不丢失不重复。
- Alternatives Considered: 同步变更 outbox 表（否决：需在所有业务写入路径埋点，
  且规划明确“由数据库记录直接查询聚合”）；消息队列（否决：架构不变量）。
- Consequences: 契约/数据字典/Prisma/前端映射保持一致；新增同步实体时需扩展
  聚合查询与索引。
- Related Files: `apps/api/src/sync/sync.service.ts`、`apps/api/prisma/schema.prisma`
- Related Commit: `c9fee8c`、`3ddf4e7`

## ADR-024: WP7 幂等批量由 sync_mutations 统一承载

- Date: 2026-08-06
- Status: Accepted
- Context: BR-SYNC-001/002 要求所有离线写入携带用户范围内唯一 `clientMutationId`，
  同键同内容返原结果、同键不同内容返回 `IDEMPOTENCY_CONFLICT`。
- Decision: 新增 `sync_mutations` 表，`user_id + client_mutation_id` 唯一；
  服务端以规范化请求摘要（SHA-256）作为 `request_hash`，成功/失败结果存入
  `result_ref` 支持重放；同时把 `clientMutationId` 传入业务创建服务，与各实体
  唯一键形成双重幂等；分类/账户/预算补齐 `client_mutation_id` 列。
- Alternatives Considered: 仅依赖各业务 `clientMutationId`（否决：UPDATE/DELETE
  重放与错误结果无法统一返回原响应）。
- Consequences: QA-SYNC-002 与集成幂等用例通过；批次上限 50，超限返回
  `MUTATION_BATCH_TOO_LARGE`。
- Related Files: `apps/api/src/sync/*`、`apps/api/prisma/schema.prisma`、
  `apps/api/src/finance/*`
- Related Commit: `3ddf4e7`、`c9fee8c`

## ADR-025: 客户端离线会话与本地 ID 映射

- Date: 2026-08-06
- Status: Accepted
- Context: QA-SYNC-001/004 要求断网新增刷新后不丢、退出/关闭账号清理本地数据；
  现有视图直接调用 `api.*`，逐页改造不可行。
- Decision: API 客户端在断网时对业务写操作统一拦截入 IndexedDB 队列并返回本地
  占位实体；本地 ID 以 `local-*` 前缀存储，同步成功后映射为服务端 ID 并重写
  后续引用；断网刷新进入离线会话（不持 access token），恢复联网先刷新令牌，
  同步请求 401 自动刷新重试；退出/关闭/申请删除账号清空 IndexedDB。
- Alternatives Considered: 逐视图改造离线逻辑（否决：改动面大且易漏）；在
  localStorage 持久化 access token（否决：安全规则禁止）。
- Consequences: 浏览器 QA-SYNC-001~004 通过；离线编辑未同步实体时合并进原创建
  mutation；冲突进入 `/sync/conflicts` 由用户选择。
- Related Files: `apps/web/src/{api/client.ts,offline/*,stores/auth.ts}`
- Related Commit: `479b0a9`、`c7a4fa1`

## ADR-026: V1.5 发布范围、门禁映射与晋级策略

- Date: 2026-08-10
- Status: Accepted
- Context: docs/40 V1.0 的 H1～H8 统一总门禁与 V1.5 分阶段交付目标冲突。
- Decision: AI 为 R1、Push 为 R1.1、新 RRULE/Import 为 R2、完整 IndexedDB 迁移/Shrink 为 R3；
  人工门禁按 blockingScope 生效；REL-01 可提前设计但不建资源；REL-02 等待 R1 Quality Gate；
  Production 只能从经 main 发布 PR、main HEAD 核验和 release tag 的 commit 部署。
- Consequences: docs/40 升级 V1.1 且保留核心技术架构；PLANS v2.1.1 成为唯一 canonical 任务定义。
- Related Files: `PLANS.md`、`.project/v15-execution-state.md`、
  `docs/adr/ADR-026-v15-release-scope-r1.md`、`docs/40-v15-final-development-baseline.md`
- Related Commit: not created; local governance revision awaiting human diff review
