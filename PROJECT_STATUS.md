# Project Status

版本：1.0<br>
状态：正式 `main` 已建立并推送；OPEN-007、V1 决策、OPEN-009 与 E2E 修复均已合并到 main（PR #1/#3/#4）；OPEN-006 对象存储接入代码已随 PR #6 squash 合并到 main（`db5c5d3`，main CI 全绿），真实云资源与 staging 待授权；未部署<br>
更新：2026-08-07

## 当前状态

- 项目：Daily Assistant（临时名称）
- 位置：`D:\daily-assistant`
- 当前工作包：WP8 已完成本地验收；正式 `main` 已建立并推送（= `codex/wp8-release-prep` @ `42bcef0`，远端 CI 通过）
- OPEN-007：账户期满删除清理已实现并通过 PR #1 合并到 main（保留期 30 天可配置、后台清理、
  附件删除、取消删除、匿名墓碑；调度器默认关闭，staging 单实例验证后再开启）
- V1 决策：正式产品名“日常助手 / Daily Assistant”（OPEN-001）；V1 仅应用内提醒（OPEN-005）；
  品牌显示名与仓库/技术标识分离（OPEN-011）
- OPEN-009：Playwright 浏览器 QA 自动化（smoke + 完整矩阵 + CI browser-qa + 失败产物）
- OPEN-006 代码任务：`AliyunOssStorageAdapter`（ali-oss 6.23.0）+ `STORAGE_PROVIDER=local|oss`
  切换与必填校验 + `StorageKeyService`（新键 `users/{userId}/attachments/{fileId}`，旧键兼容）+
  `deploy/staging/.env.staging.example`；生产禁止 local 作为 staging 门禁；未创建真实 Bucket/RAM
- 合并进度：PR #3（V1 决策 + OPEN-009）已合并（`4fcc613`）；PR #4（E2E 24 小时制修复）已合并
  （`47c40c9`）；main CI run `31144549537` quality/browser-qa 均 SUCCESS
- 首页界面优化：已完成本地验收（今日概览/友好认证状态/精简导航/移动端底部导航/
  本月财务/空状态/同步状态；仅前端，`docs/29`；已提交 `68f3987` 并随 wp8/main 推送，未部署）
- 代码：WP2 身份/容量/邀请码/管理端已实现；WP3 记账已实现；WP4 快捷指令/草稿/OCR 已实现；WP5 日程/待办/提醒已实现；WP6 行程/节点/行李/账单关联/费用汇总已实现；WP7 PWA/IndexedDB 离线缓存/同步队列/冲突页已实现；WP8 安全/上传/可访问性/全量回归/发布准备已完成（详见 `docs/26`、`docs/27`）
- Git 仓库：独立仓库，当前分支 `main`（已推送；origin 已有 `main`、`codex/wp8-release-prep`、`codex/wp1-foundation`；GitHub 默认分支已切换为 `main`，旧分支暂时保留）
- 上下文：`.project/context.md` 与 `docs/` 接管文档已建立（见 `docs/README.md`）
- 自动恢复机制：`AGENTS.md` 增加 Project State Recovery / Required workflow，`.project/context.md` 已规范化为固定结构
- 持久化恢复机制 v2：`AGENTS.md` 四章规则、`.project/session.md`、`.project/decisions.md`、`npm run check:context`（并入 quality）与可选 Hook
- 部署：尚未创建
- 当前用户：本地验收数据（非生产）
- 本地运行：本机已启动 API/Web/Admin（3000/5173/5174）并通过登录、核心数据读写与重启持久化验证（2026-08-06）
- WP9：身份与录入简化本地验收完成（账号密码登录、管理员建号/重置、首登强制改密、
  邮箱/邀请码/截图 OCR 下线；`npm run quality` 通过，已提交 `71b9f74` 并随 wp8/main 推送，未部署）

## 已完成

- OPEN-006 对象存储接入代码：OSS 适配器、配置切换、键服务、22 项新增单元测试与环境示例
  （已随 PR #6 squash 合并到 main，merge commit `db5c5d3`；main CI quality/browser-qa 通过）。
- PR #4 合并：E2E 时间助手 24 小时制修复进入 main（`47c40c9`），main browser-qa 恢复 SUCCESS。
- PR #3 合并：V1 决策与 OPEN-009 进入 main（`4fcc613`），任务分支已删除。
- V1 发布决策固化：产品名统一配置（`packages/config` PRODUCT）、提醒页应用内文案、决策记录同步。
- OPEN-009：`@playwright/test` 1.62.1；`playwright.config.ts`；`tests/e2e`（auth/admin/home/deletion）；
  `scripts/start-e2e-services.mjs`；根命令 `test:e2e`/`test:e2e:smoke`/`test:e2e:headed`/`test:e2e:matrix`；
  本地 smoke 20/20、完整矩阵 70/70；web 客户端 401 单飞刷新重试。
- OPEN-007 合并：PR #1 squash 合并到 main（merge commit `6d9c888`），任务分支已删除；
  main 远程 CI run `31136793516` PASS。
- OPEN-007：`DELETION_PROCESSING` 状态与删除调度/租约字段；原子领取与失败重试；
  全部业务数据与附件真实清理；匿名墓碑；管理员取消删除；契约/OpenAPI/管理端/文档同步；
  API 测试 111/111、空库 8 migrations、CLI 演练通过。
- 发布准备第二阶段：确认 wp8 完整包含 wp1（`rev-list --left-right --count` = `0 42`）后，从 `codex/wp8-release-prep` @ `42bcef0` 建立并推送正式 `main`；main CI run `31086031458` PASS；无 force push、无额外 merge commit、旧分支未改动。
- GitHub 默认分支切换为 `main`（用户网页操作完成，2026-08-06）；`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留。
- 首页界面优化：用户端首页现代重构（见 `docs/29`），`npm run quality` 全绿、
  用户端测试 15/15、浏览器 375–1440 无横向溢出。
- 发布准备第一阶段：推送 `codex/wp8-release-prep`（`71b9f74`）；修复 CI 纯净环境缺生成产物问题
  （`.github/workflows/ci.yml` 前置 `prisma generate` + contracts `build`，`3e88808`）；远端
  GitHub Actions run `31084755305` PASS（quality、空库 migration、WP2 集成测试）。
- 产品定位与早期用户规模确认。
- 用户容量、邀请码和账号关闭释放名额规则确认。
- iPhone PWA + 电脑网页、云端同步 + 本地缓存方向确认。
- V1.0 主功能范围和实现优先级确认。
- 产品、流程、规则、权限、数据、API、架构、安全、测试、部署和开发交接文档初稿。
- 跨文档账号状态、容量计算、版本边界、技术栈和验收编号一致性检查。
- npm workspaces 与 `apps/web`、`apps/admin`、`apps/api` 工程骨架。
- `packages/api-contracts`、`packages/config`、共享枚举与 OpenAPI 3.1 端点基线。
- Prisma 7 + MySQL schema 基线、安全 `.env.example`、本地开发说明和 GitHub Actions CI。
- 格式、Lint、类型、单元/契约测试、全部 workspace 构建、Prisma validate、OpenAPI lint、离线 migration diff、依赖审计和浏览器矩阵检查。
- 项目上下文与开发交接文档体系：`AGENTS.md` 完善、`docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`、`.project/context.md`。
- WP2：OpenAPI/共享契约、Prisma migration、Argon2id 密码、刷新令牌轮换 Cookie、容量事务、邀请码、账号状态、管理端 API 与页面、脱敏审计。
- WP2 验收：`QA-CAP-001~006`、`QA-SEC-001~003`、并发最后名额、刷新轮换/撤销、密码重置非枚举/限流、浏览器 5 宽度矩阵全部通过（见 `docs/14-wp2-acceptance-report.md`）。
- WP3：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API、用户端记账页面与验收（见 `docs/16-wp3-acceptance-report.md`）。
- WP4：Shortcuts/Drafts/Attachments 契约与错误码、DeviceCredential/Attachment/DraftRecord migration、设备凭证生命周期与 Bearer 守卫、快捷指令幂等草稿、草稿中心（解析/OCR/确认/丢弃/批量二次确认）、附件上传意图/完成/删除、本地适配器与假实现、用户端快捷记录/草稿中心/快捷指令配置页（见 `docs/18-wp4-acceptance-report.md`）。
- WP5：Calendar/Tasks/Reminders 契约与枚举、三张新表与 migration、日程/待办/提醒 CRUD 与状态机、重复展开与调度器（原子领取/防重/重试上限/SUPPRESSED）、通知适配器与前端页面（见 `docs/20-wp5-acceptance-report.md`）。
- WP6：Trips/TripItems/PackingItems 契约与 `TripItemType` 枚举、三张新表与 `transactions.trip_id`、行程/节点/行李 CRUD、超范围节点确认、服务端费用汇总、行程详情日历入口、关联账单与前端页面（见 `docs/22-wp6-acceptance-report.md`）。
- WP7：Sync 变更流/幂等 mutations/状态契约与错误码、`sync_mutations` 表与游标索引、后端变更流与版本冲突、IndexedDB 离线队列/同步器/SyncBadge/冲突页/离线会话/退出清理（见 `docs/24-wp7-acceptance-report.md`）。

## 下一步

- 完成状态文档 PR（`codex/post-pr6-merge-status`）合并确认（PR #6 合并已由用户授权完成）。
- 授权后创建私有 OSS Bucket 与最小权限 RAM 凭据，完成真实上传/下载/删除与备份上传验证。
- 按 `docs/27` 完成 staging 创建/部署决策（需用户授权）。
- 如需逐一验证，再推送 WP2–WP7 分支并检查远端 CI（需授权）。

## 阻塞项

- WP2 使用便携 MySQL 8.4 完成本地真实空库 migration 与集成测试；该 MySQL 位于仓库外，不随仓库分发。
- staging 未创建；部署域、产品名、供应商等未定（OPEN-001~008）。
- 发布前仍待确认：OPEN-006 真实对象存储资源与连通测试（OSS 适配器代码已完成；其余发布决策
  OPEN-001/005/009/011 已固化，main CI 全绿）。
