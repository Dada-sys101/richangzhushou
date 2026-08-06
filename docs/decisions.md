# 技术决策记录（Decisions）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05
说明：仅记录可从代码、文档或 Git 历史确认的决策；原因无法从仓库确认的标记“原因待确认”。来源标记：`[代码]`、`[文档]`、`[Git]`。

## 已确认决策

| ID | 决策 | 依据 | 原因/说明 |
| --- | --- | --- | --- |
| DEC-001 | 新产品与开封旅游助手完全分离 | `AGENTS.md`、`README.md` | 独立 Git 仓库 `D:\daily-assistant` |
| DEC-002 | V1 采用邀请码与可配置人数硬上限 | `docs/00`、`docs/03`、`docs/05` | 早期 10–20 人规模 |
| DEC-003 | 邀请码不绕过容量；关闭释放、暂停占用、恢复重查 | `docs/03`、`docs/05` | 事务内原子检查 |
| DEC-004 | 用户端优先 PWA + 桌面网页，原生 iOS 延后 | `docs/00`、`docs/01` | 原因待确认 |
| DEC-005 | 云端主副本 + 本地缓存 + 离线写入 | `docs/00`、`docs/02` | 产品不变量 |
| DEC-006 | AI 低风险确认执行、高风险二次确认与审计 | `docs/00`、`docs/03` | 产品不变量 |
| DEC-007 | 记账入口优先级：快捷指令 > 截图识别 > 语音文字 > 文件导入 | `docs/00`、`docs/01` | 用户确认的入口优先级 |
| DEC-008 | 管理员默认不能读取用户生活数据正文 | `docs/00`、`docs/04` | 隐私边界 |
| DEC-101 | npm workspaces monorepo（3 apps + 2 packages） | `[Git] 6169ac0`、根 `package.json` | 统一管理多端与共享契约；具体原因待确认 |
| DEC-102 | 后端 NestJS 单体 + Prisma 7 + MySQL 8 | `[Git] 6169ac0`、`apps/api` | 与架构不变量一致；选型原因待确认 |
| DEC-103 | 用户端 Vue 3 + Vite + PWA；管理端 Vue 3 + Element Plus | `[Git] 6169ac0`、`apps/web`、`apps/admin` | 选型原因待确认 |
| DEC-104 | API 基础路径 `/api/v1`；ID 字符串；时间 ISO 8601；金额定点字符串 | `packages/api-contracts`、`apps/api/src/main.ts` | 与 `docs/05`、`docs/06` 一致 |
| DEC-105 | 契约优先：OpenAPI 3.1 先建，业务后实现 | `[Git] 6169ac0`、`docs/13` | WP1 只建契约与骨架 |
| DEC-106 | WP1 数据库只定义共享枚举，不建业务表 | `apps/api/prisma/schema.prisma`、`migrations/README.md` | 避免过早固化业务 schema；WP2 起建表 |
| DEC-107 | API 安全基线：Helmet、全局 allow-list 校验、精确 CORS、`127.0.0.1` 监听 | `apps/api/src/main.ts` | 最小暴露与安全默认 |
| DEC-108 | 认证契约：短期 Bearer 访问令牌 + HttpOnly 刷新 Cookie + 最小权限快捷指令凭证 | `packages/api-contracts/openapi/openapi.yaml` | 契约层定义；实现待 WP2/WP4 |
| DEC-109 | 本地端口约定 3000/5173/5174，CORS 默认仅本地来源 | `README.md`、`apps/*/vite.config.ts`、`apps/api/src/main.ts` | 本地开发约定 |
| DEC-110 | 质量门 = format + lint + typecheck + test + build + Prisma validate + OpenAPI lint + migration diff + audit | 根 `package.json`（`scripts.quality`） | `docs/13` 记录 WP1 全部通过 |
| DEC-111 | 提交粒度：独立任务一个提交，提交信息使用中文（当前仓库惯例） | `[Git] git log` | 仓库惯例；后续可再约定 |
| DEC-112 | WP3 补充 `CategoryKind`（EXPENSE/INCOME）与 `FinancialAccountKind`（CASH/DEBIT_CARD/CREDIT_CARD/DIGITAL_WALLET/OTHER）取值；预算唯一约束 userId+month+categoryId（NULL 时服务层校验整体预算唯一） | `[文档] docs/05`、`[代码] WP3` | 数据字典未定义具体取值，属 `[关键假设]`，待产品确认 |
| DEC-113 | `ShortcutScope` 使用冒号字符串（`transaction:draft:create`/`finance:summary:read`），`DeviceCredential.scopes` 以 JSON 数组存储（冒号值不适用 MySQL ENUM）；凭证只存 SHA-256 哈希与展示前缀 | `[代码] apps/api/prisma/schema.prisma`、`shortcuts/*` | 契约枚举与存储解耦，避免 ENUM 特殊字符 |
| DEC-114 | 附件采用“短期上传意图 + 一次性上传令牌（只存哈希）+ 完成确认”流程；本地临时存储适配器写入 `apps/api/.local-storage` | `[代码] apps/api/src/attachments`、`integrations/local-storage.adapter.ts` | 失败不产生悬空正式附件；供应商未定前用本地实现（OPEN-006） |
| DEC-115 | 草稿确认在单个事务内将 `DraftRecord` 标记 `CONFIRMED` 并创建 `CONFIRMED` 交易，`resultId` 指向结果，保留 `source` 与 `clientMutationId` | `[代码] apps/api/src/drafts/drafts.service.ts`、`finance/finance.service.ts` | 保证草稿状态与正式记录原子一致（QA-DRAFT-002） |
| DEC-116 | 批量丢弃/清空草稿采用 HMAC 短期确认令牌（两阶段）并写 `AdminAudit`（`DRAFT_BATCH_DISCARD`） | `[代码] apps/api/src/common/security.service.ts`、`drafts/drafts.service.ts` | 高风险操作二次确认 + 可追溯（BR-AI-004 / QA-DRAFT-003） |
| DEC-117 | WP5 新增 `CalendarEventStatus`（SCHEDULED/CANCELLED）与 `ReminderTargetType`（CALENDAR_EVENT/TASK/STANDALONE）取值；提醒补充 `title`/`note` 字段 | `[代码] packages/api-contracts/src/enums.ts`、`apps/api/prisma/schema.prisma` | 数据字典未定义具体取值，属 `[关键假设]`，待产品确认 |
| DEC-118 | 提醒重复规则以 JSON `{ interval?, weekdays?, dayOfMonth?, until? }` 存储，`startsAt` 作为重复锚点，`scheduledAt` 恒为下一次应发送时间 | `[代码] apps/api/src/reminders/recurrence.util.ts`、`prisma/schema.prisma` | `Asia/Shanghai` 边界与调度器需要稳定锚点（BR-REM-001） |
| DEC-119 | 提醒调度器采用数据库记录 + 单进程周期扫描：`attempt_count`/`next_attempt_at`/`last_attempt_at` 原子领取，失败重试上限 3 次，账号非 `ACTIVE` 标记 `SUPPRESSED` | `[代码] apps/api/src/reminders/reminders.scheduler.ts` | 防重、可诊断状态（QA-REM-001）；多实例部署前需租约（docs/07） |
| DEC-120 | `NotificationAdapter` 接口 + 本地 `FakeNotificationAdapter`（`FAKE_NOTIFICATION_FAIL=true` 模拟失败）；无推送权限时保留应用内提醒并显示“通知未开启” | `[代码] apps/api/src/integrations/*`、`apps/web/src/views/RemindersView.vue` | OPEN-005 真实通道未定，按适配层降级 |
| DEC-121 | WP6 新增 `TripItemType`（TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）取值 | `[代码] packages/api-contracts/src/enums.ts`、`apps/api/prisma/schema.prisma` | 数据字典未定义具体取值，属 `[关键假设]`，待产品确认 |
| DEC-122 | `GET /trips/:id` 返回行程详情聚合：节点、行李、服务端费用汇总、关联账单与行程日期范围内日历事件 | `[代码] apps/api/src/trips/trips.service.ts` | `docs/12` “日程关联入口” 的最小实现形态，不新增跨实体外键 |
| DEC-123 | 超范围节点：未传 `confirmOutOfRange=true` 返回 `VALIDATION_ERROR`（不保存）；确认后保存并返回 `TripItemOutOfRangeWarning` | `[代码] apps/api/src/trips/trips.service.ts`、`apps/web/src/views/TripDetailView.vue` | BR-TRIP-002“未确认不保存；确认后允许保存” |
| DEC-124 | `Transaction.tripId` 为可空外键（ON DELETE SET NULL），创建/更新仅允许关联当前用户未删除行程（跨用户 404）；行程实际支出只统计 CONFIRMED 未删除支出减退款，服务端定点计算 | `[代码] apps/api/src/finance/*`、`apps/api/src/trips/trips.service.ts` | BR-TRIP-003 / QA-TRIP-001 |
| DEC-125 | WP6 未提供批量删除/清空节点或行李端点（`docs/06` 未声明）；如后续新增须按 BR-AI-004 二次确认并写脱敏审计（沿用 WP4 `confirmationToken` 模式） | `[代码] apps/api/src/trips/*`、`docs/06` | 范围控制：不在未声明端点前擅自实现高风险操作 |
| DEC-126 | WP7 同步游标采用服务端单调键集游标：`(updated_at, id)` 升序聚合 11 类同步实体，软删除以墓碑下发；游标为不透明字符串 | `[代码] apps/api/src/sync/*`、`docs/23` | 不引入消息队列/事件总线；键集分页单调、不丢不重（并发更新按至少一次语义幂等重放） |
| DEC-127 | WP7 幂等由 `sync_mutations` 统一承载：`request_hash` 摘要 + `result_ref` 重放；同键同内容返原结果、同键不同内容 `IDEMPOTENCY_CONFLICT` | `[代码] apps/api/src/sync/sync.service.ts`、`apps/api/prisma/schema.prisma` | 与各业务 `clientMutationId` 双重幂等，保证断网重连只落一条记录 |
| DEC-128 | 客户端离线写入走统一拦截：断网时业务写操作自动进入 IndexedDB 队列并返回本地占位实体；本地 ID 在同步成功后映射为服务端 ID | `[代码] apps/web/src/{api/client.ts,offline/*}` | 现有视图无需逐页改造即可离线；QA-SYNC-001/002 通过 |
| DEC-129 | 断网刷新进入「离线会话」模式（不持 access token、读本地缓存）；恢复联网先刷新令牌，同步请求 401 自动刷新重试；退出/关闭账号清空 IndexedDB | `[代码] apps/web/src/{stores/auth.ts,offline/sync.ts,offline/db.ts}` | 离线刷新不丢队列；QA-SYNC-004 通过；不在本地持久化令牌 |
| DEC-130 | WP9 账号模型：唯一 `username`（小写规范化）+ 密码登录；邮箱彻底移除；账号仅由管理员创建/重置密码，首次登录或重置后必须改密（`mustChangePassword`，未改密时数据端点 403） | `[代码] apps/api/prisma/schema.prisma`、`apps/api/src/{auth,admin}`、`packages/api-contracts` | 用户已确认的范围调整（docs/28） |
| DEC-131 | WP9 下线邀请码与邮件恢复：`InviteCode`/`InviteRedemption`/`RecoveryCode` 表和邮件适配器删除；`SystemSetting` 仅保留 `maxActiveUsers`；容量在管理员建号/重开时强制校验 | `[代码] apps/api/prisma/migrations/20260806140000_wp9_identity_entry_simplification`、`apps/api/src/capacity` | 用户已确认的“邀请码下线/邮箱彻底移除” |
| DEC-132 | WP9 下线截图 OCR：`/drafts/ocr`、OCR/Scan 适配器与 `AttachmentScanStatus` 删除；附件保留上传/完成/删除与本地存储，不做识别 | `[代码] apps/api/src/{drafts,attachments,integrations}`、`packages/api-contracts` | 用户已确认的“去掉 OCR 识别” |

## 尚未确定的决策

| ID | 事项 | 状态/默认假设 | 阻塞范围 |
| --- | --- | --- | --- |
| OPEN-001 | 正式产品名称 | 使用 Daily Assistant 临时名 | 品牌/域名 |
| OPEN-002 | 正式仓库与远端 | origin 已配置为 `richangzhushou.git`，未推送 | 提交/协作 |
| OPEN-003 | 邮件供应商 | 已关闭：WP9 下线邮箱，账号仅管理员创建 | 不适用 |
| OPEN-004 | OCR/AI 供应商 | 已关闭：WP9 下线截图 OCR，保留手动/文本/快捷指令 | 不适用 |
| OPEN-005 | 通知渠道 | 应用内 + 支持时 Web Push | 提醒最终验收 |
| OPEN-006 | 部署地域与备案 | 不创建生产资源 | 生产上线 |
| OPEN-007 | 关闭/删除保留期 | 暂按 30 天 | 隐私与恢复 |
| OPEN-008 | 邮箱验证是否首发必需 | 已关闭：WP9 下线邮箱，不适用 | 不适用 |
| OPEN-009 | 浏览器 QA 工具与脚本化 | `docs/07` 规划 Playwright，但仓库无依赖/脚本 | QA 可复现性 |
| OPEN-010 | 共享契约包接入方式 | 待确认（直接引用 TS 类型或生成客户端） | WP2 实现 |
| OPEN-011 | origin 仓库名与产品名关系 | 待确认 | 品牌/推送 |

## 无法确认的事项

- 技术栈选型（NestJS/Prisma/Vue/Element Plus）的具体商业或团队原因未在仓库中成文，统一标记“原因待确认”，不得编造。
- WP0 文档中“用户确认”“已确认事实”的口径来自规划文档本身，代码尚无可验证实现。
