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

## 尚未确定的决策

| ID | 事项 | 状态/默认假设 | 阻塞范围 |
| --- | --- | --- | --- |
| OPEN-001 | 正式产品名称 | 使用 Daily Assistant 临时名 | 品牌/域名 |
| OPEN-002 | 正式仓库与远端 | origin 已配置为 `richangzhushou.git`，未推送 | 提交/协作 |
| OPEN-003 | 邮件供应商 | 适配器 + 开发假服务 | 注册验证/找回密码 |
| OPEN-004 | OCR/AI 供应商 | 适配器 + `FAKE_OCR_TEXT` 假实现 + 手动降级（WP4 已实现接口与假实现） | 真实识别效果验收 |
| OPEN-005 | 通知渠道 | 应用内 + 支持时 Web Push | 提醒最终验收 |
| OPEN-006 | 部署地域与备案 | 不创建生产资源 | 生产上线 |
| OPEN-007 | 关闭/删除保留期 | 暂按 30 天 | 隐私与恢复 |
| OPEN-008 | 邮箱验证是否首发必需 | 建议必需 | WP2 注册体验 |
| OPEN-009 | 浏览器 QA 工具与脚本化 | `docs/07` 规划 Playwright，但仓库无依赖/脚本 | QA 可复现性 |
| OPEN-010 | 共享契约包接入方式 | 待确认（直接引用 TS 类型或生成客户端） | WP2 实现 |
| OPEN-011 | origin 仓库名与产品名关系 | 待确认 | 品牌/推送 |

## 无法确认的事项

- 技术栈选型（NestJS/Prisma/Vue/Element Plus）的具体商业或团队原因未在仓库中成文，统一标记“原因待确认”，不得编造。
- WP0 文档中“用户确认”“已确认事实”的口径来自规划文档本身，代码尚无可验证实现。
