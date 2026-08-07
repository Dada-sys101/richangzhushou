# 项目进度（Progress）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-07

说明：条目尽量附文件、模块或 Git 提交依据。提交：`5d52395` = 初始化项目（WP0 规划）；`6169ac0` = WP1 工程骨架与共享契约。

## 已完成

### OPEN-006 对象存储接入代码（2026-08-07）
- `AliyunOssStorageAdapter`（ali-oss 6.23.0）：`put/get/delete`、缺失对象删除幂等、
  错误不泄漏 AccessKey/正文；`STORAGE_PROVIDER=local|oss` 切换与必填校验；
  `NODE_ENV=production` 禁止 local（staging 门禁）。
- `StorageKeyService`：新附件键 `users/{userId}/attachments/{fileId}`，
  旧 `attachments/` 键兼容；上传仍由 API 服务端代理，无需 OSS CORS。
- 测试：新增/更新单元测试 22 项（配置选择/缺失校验/适配器行为/附件与账号删除服务接入）。
- 示例：`deploy/staging/.env.staging.example`（仅占位符）；`.env.example` 同步。
- 未创建真实 Bucket/RAM、未完成真实连通测试；staging 未创建、生产未部署。

### E2E 修复 PR #4 合并与 main 全绿（2026-08-07）
- PR #4（E2E 时间助手 24 小时制）squash 合并到 main（`47c40c9`）。
- main CI run `31144549537`：quality/browser-qa 均 SUCCESS；本地 quality PASS、smoke 20/20。

### PR #3 合并与 main 验证（2026-08-07）
- PR #3（V1 决策 + OPEN-009）squash 合并到 main（`4fcc613`）；任务分支已删除。
- main CI `31143350121`：quality PASS；browser-qa 的 E2E 时间助手 12/24 小时制缺陷
  已由 PR #4（`47c40c9`）修复，后续 main run `31144549537` quality/browser-qa 均 SUCCESS。
- 合并后本地：quality PASS、smoke 20/20、完整矩阵 70/70。

### V1 发布决策固化 + OPEN-009 浏览器 QA 自动化（2026-08-07）
- 产品名：正式中文“日常助手”、英文“Daily Assistant”（`packages/config` PRODUCT）；
  用户端/管理端/登录页/PWA manifest/元数据统一，技术标识保持 daily-assistant。
- 通知范围：V1 仅应用内提醒；提醒页文案更新；Web Push/系统通知列为 V1.1 候选。
- OPEN-009：Playwright 1.62.1 + `tests/e2e` 10 用例 + `scripts/start-e2e-services.mjs` +
  根命令 + CI `browser-qa` job；本地 smoke 20/20、完整矩阵 70/70；
  web 客户端 401 单飞刷新重试修复。

### OPEN-007 合并到 main（2026-08-07）
- PR #1（feat: implement expired account deletion cleanup）以 squash 方式合并到 main，
  merge commit `6d9c888`；任务分支已删除；合并后本地 `npm run quality` PASS；
  main 远程 CI run `31136793516` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 账户删除调度器默认关闭，staging 单实例验证后方可开启；staging 未创建、生产未部署。

### OPEN-007 账户期满删除清理（2026-08-06）
- `UserStatus` 新增 `DELETION_PROCESSING`；`users` 新增
  `deletion_scheduled_at`/`deletion_started_at`/`deletion_completed_at`/
  `deletion_attempt_count`/`deletion_last_error`/`deletion_lease_expires_at`
  （migration `20260806092920_open007_account_deletion_cleanup`）。
- 申请删除写入计划时间（默认 30 天，`ACCOUNT_DELETION_RETENTION_DAYS` 可配置）；
  后台任务原子领取（状态+租约+尝试上限）批量清理，失败可诊断可重试，成功后写匿名墓碑；
  附件经存储适配器真实删除（缺失幂等）；管理员可取消保留期内删除申请。
- 验证：API 测试 111/111（新增 8 单元 + 11 OPEN-007 集成）、空库 8 migrations
  `prisma migrate deploy`、CLI 演练（`claimed=1 completed=1`）均通过；`docs/27` 已修正。

### 发布准备第二阶段（2026-08-06）
- 确认分支祖先关系：`merge-base` = `981aafc8`；`rev-list --left-right --count origin/codex/wp1-foundation...origin/codex/wp8-release-prep` = `0 42`（`codex/wp8-release-prep` 完整包含 `codex/wp1-foundation`）。
- 建立并推送正式 `main`：本地旧 `main`（`5d52395`，已被 wp8 包含）删除后，从 `codex/wp8-release-prep` @ `42bcef0` 重建并 `git push -u origin main`；main = origin/main = origin/codex/wp8-release-prep = `42bcef0`。
- main 推送触发 GitHub Actions run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）；无 force push、无额外 merge commit、旧远程分支未改动。
- GitHub 默认分支已切换为 `main`（用户网页操作，2026-08-06）；`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留。

### 发布准备第一阶段（2026-08-06）
- 推送 `codex/wp8-release-prep` 到 origin：首推 `71b9f74`；首轮远端 CI run `31084434078` 失败
  （纯净环境缺 Prisma 生成客户端与 `packages/api-contracts` dist，typecheck 报 TS2307/TS2339）。
- 最小修复 `.github/workflows/ci.yml`：在 quality 前执行 `prisma:generate` 与 contracts `build`；
  提交 `3e88808` 并推送；run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 未创建 PR、未部署；当时 origin 无 `main`、默认分支为 `codex/wp1-foundation`（后续已建立 main 并切换默认分支）。

### 首页界面优化（2026-08-06）

- 用户端首页改为“今日概览”，副标题显示日期；未登录/登录失效/请求失败三类友好状态与
  登录/重新登录/重试按钮；不再直接展示后端技术错误文本。
- 顶部导航精简为首页/日程/待办/财务/行程/更多（快捷记录、草稿中心、快捷指令、提醒、
  预算、分类、资金账户、个人设置收进“更多”）；移动端底部导航为首页/日程/记一笔/待办/我的。
- 快捷操作保留记一笔/新建待办/新建日程/添加提醒（统一线性图标）；新增本月财务摘要
  （收入/支出/预算剩余）、今日安排说明与入口、最近账单与最近行程空状态卡片。
- 同步状态支持已同步/同步中/同步失败，失败可重试；浅灰蓝背景、白色卡片、统一圆角/
  边框/阴影、1280px 容器、375–1440 响应式。
- 仅改前端；未修改 API/OpenAPI/数据库；`npm run quality` PASS；用户端测试 15/15；
  浏览器验证通过（详见 `docs/29`）；已提交 `68f3987` 并随 wp8/main 推送；未部署。

### WP9 身份与录入简化（2026-08-06）
- 账号模型：`username`/`normalized_username`/`must_change_password`，邮箱列删除；
  `recovery_codes`/`invite_codes`/`invite_redemptions` 表与邮件适配器删除；
  `system_settings` 仅保留 `max_active_users`；WP9 migration 含存量回填。
- 认证与管理：登录改账号密码；管理员创建账号/重置密码（容量校验、首登强制改密、
  `USER_CREATE`/`USER_PASSWORD_RESET` 审计）；删除注册/找回/邀请码端点。
- 录入：截图 OCR 与 `AttachmentScanStatus` 下线，附件保留上传/完成/删除。
- 验证：`npm run quality`、空库 7 migrations+seed、API 92/92、契约 125/125、
  浏览器（登录/强制改密/管理端建号/控制台 0 错误）、重启持久化均通过
  （报告见 `docs/28-wp9-identity-entry-simplification.md`）。

### 本机运行验证（2026-08-06）
- 本机已启动并验证 V1.0：API（3000）、Web（5173）、Admin（5174）、本地 MySQL（3307）。
- 演示账号登录、待办/记账创建与读取、API 重启后数据持久化均通过；浏览器控制台无阻塞错误。

| 条目 | 依据 |
| --- | --- |
| WP0 规划文档体系（00–12） | 提交 `5d52395`；`docs/00`–`docs/12` |
| 独立 Git 仓库初始化 | 提交 `5d52395`；`git log` |
| Monorepo 工程骨架（3 apps + 2 packages） | 提交 `6169ac0`；根 `package.json` |
| 用户端/管理端/API 空壳与路由 | 提交 `6169ac0`；`apps/*/src` |
| PWA 配置（manifest、Workbox 外壳） | 提交 `6169ac0`；`apps/web/vite.config.ts` |
| OpenAPI 3.1 契约（59 路径 / 86 操作：85 业务 + 1 health） | 提交 `6169ac0`；`packages/api-contracts/openapi/openapi.yaml` |
| 共享枚举/边界类型及 TS↔OpenAPI 对齐测试 | 提交 `6169ac0`；`packages/api-contracts/src`、`test` |
| Prisma 7 + MySQL 基线（11 个共享枚举，无业务表） | 提交 `6169ac0`；`apps/api/prisma/schema.prisma` |
| API 安全基线（Helmet、allow-list 校验、精确 CORS、127.0.0.1 监听） | 提交 `6169ac0`；`apps/api/src/main.ts` |
| CI workflow（质量门 + 空库 migrate deploy） | 提交 `6169ac0`；`.github/workflows/ci.yml` |
| WP1 本地质量门与 HTTP 冒烟 | `docs/13-wp1-acceptance-report.md` |
| 浏览器矩阵检查（本机产物，未入库） | `docs/13`；`.playwright-cli/`、`output/playwright/` |
| 项目上下文与接管文档体系 | 本次提交（见 `docs/changelog.md`） |
| WP2 契约：OpenAPI/共享类型/错误码/状态机 | `packages/api-contracts`；`docs/14` |
| WP2 Prisma 实体与首个 migration | `apps/api/prisma/schema.prisma`、`prisma/migrations/20260805000000_wp2_identity_capacity` |
| WP2 身份与会话：Argon2id、刷新 Cookie、恢复凭证 | `apps/api/src/auth`；`docs/14` |
| WP2 容量与邀请码事务 | `apps/api/src/capacity`、`apps/api/src/auth`；`docs/14` |
| WP2 管理端 API、角色守卫与审计 | `apps/api/src/admin`、`apps/api/src/audit` |
| WP2 用户端与管理端页面 | `apps/web/src/views`、`apps/admin/src/views` |
| WP2 集成与浏览器验收 | `apps/api/src/integration/wp2.integration.test.ts`；`output/playwright/wp2` |
| WP2 复核（2026-08-05）：空库迁移、seed、18/18 集成测试与 5 宽度浏览器矩阵 | `docs/14-wp2-acceptance-report.md` v2.0；`output/playwright/wp2` |
| 跨任务自动恢复机制（Project State Recovery 工作流） | 本次提交；`AGENTS.md`、`.project/context.md` |
| WP3 契约：Finance OpenAPI/共享类型/错误码/契约测试 | `c1c8f92`；`packages/api-contracts` |
| WP3 Prisma 实体、migration、seed 与回滚说明 | `3fcf1df`；`apps/api/prisma`；`migrations/20260805080803_wp3_finance` |
| WP3 Finance API 与单元/集成测试 | `e7b971c`；`apps/api/src/finance`、`apps/api/src/integration/wp3.integration.test.ts` |
| WP3 用户端记账页面 | `3fe6739`；`apps/web/src/views`、`stores/finance.ts` |
| WP3 修复与浏览器矩阵验收 | `3db5b40`；`docs/16-wp3-acceptance-report.md`；`output/playwright/wp3` |
| 持久化项目状态恢复机制（session/decisions/check:context 与可选 Hook） | 本次提交；`.project/session.md`、`.project/decisions.md`、`scripts/check-project-context.mjs` |
| WP4 契约：Shortcuts/Drafts/Attachments OpenAPI、共享类型、ShortcutScope 与错误码 | `7cb7656`；`packages/api-contracts` |
| WP4 Prisma 实体、migration、回滚说明与数据字典 | `4be9524`；`apps/api/prisma`；`migrations/20260805085724_wp4_shortcuts_ocr` |
| WP4 设备凭证、快捷指令 API、草稿中心、附件/OCR 与集成测试 | `4cd75e9`；`apps/api/src/{shortcuts,drafts,attachments,integrations}`；`wp4.integration.test.ts` |
| WP4 前端快捷记录/草稿中心/快捷指令配置页与浏览器矩阵 | 本次提交；`apps/web/src`；`docs/18-wp4-acceptance-report.md` |
| WP5 契约：Calendar/Tasks/Reminders OpenAPI、共享类型、枚举与契约测试 | 本次提交；`packages/api-contracts` |
| WP5 数据：`calendar_events`/`tasks`/`reminders`、migration、seed 与回滚说明 | 本次提交；`apps/api/prisma`；`docs/05` |
| WP5 后端：日程/待办/提醒 CRUD、状态机、重复展开、调度器与通知适配器 | 本次提交；`apps/api/src/{calendar,tasks,reminders,integrations}`；`wp5.integration.test.ts` |
| WP5 前端：今日安排卡片、日程/待办/提醒页与通知权限降级 | 本次提交；`apps/web/src`；`docs/20-wp5-acceptance-report.md` |
| WP6 契约：Trips/TripItems/PackingItems OpenAPI、`TripItemType` 枚举、`TripExpenseSummary`、`Transaction.tripId` 与契约测试 | `d039efc`；`packages/api-contracts` |
| WP6 数据：`trips`/`trip_items`/`packing_items` 与 `transactions.trip_id` 外键/索引、migration `20260806011520_wp6_trips`、seed 与回滚说明 | `c767ba5`；`apps/api/prisma` |
| WP6 后端：行程/节点/行李 CRUD、超范围确认、费用汇总、日历入口、交易关联与集成测试 | `8f70868`；`apps/api/src/trips`、`finance`、`integration/wp6.integration.test.ts` |
| WP6 前端：行程列表/详情/节点/行李/关联账单/日历跳转/记账行程选择与首页入口 | `abbdeb7`；`apps/web/src` |
| WP7 契约：Sync 变更流/幂等 mutations/状态端点、错误码与共享类型 | `6ed79da`；`packages/api-contracts` |
| WP7 数据：`sync_mutations`、分类/账户/预算 `client_mutation_id` 与游标索引 | `3ddf4e7`；`apps/api/prisma` |
| WP7 后端：变更流/幂等批量/版本冲突/状态/限流与集成测试 63/63 | `c9fee8c`；`apps/api/src/sync` |
| WP7 前端：IndexedDB 离线队列/同步器/SyncBadge/冲突页/离线会话/退出清理 | `479b0a9`、`c7a4fa1`；`apps/web/src/offline` 等 |
| WP8 契约/安全/上传复查与修复：审计枚举补全、用户自助操作审计、确认令牌密钥、上传魔数校验、文档一致性 | 本次提交（分支 `codex/wp8-release-prep`）；`docs/26` |
| WP8 可访问性与响应式：键盘/焦点/语义/触控 + 375/390/430/768/1440/200% 矩阵（Web 102、公开 30、管理端 42） | 本次提交；`docs/26` |
| WP8 全量回归：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器主流程与离线同步回归 | 本次提交；`docs/26` |
| WP8 备份恢复演练（mysqldump→隔离库恢复→24 表一致）与账号删除演练（DELETION_PENDING/审计/清理缺口记录） | 本次提交；`docs/26`、`docs/27` |
| WP8 发布准备：staging 发布清单、监控告警清单、隐私/试用门禁、WP8 验收报告 | 本次提交；`docs/27` |

## 部分完成

| 条目 | 现状 | 依据 |
| --- | --- | --- |
| 共享契约接入应用代码 | `apps/api` 已引用 `@daily-assistant/api-contracts`；前端使用本地 client 类型 | `apps/api/package.json` |
| PWA 离线能力 | 应用外壳 + IndexedDB 业务缓存、离线写入队列、同步器与冲突页（WP7 已完成本地验收） | `apps/web/src/offline`、`vite.config.ts` |
| CI 验证 | `main` 与 `codex/wp8-release-prep` 均已推送且 GitHub Actions 通过（main run `31086031458`、wp8 run `31085287317`）；WP2–WP7 分支尚未推送 | `.github/workflows/ci.yml`；`docs/14` |
| 浏览器矩阵验证 | 已用 `playwright-cli` 完成 5 宽度并保存产物；尚未固化为仓库内一键脚本 | `output/playwright/wp2`（gitignored 部分） |

## 进行中

- OPEN-006 对象存储接入 PR（代码已完成，待合并与 CI 验证）。

## 未开始

- 真实 OSS Bucket/RAM/连通测试与备份上传验证（OPEN-006，需授权）。
- staging 创建/部署需另行授权（见 `docs/26`、`docs/27`）。

以上工作包状态与 `MASTER_PLAN.md`、`TODO.md` 一致：WP0–WP7 已 DONE（WP7 验收见
`docs/24-wp7-acceptance-report.md`），WP8 为 `DONE`（本地验收，`docs/26`）。

## 已知问题

| 问题 | 影响 | 状态 |
| --- | --- | --- |
| 便携 MySQL 8.4 位于仓库外 | 其他机器复跑集成测试需要自备 MySQL 8.x | 记录于 `docs/14` |
| 浏览器 QA 未固化为仓库内一键脚本 | 复现依赖 `playwright-cli` 与本地服务 | 待后续固化 |
| 远端 CI 曾因纯净环境缺生成产物失败 | 首次 CI 无法通过 | 已修复（`3e88808`，run `31084755305` PASS）；WP2–WP7 分支未推送待授权 |
| origin 仓库名 `richangzhushou` 与产品名 Daily Assistant 不一致 | 品牌/仓库命名 `[待确认]` | OPEN-001/002 |
| WP3 整体预算 NULL 唯一性由服务层校验；原账单软删除后其退款仍计入统计；统计摘要仅按 CNY 汇总；CSV 单次上限 10,000 行 | 边界行为，V1 规模可接受 | 记录于 `docs/16` |
| 真实 Web Push/系统通知通道未接入（OPEN-005）；提醒调度器按单进程周期扫描实现 | 应用内提醒完整可用；多实例部署前需数据库租约 | 记录于 `docs/20`、`docs/07` |

## 待验证事项

- 当前机器 `npm run quality` 已复跑通过（WP5 分支，2026-08-05）。
- 便携 MySQL 8.4 空库 `prisma migrate deploy`（4 migrations）与 seed 已真实执行通过；WP2+WP3+WP4+WP5 集成测试 48/48 通过。
- GitHub Actions 远端执行：`main` @ `42bcef0` 已通过（run `31086031458`）、`codex/wp8-release-prep` @ `42bcef0` 已通过（run `31085287317`）；WP2–WP7 分支未推送待授权。
- 浏览器矩阵（375/390/430/768/1440）已用 `playwright-cli` 验证首页/日程/待办/提醒（20/20 无横向溢出）；一键脚本化复现待后续（OPEN-009）。
- `npm run check:context` 与 `npm run quality` 已在本次机制任务中复跑通过。
- 未实现功能一律不得视为已验证；计划中的功能不得写成已完成。
- WP8 验收：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器矩阵 174/174、备份恢复 24/24 表一致、离线排队→恢复→单条落库均通过（`docs/26`）；账号删除期满清理未实现（缺口已记录）。
- 真实 OCR/AI/通知供应商效果未验证（OPEN-003/004/005）；对象存储真实连通未验证
  （OPEN-006，适配器代码已完成）。
