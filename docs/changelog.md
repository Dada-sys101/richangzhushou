# 变更日志（Changelog）

文档版本：1.0
更新：2026-08-06
说明：根目录 `CHANGELOG.md` 与本文件保持同步；本文件是后续模型接手的标准变更入口。

## 2026-08-07 — PR #6 创建与 CI 验证

- PR #6（feat: add Aliyun OSS storage adapter）已创建：base=main、
  head=codex/aliyun-oss-storage-adapter、head SHA `11614ba5d26fabc13595974471f0c13f642cb3a2`。
- quality 与 browser-qa 均 SUCCESS（run `31156557067`、`31155080018`）；mergeable=true、
  无冲突、未发现真实密钥或敏感配置；尚未合并到 main。
- 历史情况：最初因本地 `gh` 未登录无法创建 PR；后续状态：PR #6 已创建，CI 已通过。

## 2026-08-07 — OPEN-006 对象存储接入代码实现

- 新增 `AliyunOssStorageAdapter`（`apps/api/src/integrations/aliyun-oss-storage.adapter.ts`，
  ali-oss 6.23.0）：实现 `put/get/delete`，缺失对象删除幂等，错误不泄漏 AccessKey/正文。
- 新增 `STORAGE_PROVIDER=local|oss` 切换与必填校验；`NODE_ENV=production` 禁止 local
  （staging 门禁），缺失 OSS 配置启动失败。
- 新增 `StorageKeyService`：新附件键 `users/{userId}/attachments/{fileId}`，
  旧 `attachments/{userId}/...` 键兼容；上传仍由 API 代理，无需 OSS CORS。
- 新增/更新单元测试 22 项；`deploy/staging/.env.staging.example` 与 `.env.example` 同步。
- 未创建真实 Bucket/RAM、未完成真实连通测试；staging 未创建、生产未部署；OPEN-006 未关闭。

## 2026-08-07 — E2E 修复 PR #4 合并，main 全绿

- PR #4（E2E 时间助手 24 小时制修复）以 squash 方式合并到 main（`47c40c9`）。
- main CI run `31144549537`：quality SUCCESS、browser-qa SUCCESS。
- 状态文档 PR #5 分支已合入最新 main，同步 PR #4 已合并与 main CI 全绿。

## 2026-08-07 — PR #3 合并与 main 验证

- PR #3（test: automate browser release smoke checks）以 squash 方式合并到 main，
  merge commit `4fcc613`；V1 发布决策与 OPEN-009 自动化正式进入 main。
- main CI run `31143350121`：quality PASS；browser-qa 的 E2E 时间助手 12/24 小时制缺陷
  （`endsAt` 被格式化为 01:xx 早于 `startsAt`）已由 PR #4（`47c40c9`）修复，
  后续 main run `31144549537` quality/browser-qa 均 SUCCESS。
- 合并后本地验证：quality PASS、smoke 20/20、完整矩阵 70/70。
- OPEN-006 为唯一未决 Staging 外部决策；staging 未创建、生产未部署。

## 2026-08-07 — V1 发布决策固化 + OPEN-009 浏览器 QA 自动化

- 产品名：正式中文“日常助手”、英文“Daily Assistant”（OPEN-001）；统一产品配置
  `packages/config/src/index.ts`（PRODUCT），用户端/管理端/登录页/PWA manifest/元数据一致；
  技术 package 名不重构（OPEN-011 品牌显示名与技术标识分离）。
- 通知范围：V1 仅应用内提醒（OPEN-005），提醒页明确“仅应用内查看”，不再展示浏览器推送授权状态；
  `FakeNotificationAdapter` 仅用于本地与测试；Web Push/系统通知列为 V1.1 候选。
- OPEN-009：`@playwright/test` 1.62.1、`playwright.config.ts`、`tests/e2e`
  （auth/admin/home/deletion 10 个用例）、`scripts/start-e2e-services.mjs`
  （专用测试库 + 自动 generate/build/migrate/bootstrap + 三服务启动 + 健康等待 + 进程清理）、
  根命令 `test:e2e`/`test:e2e:smoke`/`test:e2e:headed`/`test:e2e:matrix`；
  CI 新增独立 `browser-qa` job（Node 24 + MySQL 8.4 + Chromium + 失败截图/trace/video 上传）。
- 稳定性修复：web 客户端 401 单飞刷新重试，避免会话轮换竞态；登录限流可配置
  （`LOGIN_RATE_LIMIT_MAX`，默认仍为 10）。
- 验证：本地 smoke 20/20；完整矩阵 70/70（Chromium 桌面/390 移动、Firefox、WebKit、1440/375/430）。

## 2026-08-07 — OPEN-007 合并到 main（PR #1）

- PR #1（feat: implement expired account deletion cleanup）以 squash 方式合并到 main，
  merge commit `6d9c888`；任务分支 `codex/open-007-deletion-cleanup` 已删除。
- 合并后本地 `npm run quality` PASS；main 远程 CI run `31136793516` PASS
  （quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 账户删除调度器默认关闭，staging 单实例验证后方可开启；staging 未创建、生产未部署。
- 合并后状态文档同步在 `codex/post-open-007-merge-status` 分支（PR 待用户确认）。

## 2026-08-06 — OPEN-007 账户期满删除清理实现完成

- 数据模型：`UserStatus` 新增 `DELETION_PROCESSING`；`users` 新增
  `deletion_scheduled_at`/`deletion_started_at`/`deletion_completed_at`/
  `deletion_attempt_count`/`deletion_last_error`/`deletion_lease_expires_at`；
  migration `20260806092920_open007_account_deletion_cleanup`。
- 申请删除：写入计划删除时间（默认 30 天，`ACCOUNT_DELETION_RETENTION_DAYS` 可配置）。
- 清理任务：`AccountDeletionService` 原子领取（状态+租约+尝试上限）、批量扫描、
  失败保留可诊断状态并可在租约过期后重试；`AccountDeletionScheduler` 受
  `ACCOUNT_DELETION_SCHEDULER_ENABLED` 开关控制；手工入口
  `npm run account-deletion:run`。
- 清理范围：sessions/device_credentials/分类/账户/账单/预算/草稿/附件/日程/待办/
  提醒/行程（含节点与行李）/sync_mutations 真实删除；附件先经 `StorageAdapter.delete`
  删除文件再删记录（文件缺失幂等成功）。
- 匿名墓碑：随机 `deleted_<hex>` 用户名、空显示名、随机 Argon2 密码散列、
  `status=DELETED`、`deletion_completed_at`；原账号名可重新使用；`AdminAudit`
  清空 JSON 与原因并保留最小审计事实。
- 取消删除：管理端 `POST /admin/users/:id/cancel-deletion`（仅 `DELETION_PENDING`、
  容量复查、`USER_DELETE_CANCEL` 审计），契约/OpenAPI/管理端已同步。
- 测试：API 测试 111/111（新增 8 个单元 + 11 个 OPEN-007 集成）；空库 8 migrations
  `prisma migrate deploy` 通过；CLI 演练通过。
- 文档：`docs/05`、`docs/06`、`docs/27`、`docs/28`、`docs/decisions.md` 与状态文件同步。

## 2026-08-06 — 正式 main 分支建立与推送完成

- 确认 `codex/wp8-release-prep` 完整包含 `codex/wp1-foundation`（`rev-list --left-right --count` = `0 42`，`merge-base` = `981aafc8`）。
- 从 `codex/wp8-release-prep` @ `42bcef0` 创建并推送正式 `main`（`git push -u origin main`）；main = origin/main = origin/codex/wp8-release-prep = `42bcef0`。
- main 推送触发 GitHub Actions run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 无 force push、无额外 merge commit、旧远程分支未改动；GitHub 默认分支随后已由用户切换为 main（`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留）；暂不执行 staging/生产部署。

## 2026-08-06 — 发布准备第一阶段完成（推送 + 远端 CI 验证）

- 推送 `codex/wp8-release-prep` 到 `https://github.com/Dada-sys101/richangzhushou.git`（首推 `71b9f74`）。
- 首轮远端 CI run `31084434078` 失败：纯净环境缺 Prisma 生成客户端（`apps/api/src/generated`）与
  `packages/api-contracts` dist，typecheck 大量 TS2307/TS2339；本地因已有生成产物而通过。
- 最小修复 `.github/workflows/ci.yml`：quality 前执行 `prisma:generate` 与 contracts `build`；
  提交 `3e88808` 并推送；run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 未创建 PR、未部署；当时 origin 无 `main`、默认分支为 `codex/wp1-foundation`（后续已建立 main 并切换默认分支）。

## 2026-08-06 — 首页界面优化完成（docs/29）
- 首页改为“今日概览”（日期副标题）；未登录/登录失效/请求失败友好状态与按钮，
  不再展示后端技术错误文本。
- 顶部导航精简为首页/日程/待办/财务/行程/更多；移动端底部导航 5 项；
  快捷操作保留 4 项并统一图标；新增本月财务摘要、今日安排说明、空状态卡片。
- 同步状态支持已同步/同步中/同步失败并可重试；浅灰蓝背景 + 白色卡片 + 1280px 容器。
- 修复本地缓存日程未按日期过滤的既有缺陷（planner store 前端过滤）。
- 仅改前端；`npm run quality` PASS；用户端测试 15/15；浏览器 375–1440 无横向溢出；
  已提交 `68f3987` 并随 wp8/main 推送；未部署。

## 2026-08-06 — WP9 身份与录入简化本地验收通过（docs/28）
- 账号模型：`username`/`normalized_username`/`must_change_password`，邮箱列删除；
  删除 `recovery_codes`/`invite_codes`/`invite_redemptions` 表与邮件适配器；
  `system_settings` 仅保留 `max_active_users`；WP9 migration 含存量回填与回滚说明。
- 认证：登录改账号密码；新增 `POST /me/change-password`；删除注册/忘记密码/重置/自助重开；
  登录响应携带 `mustChangePassword`，未改密数据端点 403 `PASSWORD_CHANGE_REQUIRED`。
- 管理端：新增创建账号与重置密码（容量校验、强制改密、脱敏审计），
  `/admin/settings` 仅管理容量；邀请码与注册设置端点删除。
- 录入：删除 `/drafts/ocr`、OCR/Scan 适配器与 `AttachmentScanStatus`；
  附件保留上传/完成/删除与本地存储。
- 前端：用户端登录改“账号”、新增修改密码页、删除注册/找回/重置页与截图入口；
  管理端新增创建账号/重置密码，删除邀请码页。
- 验证：`npm run quality`、空库 7 migrations+seed、API 92/92、契约 125/125、
  浏览器登录/强制改密/管理端建号与控制台 0 错误、重启持久化全部通过。
- 已提交 `71b9f74` 并随 wp8/main 推送；未部署、未开始 OPEN-007。

## 2026-08-06 — 本机启动与访问验证完成（本地运行）
- API/Web/Admin 在本机运行（3000/5173/5174），本地 MySQL 8.4.9（3307）新建本地库 `daily_assistant_local`（6 migrations + seed）；演示账号 `demo@example.com` 登录、待办/记账读写与 API 重启持久化验证通过；`.env` 已备份，状态文档已更新，未提交、未推送、未部署。

## 2026-08-06 — 输出 WP8 可执行规划（docs/25）

- 新增 `docs/26-wp8-acceptance-report.md` 与 `docs/27-wp8-staging-release-checklist.md`：WP8 本地验收与发布清单。

## 2026-08-06 — WP8 全量质量与发布准备本地验收通过（docs/26/27）

- 契约/一致性：审计枚举补全 `DRAFT_BATCH_DISCARD`；数据字典补 `RecoveryCode`；端点清单补 `DELETE /me/sessions`；OpenAPI 72 路径与控制器一致，契约测试 132/132。
- 安全：生产强制 `CONFIRMATION_TOKEN_SECRET`；用户自助关号/申请删除/恢复码重开补写脱敏审计（`USER_CLOSE`/`USER_DELETE_REQUEST`/`USER_REOPEN`）；`.env.example` 补齐适配器与调度变量。
- 上传：新增 JPEG/PNG/WEBP 魔数校验；超大上传流改为 resume；wp4 测试适配并新增不匹配用例；扫描门控与悬空清理缺口如实记录。
- 可访问性/响应式：键盘路径、焦点、语义标签、role=alert、文字+图标状态、触控目标；375/390/430/768/1440 + 200% 缩放矩阵 Web 102/公开 30/管理端 42 全部无横向溢出。
- 回归：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器主流程（注册/登录/记账/日程/行程）与离线排队→恢复→单条落库通过。
- 演练：备份恢复（mysqldump→隔离库→24 表一致）；账号删除（DELETION_PENDING、会话撤销、容量释放、脱敏审计；期满清理未实现，缺口记录）。
- 发布准备：staging 发布清单、监控告警清单、隐私/试用门禁（docs/27）；OPEN-001~011 全部记录，未宣称生产可用。
- 分支 `codex/wp8-release-prep`；本地提交；未推送、未部署、未创建生产资源。

- 新增 `docs/25-wp8-codex-execution-plan.md`：安全复审、上传复审、可访问性、
  响应式矩阵、OpenAPI/数据库/浏览器全量验证、备份恢复与账号删除演练、staging
  发布清单的可执行规划。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步、`.project/session.md`
  恢复指引与 `docs/progress.md` 未开始项。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP7 PWA 与离线同步本地验收通过

- 契约：Sync 变更流/幂等 mutations/状态端点、`SyncEntityType`/`SyncAction`
  枚举、`CURSOR_INVALID`/`MUTATION_BATCH_TOO_LARGE`/`MUTATION_UNSUPPORTED`
  错误码，分类/账户/预算创建增加 `clientMutationId`；契约测试 132/132。
- 数据：`sync_mutations` 表（`user_id + client_mutation_id` 唯一、
  `request_hash`/`result_ref`/`status`）与同步实体游标索引；空库 6 migrations
  部署与 seed 通过。
- 后端：`(updatedAt, id)` 键集游标变更流（含墓碑）、幂等批量
  `POST /sync/mutations`、版本冲突返回服务端当前实体、`GET /sync/status`、
  跨用户 404/管理员 403/限流；集成测试 63/63（WP2–WP7）。
- 前端：IndexedDB 用户隔离缓存、离线写入队列、同步器（指数退避/手动重试/
  401 自动刷新）、SyncBadge、离线横幅、`/sync/conflicts` 冲突页、离线会话
  与退出/关闭账号清理；Service Worker 仅缓存应用外壳。
- 验收：`npm run quality`、空库 migration+seed、集成 63/63、浏览器
  QA-SYNC-001~004 与 375/390/430/768/1440 矩阵 20/20 全部通过
  （报告见 `docs/24-wp7-acceptance-report.md`）。
- 分支 `codex/wp7-pwa-sync`；未推送、未部署、未创建生产资源、未进入 WP8。

## 2026-08-06 — 输出 WP7 可执行规划（docs/23）

- 新增 `docs/23-wp7-codex-execution-plan.md`：应用安装、IndexedDB 本地缓存、离线
  写入队列、同步游标、幂等批处理、冲突页面与账号退出清理的可执行规划。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步、`.project/session.md`
  恢复指引与 `docs/progress.md` 未开始项。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP6 行程本地验收通过

- 契约：Trips/TripItems/PackingItems OpenAPI 请求/响应/DTO/枚举（`TripItemType`
  = TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）、`TripExpenseSummary`、
  `TripDetailResponse`、`TripItemOutOfRangeWarning` 与 `Transaction.tripId`；
  契约测试 127/127。
- 数据：新增 `trips`/`trip_items`/`packing_items` 表与 `transactions.trip_id`
  外键/索引；migration `20260806011520_wp6_trips` 空库部署与 seed 通过。
- 后端：行程/节点/行李 CRUD（软删除/恢复、幂等、版本并发、position 排序）、
  超范围节点“未确认不保存、确认后保存并返回提示”、服务端定点费用汇总
  （只计 CONFIRMED 未删除，退款冲减）、行程详情返回日期范围内日历事件、
  交易关联行程（跨用户 404）。
- 前端：行程列表/详情（费用汇总、节点、行李、关联账单、日历跳转）、记账表单
  行程选择、首页“行程/最近行程”入口；错误与网络失败状态沿用统一展示。
- 安全：跨用户 404、管理员 403；集成测试 55/55（WP2–WP6）。
- 验收：`npm run quality`、空库 5 migrations+seed、集成 55/55、浏览器矩阵
  10/10 无横向溢出（行程列表+详情，375/390/430/768/1440），主流程与控制台
  仅预期 400 校验日志（报告见 `docs/22-wp6-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP7。

## 2026-08-06 — 输出 WP6 可执行规划（docs/21）

- 新增 `docs/21-wp6-codex-execution-plan.md`：行程/节点/行李/账单关联/预算与实际
  支出/日程关联入口的可执行规划（前置与授权、只读检查、设计约束、8 个 checkpoint、
  强制测试与停止条件、风险与未决）。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步与 `.project/session.md`
  恢复指引；`docs/progress.md` 未开始项补充规划引用。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-05 — WP5 日程、待办与提醒本地验收通过

- 契约：Calendar/Tasks/Reminders OpenAPI 请求/响应/DTO/枚举（`CalendarEventStatus`、
  `ReminderScheduleType`、`ReminderTargetType`）与契约测试 118/118。
- 数据：新增 `calendar_events`、`tasks`、`reminders` 表与 migration
  `20260805095154_wp5_calendar_tasks_reminders`；seed 增加演示日程/待办/提醒。
- 后端：日程 CRUD（时间校验、重叠提示、软删除/恢复）、待办 CRUD 与状态机
  （完成/取消时间、过期计算）、提醒 CRUD 与重复展开、提醒调度器（原子领取、
  防重、失败重试上限、`FAILED`/`SUPPRESSED`）、`NotificationAdapter` 与本地假实现。
- 前端：今日安排卡片、日程页、待办页、提醒设置页与通知权限降级提示。
- 安全：跨用户 404、管理员 403；幂等/版本冲突与 Finance/草稿一致。
- 验收：`npm run quality`、空库 4 migrations+seed、集成 48/48、浏览器矩阵
  20/20 无横向溢出（报告见 `docs/20-wp5-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP6。

## 2026-08-05 — WP4 快捷指令、OCR 与统一录入本地验收通过

提交：`7cb7656`、`4be9524`、`4cd75e9`（分支 `codex/wp4-shortcuts-ocr`）

- 契约：补全 Shortcuts/Drafts/Attachments OpenAPI 请求/响应/DTO/错误码，
  新增 `ShortcutScope`、`AttachmentScanStatus`、`AttachmentOwnerType`、
  `DraftTargetType` 与 WP4 错误码；契约测试 112/112。
- 数据：`DeviceCredential`（tokenHash 唯一、scopes JSON、revokedAt）、
  `Attachment`（objectKey/uploadTokenHash 唯一、scanStatus 门控）、
  `DraftRecord`（clientMutationId 唯一、resultId）；migration
  `20260805085724_wp4_shortcuts_ocr` 空库部署与回滚说明。
- API：设备凭证创建/列表/撤销 + Bearer 守卫；快捷指令幂等草稿与今日支出；
  草稿文本解析/OCR/CRUD/确认/丢弃/批量二次确认；附件上传意图/内容上传/完成/删除；
  `StorageAdapter`/`OcrAdapter`/`ScanAdapter` 接口与本地假实现。
- 安全：跨用户 404、管理员 403、数据库无明文令牌、批量丢弃审计。
- 前端：快捷记录（文本/截图）、草稿中心与 DraftReviewCard、快捷指令配置页；
  OCR 失败与网络错误降级状态。
- 验收：`npm run quality`、空库 migration+seed、集成测试 41/41、浏览器 5 宽度
  矩阵 25/25 与主流程全部通过（`docs/18-wp4-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP5。
- 修复：附件非法类型错误码改由服务层返回 `ATTACHMENT_TYPE_NOT_ALLOWED`
  （`c1cfc33`）。

## 2026-08-05 — 持久化项目状态恢复机制（v2）

提交信息：`chore: add persistent project state recovery workflow`

- `AGENTS.md` 合并为 Project State Recovery / Required Workflow Before Every Task / Task Completion State Updates / Safety Rules 四章。
- `.project/context.md` 按新规范重写（含 Last Verified Commit、session 职责）。
- 新增 `.project/session.md` 与 `.project/decisions.md`（ADR-001~009）。
- 新增 `scripts/check-project-context.mjs`（`npm run check:context`，已并入 quality）与 `scripts/pre-commit-context-check.mjs`；提供可选 `.githooks/pre-commit` 示例。
- 同步 README、docs/progress 与根状态文件；未修改业务代码。

## 2026-08-05 — WP3 基础记账与今日财务本地验收通过

提交：`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`、`3db5b40`（分支 `codex/wp3-finance`）

- 契约：Finance OpenAPI 请求/响应/DTO/错误码、共享类型与契约测试；`DUPLICATE_RESOURCE` 错误码与 `POSSIBLE_DUPLICATE` 警告。
- 数据：`Category`、`FinancialAccount`、`Transaction`、`Budget` 表与 `CategoryKind`、`FinancialAccountKind` 枚举；migration `20260805080803_wp3_finance`；seed 支持演示用户与默认分类/账户。
- API：账单 CRUD/软删除/恢复、疑似重复提示（10 分钟窗口）、退款引用原账单或标记无原单、分类/账户归档、预算 CRUD 与 `Asia/Shanghai` 自然月校验、统计摘要与今日支出、CSV 导出（UTF-8 BOM、安全文件名、用户隔离）。
- 安全：Finance 路由要求 `USER` 角色（`UserOnlyGuard`），管理员访问用户内容 API 返回 403；所有查询强制 `userId` 范围。
- 前端：今日财务卡片、账单列表/表单、分类、账户、预算页面与 CSV 导出；校验失败与网络失败有明确错误提示。
- 修复：控制器 DTO 元数据（`import type` → 运行时导入）与非 JSON 错误体解析。
- 验收：`npm run quality` 通过；便携 MySQL 8.4 空库 `prisma migrate deploy` + seed 通过；集成测试 29/29；浏览器 5 宽度矩阵 30/30 与主流程/错误状态通过；`git diff --check` 通过（详见 `docs/16-wp3-acceptance-report.md`）。
- 未推送、未部署、未进入 WP4。

## 2026-08-05 — 跨任务自动恢复项目状态机制

提交信息：`docs: add automatic project state recovery workflow`

- `AGENTS.md` 新增 Project State Recovery（15 条）、Required workflow before every task（Step 1–8）、Task completion state updates、Task priority rules。
- `.project/context.md` 规范化为固定结构（Last Updated / Repository State / Project Summary / Current Development Stage / Last Completed Task / Current Task / Next Recommended Task / Completed Work / Remaining Work / Blockers / Known Issues / Verification Status / Recent Changes / Important Constraints / Handoff Instructions）。
- 同步更新 `docs/progress.md`（WP3 状态改为进行中）与根状态文件。
- 未修改业务代码；保留未提交的 `apps/api/src/finance/finance.controller.ts` 修改。

## 2026-08-05 — WP2 身份、容量与账号生命周期（本地完成）

提交：`ee0d3c9`（分支 `codex/wp2-identity-capacity`）

- 契约先行：OpenAPI、共享类型、错误码与账号状态机更新并通过契约测试。
- 新增 Prisma 实体与首个 migration：`SystemSetting`、`User`、`Session`、`RecoveryCode`、`InviteCode`、`InviteRedemption`、`AdminAudit`。
- 后端：Argon2id 密码、访问令牌内存保存、刷新令牌 HttpOnly Cookie 轮换/撤销、密码恢复、账号关闭/暂停/恢复/删除申请。
- 容量：SystemSetting 单例锁、固定锁顺序、邀请码同事务兑换、有上限重试；注册失败不消耗邀请码。
- 管理端：角色守卫、原因必填、脱敏审计；管理员默认不能访问用户生活数据正文。
- 前端：用户端注册/登录/忘记密码/重置密码/账号页；管理端概览/邀请码/用户/设置/审计页。
- 质量：`npm run quality` 通过；便携 MySQL 8.4 空库 migration 与 `TEST_DATABASE_URL` 集成测试通过；浏览器 5 宽度矩阵通过。
- 未推送、未部署、未创建生产资源；WP3 未实现。

## 2026-08-05 — 推送 WP1 分支到远端

提交信息：`docs: record wp1 branch push`

- 用户授权后推送 `codex/wp1-foundation`（提交 `518477e`）到 origin。
- GitHub Actions 首次运行结果待确认（本机 `gh` 未登录）。
- 推送期间发现本机 Git 全局代理不可用，使用系统代理临时覆盖；未修改全局配置。

## 2026-08-05 — 项目上下文与开发交接文档（本次提交）

提交信息：`docs: establish project context and development handoff`

- 新增 `.project/context.md` 实时上下文文件。
- 新增 `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`。
- 完善 `AGENTS.md`：计划先行、范围控制、兼容性检查、验证要求、进度更新、独立提交与不确定标注。
- 更新 `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、根 `CHANGELOG.md`、`docs/README.md`。
- 未修改业务代码，未创建或变更生产配置。

## 2026-08-05 — WP1 工程骨架与共享契约

提交：`6169ac0`（分支 `codex/wp1-foundation`）

- 创建 npm workspaces、Vue PWA 用户端、Vue Element Plus 管理端和 NestJS 单体 API 空壳。
- 创建共享配置与 API 契约包，对齐数据字典枚举、字符串 ID、ISO 8601 时间与定点金额边界。
- 将规划端点转换为 OpenAPI 3.1 基线（59 路径 / 86 操作）。
- 创建 Prisma 7 + MySQL schema 基线（仅枚举）、安全 `.env.example`、本地开发说明与 CI。
- 通过本地格式、Lint、类型、单元/契约/HTTP 冒烟测试、全部 workspace 构建、Prisma/OpenAPI、离线 migration diff 与依赖审计；详见 `docs/13-wp1-acceptance-report.md`。
- 本机缺少 MySQL/Docker，真实空库 migration deploy 未执行；未推送、未部署、未进入 WP2。

## 2026-08-05 — 初始化项目

提交：`5d52395`

- 初始化独立 Git 仓库与 WP0 规划文档体系（`docs/00`–`docs/12`）。
- 建立根级计划、状态、任务、验收、架构与恢复文件。

## 2026-08-04 — WP0 规划（提交前的本地规划过程记录）

- 完成产品范围、页面流程、业务规则、管理权限、数据模型、API、架构、安全、UI、测试、部署、风险与开发交接文档。
- 将 V1.0 拆分为 WP1–WP8；保留产品名称、远端仓库、供应商、部署地域与数据保留政策为未决项。
