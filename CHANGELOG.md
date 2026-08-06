# Changelog

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
