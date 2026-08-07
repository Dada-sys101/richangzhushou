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
| DEC-133 | OPEN-007 账户期满删除清理：`users` 增加删除调度/开始/完成/尝试次数/失败原因/租约字段与 `DELETION_PROCESSING` 状态；后台任务原子领取（状态+租约+尝试上限）清理全部业务行与附件文件后写匿名墓碑；`AdminAudit` 脱敏；管理员可取消 `DELETION_PENDING`（容量复查）；已通过 PR #1 合并到 main（`6d9c888`） | `[代码] apps/api/src/account-deletion/*`、`apps/api/prisma/migrations/20260806092920_open007_account_deletion_cleanup`、`apps/api/src/admin` | 隐私不变量（BR-DEL）：失败不标记 DELETED、重复执行幂等、多实例不重复领取 |
| DEC-134 | V1 正式产品名：中文“日常助手”、英文“Daily Assistant”；用户界面、PWA manifest、登录页与元数据统一使用，技术 package 名称不重构（OPEN-001） | `packages/config/src/index.ts`（PRODUCT）、`apps/web`、`apps/admin` | 品牌显示名与技术标识分离（OPEN-011） |
| DEC-135 | V1 通知范围仅应用内提醒：不承诺 Web Push/系统通知/短信/邮件；`FakeNotificationAdapter` 仅用于本地与测试；提醒页明确“仅应用内查看”；Web Push/系统通知列为 V1.1 候选（OPEN-005） | `apps/web/src/views/RemindersView.vue`、`apps/api/src/integrations/*`、`docs/27` | 不显示虚假的“系统通知已开启”状态 |
| DEC-136 | OPEN-011：正式产品显示名与 GitHub 仓库名 `richangzhushou`、npm workspace/服务名/部署目录 `daily-assistant` 分离；改品牌时不要求重命名仓库或 package | `packages/config/src/index.ts`、根 `package.json`、`.github/workflows/ci.yml` | 品牌演进低成本 |
| DEC-137 | OPEN-009：Playwright 浏览器 QA 自动化——`tests/e2e` smoke（Chromium 桌面+移动）与完整矩阵（Firefox/WebKit/1440/375/430）、独立 CI `browser-qa` job、失败截图/trace/video 上传；web 客户端对 401 做单飞刷新重试 | `playwright.config.ts`、`tests/e2e/*`、`scripts/start-e2e-services.mjs`、`.github/workflows/ci.yml`、`apps/web/src/api/{client,session}.ts` | 核心冒烟不再依赖手工 playwright-cli |
| DEC-138 | PR #3 合并：V1 发布决策（OPEN-001/005/011）与 OPEN-009 以 squash 合并到 main（`4fcc613`）；合并后 browser-qa 暴露 E2E 时间助手 12/24 小时制缺陷，以 24 小时制修复并经 PR #4 合并到 main（`47c40c9`），main CI 全绿 | `[Git] 4fcc613`、`47c40c9`、`tests/e2e/helpers/e2e.ts` | 测试确定性：结束时间跨正午边界时不得被格式化为 01:xx |
| DEC-139 | OPEN-006 对象存储接入：新增 `AliyunOssStorageAdapter`（实现 `put/get/delete`，缺失对象删除幂等，错误不泄漏 AccessKey/正文）与 `STORAGE_PROVIDER=local|oss` 配置切换；`NODE_ENV=production` 禁止 local、缺失 OSS 配置启动失败；新附件键 `users/{userId}/attachments/{fileId}`，旧 `attachments/` 键保留兼容；上传仍由 API 代理，无需 OSS CORS | `[代码] apps/api/src/integrations/{aliyun-oss-storage.adapter,storage.config,storage-key.service}.ts`、`apps/api/src/attachments/attachments.service.ts` | 私有 Bucket + 最小权限；未配置时不得意外连接 OSS；staging 门禁阻止误用本地临时存储 |

## 尚未确定的决策

| ID | 事项 | 状态/默认假设 | 阻塞范围 |
| --- | --- | --- | --- |
| OPEN-001 | 正式产品名称 | 已决策：日常助手 / Daily Assistant（DEC-134） | 品牌/域名 |
| OPEN-002 | 正式仓库与远端 | origin 已配置并推送：`main` 为默认分支，`codex/*` 分支保留；仓库名与产品名关系见 OPEN-011 | 提交/协作 |
| OPEN-003 | 邮件供应商 | 已关闭：WP9 下线邮箱，账号仅管理员创建 | 不适用 |
| OPEN-004 | OCR/AI 供应商 | 已关闭：WP9 下线截图 OCR，保留手动/文本/快捷指令 | 不适用 |
| OPEN-005 | 通知渠道 | V1 已决策：仅应用内提醒；Web Push/系统通知为 V1.1 候选（DEC-135） | 提醒最终验收（V1 范围已定） |
| OPEN-006 | 部署地域与备案 | 代码已实现（OSS 适配器/配置切换/键服务，DEC-139）；真实 Bucket、RAM 凭据与连通测试未完成；staging 未创建 | 生产上线 |
| OPEN-007 | 关闭/删除保留期 | 已实现并合并到 main（PR #1，`6d9c888`）：30 天默认且可配置；期满清理、取消删除、附件删除、匿名墓碑与重试上限；调度器默认关闭 | 隐私与恢复（待 staging 单实例验证） |
| OPEN-008 | 邮箱验证是否首发必需 | 已关闭：WP9 下线邮箱，不适用 | 不适用 |
| OPEN-009 | 浏览器 QA 工具与脚本化 | 已完成：Playwright smoke/matrix + CI browser-qa + 失败产物（DEC-137） | QA 可复现性（已入库） |
| OPEN-010 | 共享契约包接入方式 | 已接入：`apps/api` 引用 `@daily-assistant/api-contracts` 包；前端使用仓库内本地 client 类型（未启用代码生成客户端） | 契约一致性 |
| OPEN-011 | origin 仓库名与产品名关系 | 已决策：品牌显示名与技术标识分离（DEC-136） | 品牌/推送 |

> 状态更新（2026-08-07）：OPEN-001/005/009/011 已通过 PR #3 合并到 main（`4fcc613`），
> E2E 修复经 PR #4 合并到 main（`47c40c9`），main CI 全绿；
> OPEN-006（部署地域与对象存储）为唯一未决 Staging 外部决策；OSS 适配器代码已实现（DEC-139），
> 真实 OSS 资源与连通验证待用户授权。

## 无法确认的事项

- 技术栈选型（NestJS/Prisma/Vue/Element Plus）的具体商业或团队原因未在仓库中成文，统一标记“原因待确认”，不得编造。
- WP0 文档中“用户确认”“已确认事实”的口径来自规划文档本身，代码尚无可验证实现。
