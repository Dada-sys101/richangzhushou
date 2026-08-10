# Changelog

## 2026-08-10 — PR6a 临时 MySQL 8.4 验证入口（本地）

- 核验 PR #10 已合并，integration HEAD 为 `371a43d...`，同步 V15-CTRL-001
  `DONE_INTEGRATION` 与 PR6a 开工快照。
- Round 1 将 `npm run validate:mysql84:temporary` 收紧为 loopback-only；bootstrap 管理凭据与随机
  scoped DB user 完全分离，并加入 guard isolation、child env allowlist、全流脱敏、partial-create
  cleanup、Windows/POSIX 进程树终止、有界 readiness 和稳定退出码。
- focused tests 1 file / 26 tests PASS；MySQL 8.4.9 两次 fresh DB/user 均通过 9 migrations、
  14 files / 105 DB tests；failure exit 41、真实 SIGINT exit 60，四次 DB/user 残留均为 0。
- 四个本地 JSON evidence 与 `.sha256` sidecar 4/4 匹配；quality/context/diff 均通过，临时实例
  已停止且数据目录移入回收站。
- 未修改业务功能、Prisma schema/migrations、依赖或正式 CI；未 add、commit、push、创建 PR 或部署。

## 2026-08-10 — V15-CTRL-001 v2.1.1 Final 本地落地（未提交）

- 人工批准 V1.5 v2.1.1 Final、ADR-026 发布映射、REL-01/02 调整、PR18/20 范围、
  AI provisional/安全阈值、Task Selection Policy 和 main/tag 发布门禁。
- 本地将 PLANS 更新为自包含 v2.1.1，ADR-026 标为 Accepted，docs/40 升级 V1.1，
  execution-state 改为双维度状态与非实时快照语义，并同步必要派生文档。
- 本条记录不表示已 commit、push、更新 PR #10、merge、创建资源、部署、迁移或调用真实 AI。

## 2026-08-07 — PR #6 合并到 main
- PR #6（feat: add Aliyun OSS storage adapter）已 squash 合并到 main（merge commit `db5c5d3`），
  远程任务分支 `codex/aliyun-oss-storage-adapter` 已删除。
- main CI run `31158434661`：quality SUCCESS、browser-qa SUCCESS；本地 quality PASS、smoke 20/20。
- Aliyun OSS 适配器、`STORAGE_PROVIDER` 配置切换、`StorageKeyService` 与测试已进入 main；
  `LocalStorageAdapter` 仍仅用于本地与测试。
- 未创建真实 OSS Bucket/RAM/凭据；未执行真实上传/读取/删除与备份上传验证；staging 未创建、
  生产未部署；OPEN-006 仍为部分完成。

## 2026-08-07 — PR #6 创建与 CI 验证
- PR #6（feat: add Aliyun OSS storage adapter）已创建：base=main、head=codex/aliyun-oss-storage-adapter、
  head SHA `11614ba5d26fabc13595974471f0c13f642cb3a2`。
- quality 与 browser-qa 均 SUCCESS（run `31156557067`、`31155080018`）；mergeable=true、
  无冲突、未发现真实密钥或敏感配置；尚未合并到 main（当时状态；随后已 squash 合并，见下条）。
- 历史情况：最初因本地 `gh` 未登录无法创建 PR；后续状态：PR #6 已创建，CI 已通过。

## 2026-08-07 — OPEN-006 对象存储接入代码实现
- 新增 `AliyunOssStorageAdapter`（ali-oss 6.23.0）：实现 `StorageAdapter` 的 `put/get/delete`，
  缺失对象删除幂等，网络错误包装为不泄漏 AccessKey/正文的可诊断错误。
- 新增 `STORAGE_PROVIDER=local|oss` 切换与必填校验（Bucket/Region/Endpoint/AccessKey）；
  `NODE_ENV=production` 禁止 local，未显式配置也启动失败（staging 门禁）。
- 新增 `StorageKeyService`：新附件键 `users/{userId}/attachments/{fileId}`；
  旧 `attachments/` 键保留兼容读取与删除；上传仍由 API 服务端代理，无需 OSS CORS。
- 新增/更新单元测试 22 项；新增 `deploy/staging/.env.staging.example`（仅占位符）。
- 未创建真实 OSS Bucket/RAM、未完成真实连通测试；staging 未创建、生产未部署；OPEN-006 未关闭。

## 2026-08-07 — E2E 修复 PR #4 合并，main 全绿
- PR #4（fix: use 24-hour clock in e2e datetime helper）以 squash 方式合并到 main，
  merge commit `47c40c9`；E2E 时间助手强制 24 小时制，跨正午边界不再误报 endsAt<startsAt。
- main CI run `31144549537`：quality SUCCESS、browser-qa SUCCESS。
- 状态文档 PR #5 已合入最新 main，同步 PR #4 已合并与 main CI 全绿。

## 2026-08-07 — PR #3 合并与 main 验证
- PR #3（test: automate browser release smoke checks）以 squash 方式合并到 main，
  merge commit `4fcc613`；V1 发布决策（OPEN-001/005/011）与 OPEN-009 进入 main。
- main CI run `31143350121`：quality PASS；browser-qa 的 E2E 时间助手 12/24 小时制缺陷
  已由 PR #4（`47c40c9`）修复，后续 main run `31144549537` quality/browser-qa 均 SUCCESS。
- 合并后本地验证：`npm run quality` PASS、smoke 20/20、完整矩阵 70/70。
- OPEN-006（部署地域与对象存储）为唯一未决 Staging 外部决策；staging 未创建、生产未部署。

## 2026-08-07 — V1 发布决策固化 + OPEN-009 浏览器 QA 自动化
- 产品名：正式中文“日常助手”、英文“Daily Assistant”（`packages/config` PRODUCT 统一配置，
  用户端/管理端/登录页/PWA manifest/元数据一致；技术标识保持 daily-assistant）。
- 通知范围：V1 仅应用内提醒；提醒页文案明确“仅应用内查看”，不再展示浏览器推送状态；
  Web Push/系统通知列为 V1.1 候选（OPEN-005）。
- 仓库命名：品牌显示名与 `richangzhushou`/`daily-assistant` 技术标识分离（OPEN-011）。
- OPEN-009：`@playwright/test@1.62.1`、`playwright.config.ts`、`tests/e2e`（认证/管理端/首页业务/删除）、
  `scripts/start-e2e-services.mjs`（专用测试库、自动 generate/build/migrate/bootstrap/启动三服务）、
  根命令 `test:e2e`/`test:e2e:smoke`/`test:e2e:headed`/`test:e2e:matrix`；
  CI 新增独立 `browser-qa` job（MySQL 8.4、Chromium、失败产物上传）。
- 稳定性：web 客户端 401 自动单飞刷新重试（`api/session.ts`/`api/client.ts`/`stores/auth.ts`/`offline/sync.ts`）；
  登录限流上限可通过 `LOGIN_RATE_LIMIT_MAX` 配置（测试环境放大）。
- 验证：本地 smoke 20/20、完整矩阵 70/70（Chromium 桌面/移动、Firefox、WebKit、1440/375/430）。

## 2026-08-07 — OPEN-007 合并到 main（PR #1）
- PR #1（feat: implement expired account deletion cleanup）以 squash 方式合并到 main，
  merge commit `6d9c888`；任务分支 `codex/open-007-deletion-cleanup` 已删除。
- 合并后本地 `npm run quality` PASS；main 远程 CI run `31136793516` PASS
  （quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 账户删除调度器默认关闭（`ACCOUNT_DELETION_SCHEDULER_ENABLED=false`），
  staging 单实例验证前不得开启；staging 未创建、生产未部署。
- 合并后状态文档同步见 `codex/post-open-007-merge-status` 分支（PR 待用户确认）。

## 2026-08-06 — OPEN-007 账户期满删除清理实现完成
- 数据模型：`UserStatus` 新增 `DELETION_PROCESSING`；`users` 新增删除调度/开始/完成/
  尝试次数/失败原因/租约过期六列；migration `20260806092920_open007_account_deletion_cleanup`。
- 申请删除写入计划删除时间（默认 30 天可配置）；后台任务原子领取并清理全部业务行与
  附件文件，成功后写匿名墓碑（随机用户名、空显示名、随机密码散列、`DELETED`）。
- 失败不标记 `DELETED`，租约过期后可重试，达到最大尝试次数后保留可诊断状态；
  `AccountDeletionScheduler` 由 `ACCOUNT_DELETION_SCHEDULER_ENABLED` 控制，
  手工执行 `npm run account-deletion:run`。
- 管理员可取消 `DELETION_PENDING` 删除申请（容量复查 + `USER_DELETE_CANCEL` 审计）；
  契约/OpenAPI/管理端同步。
- 测试：API 111/111、空库 8 migrations、CLI 演练通过；`docs/27` 发布清单过期内容已修正。

## 2026-08-06 — 正式 main 分支建立与推送完成
- 确认 `codex/wp8-release-prep` 完整包含 `codex/wp1-foundation`（`rev-list --left-right --count` = `0 42`）。
- 从 `codex/wp8-release-prep` @ `42bcef0` 建立并推送正式 `main`；main = origin/main = origin/codex/wp8-release-prep = `42bcef0`。
- main CI run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 无 force push、无额外 merge commit、旧分支未改动；GitHub 默认分支随后已由用户切换为 main（`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留）；暂不执行 staging/生产部署。

## 2026-08-06 — 发布准备第一阶段完成（推送 + 远端 CI 验证）
- 推送 `codex/wp8-release-prep`（首推 `71b9f74`）；首轮 CI run `31084434078` 失败：纯净环境缺 Prisma
  生成客户端与 api-contracts dist（typecheck TS2307/TS2339）。
- 修复 `.github/workflows/ci.yml`（quality 前 `prisma:generate` + contracts `build`），提交 `3e88808`
  并推送；run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
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
- 账号密码登录（管理员创建、首登强制改密、管理员重置密码），邮箱/邀请码/截图 OCR 下线；
  `npm run quality`、空库 7 migrations+seed、API 92/92、契约 125/125、浏览器验证与
  重启持久化全部通过；已提交 `71b9f74` 并随 wp8/main 推送；未部署。

## 2026-08-06 — 本机启动与访问验证完成（本地运行）
- API/Web/Admin 在本机运行并验证：健康检查 200、浏览器登录、待办/记账读写、API 重启后数据持久化均通过；本地库 `daily_assistant_local`；`.env` 已备份；未提交、未推送、未部署。

## 2026-08-06 — 输出 WP8 可执行规划（docs/25）

- 新增 `docs/25-wp8-codex-execution-plan.md`：全量质量与发布准备的可执行规划
  （安全/上传复审、可访问性、全量验证、备份恢复与删除演练、staging 发布清单）。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP8 全量质量与发布准备本地验收通过（docs/26/27）

- 契约/一致性：审计枚举补全 `DRAFT_BATCH_DISCARD`；数据字典补 `RecoveryCode`；端点清单补 `DELETE /me/sessions`；OpenAPI 72 路径与控制器一致，契约测试 132/132。
- 安全：生产强制 `CONFIRMATION_TOKEN_SECRET`；用户自助关号/申请删除/恢复码重开补写脱敏审计；`.env.example` 补齐适配器与调度变量。
- 上传：新增 JPEG/PNG/WEBP 魔数校验；超大上传流改为 resume；wp4 测试适配并新增不匹配用例；扫描门控与悬空清理缺口如实记录。
- 可访问性/响应式：键盘路径、焦点、语义标签、role=alert、文字+图标状态、触控目标；375/390/430/768/1440 + 200% 缩放矩阵全部无横向溢出。
- 回归：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器主流程与离线排队→恢复→单条落库通过。
- 演练：备份恢复（mysqldump→隔离库→24 表一致）；账号删除（DELETION_PENDING、会话撤销、容量释放、脱敏审计；期满清理未实现，缺口记录）。
- 发布准备：staging 发布清单、监控告警清单、隐私/试用门禁（docs/27）；OPEN-001~011 全部记录，未宣称生产可用。
- 分支 `codex/wp8-release-prep`；本地提交；未推送、未部署、未创建生产资源。

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

- 新增 `docs/23-wp7-codex-execution-plan.md`：PWA 安装、本地缓存、离线写入队列、
  同步游标、幂等批处理、冲突页面与账号退出清理的可执行规划。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP6 行程本地验收通过

- 契约：Trips/TripItems/PackingItems OpenAPI、`TripItemType` 枚举、
  `TripExpenseSummary`、`TripDetailResponse`、`TripItemOutOfRangeWarning` 与
  `Transaction.tripId`；契约测试 127/127。
- 数据：`trips`/`trip_items`/`packing_items` 与 `transactions.trip_id`；
  migration `20260806011520_wp6_trips` 空库部署与 seed 通过。
- 后端：行程/节点/行李 CRUD、超范围节点确认、服务端费用汇总、日历入口与
  交易关联；集成测试 55/55（WP2–WP6）。
- 前端：行程列表/详情/节点/行李/关联账单/日历跳转/记账行程选择/首页入口。
- 验收：`npm run quality`、浏览器矩阵 10/10 无横向溢出，主流程与控制台仅预期
  400 校验日志（见 `docs/22-wp6-acceptance-report.md`）。
- 分支 `codex/wp6-trips`；未推送、未部署、未创建生产资源、未进入 WP7。

## 2026-08-06 — 输出 WP6 可执行规划（docs/21）

- 新增 `docs/21-wp6-codex-execution-plan.md`：行程、节点、行李清单、账单关联、
  预算与实际支出、日程关联入口的可执行规划。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-05 — WP5 日程、待办与提醒本地验收通过

- 契约：Calendar/Tasks/Reminders OpenAPI、共享类型与枚举；契约测试 118/118。
- 数据：`calendar_events`/`tasks`/`reminders` 与 migration
  `20260805095154_wp5_calendar_tasks_reminders`；seed 演示数据。
- 后端：日程/待办/提醒 CRUD、状态机、重复展开、调度器与通知适配器。
- 前端：今日安排卡片、日程/待办/提醒页与通知权限降级。
- 验收：quality、空库 migration+seed、集成 48/48、浏览器矩阵 20/20；
  报告见 `docs/20-wp5-acceptance-report.md`。
- 未推送、未部署、未创建生产资源、未进入 WP6。

## 2026-08-05 — WP4 快捷指令、OCR 与统一录入本地验收通过

- 契约：Shortcuts/Drafts/Attachments OpenAPI、共享类型、`ShortcutScope` 与错误码
  （`7cb7656`）。
- 数据：`DeviceCredential`、`Attachment`、`DraftRecord` 与 WP4 migration
  （`4be9524`）。
- 后端：设备凭证生命周期、快捷指令幂等草稿、草稿中心、附件/OCR 适配器与集成
  测试（`4cd75e9`）。
- 前端：快捷记录、草稿中心、快捷指令配置页与错误降级状态。
- 验收：quality、空库 migration+seed、集成 41/41、浏览器矩阵 25/25；
  报告见 `docs/18-wp4-acceptance-report.md`。
- 未推送、未部署、未创建生产资源、未进入 WP5。
- 修复：附件非法类型错误码由服务层返回 `ATTACHMENT_TYPE_NOT_ALLOWED`
  （`c1cfc33`）。

## 2026-08-05 — 持久化项目状态恢复机制（v2）

- `AGENTS.md` 合并为 Project State Recovery / Required Workflow Before Every Task / Task Completion State Updates / Safety Rules 四章。
- 新增 `.project/session.md`、`.project/decisions.md` 与 `scripts/check-project-context.mjs`（`npm run check:context`，已并入 quality）；提供可选 `.githooks/pre-commit`。
- 更新 `.project/context.md`、README、docs/progress、docs/changelog 与根状态文件。
- 未修改业务代码；未推送。

## 2026-08-05 — WP3 基础记账与今日财务本地验收通过

- 契约先行：OpenAPI 3.1 补全 Finance 请求/响应/DTO/错误码（`DUPLICATE_RESOURCE`、`POSSIBLE_DUPLICATE` 警告），共享类型与契约测试同步（`c1c8f92`）。
- 数据：新增 `categories`、`financial_accounts`、`transactions`、`budgets` 与枚举 `CategoryKind`、`FinancialAccountKind`；migration `20260805080803_wp3_finance` 空库部署通过（`3fcf1df`）。
- 后端：账单 CRUD/软删除/恢复、退款校验、疑似重复提示、分类/账户归档、预算 CRUD 与自然月校验、统计/今日卡片、CSV 导出；用户内容路由增加 `UserOnlyGuard`（管理员 403）（`e7b971c`）。
- 前端：今日财务卡片、账单列表/表单、分类、账户、预算页面与 CSV 导出（`3fe6739`）。
- 修复：查询 DTO 编译元数据（控制器 `import type` → 运行时导入）与非 JSON 错误体处理（`3db5b40`）。
- 验收：`npm run quality`、空库 migration+seed、WP2+WP3 集成测试 29/29、浏览器 5 宽度矩阵 30/30 与主流程/错误状态全部通过（`docs/16-wp3-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源；WP4 未实现。

## 2026-08-05 — 跨任务自动恢复项目状态机制

- `AGENTS.md` 新增 Project State Recovery、Required workflow before every task、任务结束更新与任务优先级规则。
- `.project/context.md` 规范化为固定结构（含 Repository State、Current Task、Next Recommended Task、Handoff Instructions 等）。
- 同步更新 `docs/progress.md`、`docs/changelog.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`。
- 仅文档改动；保留未提交的 `apps/api/src/finance/finance.controller.ts` 修改；未推送。

## 2026-08-05 — WP2 真实验收复核通过（quality + 空库迁移 + 集成 + 浏览器矩阵）

- 在全新空库 MySQL 8.4.9 上重新执行 `prisma migrate deploy`、seed 与 `npm run test:integration`：18/18 通过。
- 复跑 `npm run quality`：格式、Lint、类型、单测、构建、Prisma、OpenAPI、migration diff、依赖审计全部通过。
- 复跑 Playwright 浏览器矩阵：用户端注册/登录/账号与管理端登录/概览/邀请码/用户/设置/审计在 375/390/430/768/1440 无横向溢出；控制台 0 error / 0 warning。
- 修正 OpenAPI info 中“WP1 未实现”的过时描述，同步为 WP2 已实现状态。
- 输出 WP3 可执行规划 `docs/15-wp3-codex-execution-plan.md`；未推送、未部署；WP3 未实现。

## 2026-08-05 — WP2 identity, capacity, and admin completed locally

- 在 `codex/wp2-identity-capacity` 完成 WP2：身份认证、邀请码、容量限制、账号生命周期和管理端。
- 契约先行：OpenAPI、共享类型、错误码与账号状态机先更新并通过契约测试。
- Prisma 增加 `SystemSetting`、`User`、`Session`、`RecoveryCode`、`InviteCode`、`InviteRedemption`、`AdminAudit` 与首个真实 migration。
- 密码 Argon2id；访问令牌仅存内存；刷新令牌 HttpOnly Cookie、数据库仅存哈希、支持轮换与单设备/全部撤销。
- 注册、恢复、关闭与容量设置变更锁定 SystemSetting 单例行；注册与邀请码兑换同事务；可重试冲突有上限。
- 管理端 API 要求原因并写入脱敏、不可由产品 API 删除的审计；管理员默认不能访问用户生活数据正文。
- 通过格式、Lint、类型、单元/契约/集成测试、构建、Prisma、OpenAPI、空库 migration 与依赖审计。
- 通过 `QA-CAP-001~006`、`QA-SEC-001~003` 与 375/390/430/768/1440 浏览器矩阵。
- 未推送、未部署、未创建生产资源；WP3 未实现。

## 2026-08-05 — WP1 branch pushed to origin

- 用户授权后推送 `codex/wp1-foundation`（提交 `518477e`）到 `https://github.com/Dada-sys101/richangzhushou.git`。
- GitHub Actions 首次运行结果待确认；未创建部署资源。
- 本机 Git 全局代理 7890 不可用，推送时临时使用系统代理 7897；未修改全局配置。

## 2026-08-05 — Project context and development handoff

- 完善 `AGENTS.md`：计划先行、范围控制、兼容性检查、验证、进度更新、独立提交与不确定标注。
- 新增 `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md` 与 `.project/context.md`。
- 更新 `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`docs/README.md`。
- 仅文档与上下文改动，未修改业务代码，未创建生产配置。

## 2026-08-04 — WP0 planning package started

- 创建独立项目规划目录 `D:\daily-assistant`。
- 固化已确认的 V1.0 产品边界、容量控制、云端同步和本地缓存方向。
- 新增根级计划、状态、任务、验收、架构和恢复文件。
- 未创建业务代码、Git 仓库、外部资源或部署环境。

## 2026-08-04 — WP0 planning package completed

- 完成产品范围、页面流程、业务规则、管理权限、数据模型、API、架构、安全、UI、测试、部署、风险和开发交接文档。
- 将 V1.0 拆分为 WP1–WP8，并提供第一批可直接创建的工程任务。
- 检查账号状态、人数计算、邀请注册、金额、同步、权限、枚举、版本范围和验收项的一致性。
- 保留产品名称、远端仓库、供应商、部署地域和数据保留政策为明确未决项。

## 2026-08-05 — WP1 engineering foundation completed locally

- 创建 npm workspaces、Vue PWA 用户端、Vue Element Plus 管理端和 NestJS 单体 API 空壳。
- 创建共享配置与 API 契约包，对齐数据字典枚举、字符串 ID、ISO 8601 时间和定点金额边界。
- 将规划端点转换为 OpenAPI 3.1 基线，并建立 101 项端点/枚举契约断言。
- 创建 Prisma 7 + MySQL schema 基线、安全环境变量示例、本地开发说明和 CI。
- 通过格式、Lint、类型、106 项单元/契约/HTTP 冒烟测试、全部 workspace 构建、Prisma/OpenAPI、离线 migration diff 和依赖审计。
- 在用户端和管理端完成 375/390/430/768/1440 检查；用户端额外验证 404、浏览器 Back、控制台和离线刷新。
- 本机缺少 MySQL/Docker，真实空库 migration deploy 记录为环境阻塞；未推送、未部署、未进入 WP2。
