# Project Context

## Last Updated

2026-08-07 +08:00（V1 发布决策固化与 OPEN-009 浏览器 QA 自动化在 codex/v1-decisions-browser-qa 分支完成；本地 smoke 20/20、完整矩阵 70/70；提交与推送以 `git log`/PR 为准；未部署）

## Repository State

- Repository: `D:\daily-assistant`（独立 Git 仓库；origin: `https://github.com/Dada-sys101/richangzhushou.git`）
- Current Branch: `codex/v1-decisions-browser-qa`（V1 决策 + OPEN-009 任务分支，基于 main）
- HEAD Commit: 以 `git log` 为准（分支包含产品命名、通知范围、Playwright 自动化与文档同步）
- Working Tree Status: clean（忽略文件除外，如 `apps/api/.env`、`output/playwright/`，gitignored）
- Last Verified Commit: `6d9c888`；本地 `npm run quality` PASS；远端 main GitHub Actions run `31136793516` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）

## Project Summary

- 项目目标：面向 10–20 名受邀用户的个人日常助手（V1.0），覆盖记账、日程、待办、
  提醒、行程、Apple 快捷指令辅助记账、云端同步与本地离线。
- 当前技术栈：npm workspaces monorepo；Vue 3 + Vite PWA 用户端、Vue 3 + Element
  Plus 管理端、NestJS 单体 API、Prisma 7 + MySQL 8；OpenAPI 3.1 共享契约
  （`packages/api-contracts`）。
- 核心模块：auth/account/capacity/invites/admin/audit（WP2）、finance（WP3）、
  shortcuts/drafts/attachments/integrations（WP4）、calendar/tasks/reminders（WP5）、
  trips（WP6）。
- 当前部署方式：无任何部署；正式 `main` 已建立并推送，OPEN-007 已通过 PR #1 合并到 main
  （`6d9c888`，main CI 通过）；origin 已有分支 `codex/wp1-foundation`、`codex/wp8-release-prep`、`main`
  （GitHub 默认分支为 `main`；旧分支暂时保留）。

## Current Development Stage

- WP0（规划）至 WP8（全量质量与发布准备）均已完成本地验收（`docs/13`、`docs/14`、
  `docs/16`、`docs/18`、`docs/20`、`docs/22`、`docs/24`、`docs/26`）。
- WP9 身份与录入简化、首页界面优化（docs/29）已完成后端/前端本地验收。
- 无生产部署；正式 `main` 已建立并推送；OPEN-007 账户期满删除清理已实现并通过 PR #1 合并到 main
  （`6d9c888`）；V1 发布决策已固化、OPEN-009 浏览器 QA 自动化已完成本地验证；staging 未创建。

## Last Completed Task

- Task: V1 发布决策固化（OPEN-001 产品名、OPEN-005 仅应用内提醒、OPEN-011 命名分离）+ OPEN-009 Playwright 浏览器 QA 自动化。
- Completion Date: 2026-08-07（本地实现与验证完成；提交推送以 `git log`/PR 为准）
- Related Files: `packages/config`、`apps/web`（UI 文案、401 单飞刷新）、`apps/admin`、`playwright.config.ts`、`tests/e2e/*`、`scripts/start-e2e-services.mjs`、`apps/api/src/cli/e2e-prep.ts`、`.github/workflows/ci.yml`、`docs/27/26/decisions` 与状态文件
- Verification: 本地 smoke 20/20、完整矩阵 70/70；`npm run quality` 以最终跑批为准
- Related Commit: 以 `git log` 为准（分支 `codex/v1-decisions-browser-qa`）
- Task: OPEN-007 Pull Request #1 安全合并（squash）与合并后收尾。
- Completion Date: 2026-08-07
- Related Files: 无代码改动（合并 + 状态文档同步）
- Verification: PR #1 state=MERGED（merge commit `6d9c888`）；合并后本地 `npm run quality` PASS；main 远程 CI run `31136793516` PASS；工作树干净
- Related Commit: `6d9c888`（main = origin/main）
- Task: OPEN-007 账户期满删除清理实现（保留期/调度/附件删除/取消删除/匿名墓碑/重试上限），并同步修正 staging 发布清单。
- Completion Date: 2026-08-06（本地实现与验证完成；提交推送以 `git log` 为准）
- Related Files: `apps/api/src/account-deletion/*`、`apps/api/src/cli/account-deletion-run.ts`、`apps/api/src/{auth,admin,audit}`、`apps/api/prisma/schema.prisma`、migration `20260806092920_open007_account_deletion_cleanup`、`packages/api-contracts`、`apps/admin/src`、`apps/web/src/api/client.ts`、`docs/05/06/27/28/decisions` 与状态文件
- Verification: API 测试 111/111（新增 8 单元 + 11 OPEN-007 集成）；空库 8 migrations `prisma migrate deploy` 通过；CLI 演练 `claimed=1 completed=1`；`npm run quality` 以最终跑批为准
- Related Commit: 以 `git log` 为准（分支 `codex/open-007-deletion-cleanup`）
- Task: 发布准备第二阶段：建立并推送正式 `main` 分支（确认 `codex/wp8-release-prep` 完整包含 `codex/wp1-foundation` 后从 wp8 创建 main，`git push -u origin main`）。
- Completion Date: 2026-08-06
- Related Files: 无代码改动；Git 分支 `main`（本地与远端）
- Verification: `merge-base` = `981aafc8`，`rev-list --left-right --count origin/codex/wp1-foundation...origin/codex/wp8-release-prep` = `0 42`（wp8 完整包含 wp1）；main/origin/main/origin/codex/wp8-release-prep 均为 `42bcef0`；main 推送触发 run `31086031458` PASS；无 force push、无 merge commit、旧分支未改动、工作树干净；GitHub 默认分支已切换为 main（用户网页操作）
- Related Commit: `42bcef0`（main = origin/main = origin/codex/wp8-release-prep）
- Task: 发布准备第一阶段：推送当前代码并完成远程 CI 验证（`codex/wp8-release-prep`）。
- Completion Date: 2026-08-06
- Related Files: `.github/workflows/ci.yml`
- Verification: 首次 CI run `31084434078` 失败（纯净环境缺 Prisma 生成客户端与 api-contracts dist，typecheck 大量 TS2307/TS2339）；修复 workflow 在 quality 前执行 `prisma:generate` 与 contracts `build`；修复提交 `3e88808` 后 run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）；本地 `npm run quality` PASS
- Related Commit: `3e88808`（已推送 origin）
- Task: 首页界面优化（今日概览、友好认证状态、精简导航、移动端底部导航、本月财务摘要、
  今日安排说明、空状态、同步状态文案；仅前端，不改 API 契约）。
- Completion Date: 2026-08-06
- Related Files: `apps/web/src`（HomeView、App、router、stores、offline/sync、SyncBadge、styles、
  新增 AppIcon/SiteHeader/BottomNav/EmptyState 与 4 个测试文件）、`docs/29`
- Verification: `npm run quality` PASS；用户端测试 15/15；浏览器验证未登录/登录态、
  “更多”菜单、底部导航、375–1440 无横向溢出；控制台仅预期 401
- Related Commit: `68f3987`（已随 `codex/wp8-release-prep`/`main` 推送）
- Task: WP9 身份与录入简化（账号密码登录、管理员建号、首登强制改密、管理员重置密码、邮箱/邀请码/截图 OCR 下线，一次性改完）。
- Completion Date: 2026-08-06
- Related Files: `packages/api-contracts`、`apps/api/prisma`、`apps/api/src/{auth,admin,account,capacity,attachments,drafts,integrations}`、`apps/web/src`、`apps/admin/src`、`docs/05/06/07/09/10/11/12/26/27/28`
- Verification: `npm run quality` PASS；空库 7 migrations+seed；API 测试 92/92；契约 125/125；浏览器验证登录/强制改密/管理端建号与控制台 0 错误；重启持久化 PASS
- Related Commit: `71b9f74`（已随 `codex/wp8-release-prep`/`main` 推送）
- Task: 本机启动 Daily Assistant V1.0 并访问验证（API/Web/Admin + 本地 MySQL + 演示账号登录 + 待办/记账读写 + API 重启持久化）。
- Completion Date: 2026-08-06
- Related Files: `apps/api/.env`（本地修改，已备份为 `apps/api/.env.bak-20260806`）；本地库 `daily_assistant_local`；`docs/26`、`docs/27` 已核对
- Verification: 健康检查 200；Web 5173 / Admin 5174 可访问；浏览器登录演示账号进入首页；控制台无阻塞错误（登录前 refresh 401 为预期）；创建并读取待办与记账记录；API 重启后数据仍存在
- Related Commit: 未提交（本地运行验证，状态文档更新待用户授权提交）

- Task: 执行 WP8 全量质量与发布准备（契约/安全/上传复查、可访问性与响应式、全量回归、
  备份恢复与账号删除演练、staging 发布清单）。
- Completion Date: 2026-08-06
- Related Files: `packages/api-contracts/src/enums.ts`、`apps/api/src/{auth,account,common,attachments}`、
  `apps/api/src/integration/{wp2,wp4}.integration.test.ts`、`docs/05/06/25/26/27` 等
- Verification: `npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器矩阵 174/174、
  备份恢复 24/24 表一致、离线排队→恢复→单条落库通过
- Related Commit: 以 `git log` 为准（`codex/wp8-release-prep` 分支）

## Current Task

None（V1 决策与 OPEN-009 本地完成，待提交推送与 PR；OPEN-007 已合并到 main；未执行 staging/生产部署）。

## Next Recommended Task

- Task: 发布准备第三阶段：按 `docs/27` 完成 staging 创建/部署决策（需用户授权；OPEN-007 已实现）。
- Priority: P0（前置动作）
- Reason: WP8 分支远端 CI 已验证通过；staging 是发布清单的下一前置动作。
- Dependencies: 用户授权创建/部署 staging（默认分支已切换为 main，无需再操作）。
- Acceptance Criteria: staging 环境按 `docs/27` 创建并验证；后续以 main 为正式主分支。

下一开发任务：按 `docs/27` 完成 staging 决策（需用户授权）；OPEN-007 已实现，
staging 开启删除调度器并单实例验证前，不得宣称生产环境“数据已删除”。

## Completed Work

- V1 决策固化：`packages/config` 统一 PRODUCT（日常助手 / Daily Assistant）；提醒页仅应用内文案；
  docs/27 与 decisions 记录 OPEN-001/005/011 已决策。
- OPEN-009：Playwright 1.62.1、`tests/e2e` 10 用例、`scripts/start-e2e-services.mjs`、
  根命令 test:e2e 系列、CI `browser-qa` job；web 客户端 401 单飞刷新重试；
  本地 smoke 20/20、完整矩阵 70/70。
- OPEN-007 合并：PR #1 以 squash 方式合并到 main（`6d9c888`），任务分支已删除；
  合并后本地 quality 与 main 远程 CI（run `31136793516`）均通过。
- OPEN-007：`UserStatus` 新增 `DELETION_PROCESSING`，`users` 新增删除调度/开始/完成/
  尝试次数/失败原因/租约字段；申请删除写入计划时间；后台任务原子领取批量清理全部业务行
  与附件文件，失败可重试、达到上限可诊断，成功后写匿名墓碑；管理员可取消保留期内删除
  （容量复查 + 审计）；契约/OpenAPI/管理端/文档同步；API 测试 111/111、空库 8 migrations、
  CLI 演练通过。
- 发布准备第二阶段：建立并推送正式 `main` 分支（从 `codex/wp8-release-prep` @ `42bcef0` 创建，push -u origin main）；main CI run `31086031458` PASS；未强推、未改旧分支；GitHub 默认分支已切换为 main（用户网页操作）。
- 发布准备第一阶段：推送 `codex/wp8-release-prep`（`71b9f74` 首推、`3e88808` CI 修复后推送）；修复 CI 纯净环境缺生成产物问题（workflow 前置 `prisma generate` + contracts `build`）；远端 GitHub Actions run `31084755305` PASS（quality + 空库 migration + WP2 集成测试）。
- 首页界面优化：今日概览标题与日期副标题、未登录/登录失效/请求失败友好状态、
  顶部导航精简为首页/日程/待办/财务/行程/更多、移动端底部导航、快捷操作 4 项带图标、
  本月财务摘要、今日安排说明与入口、空状态、同步状态文案与重试、1280px 浅灰蓝设计体系
  （`docs/29`；提交 `68f3987`，已随 wp8/main 推送）。
- WP0：规划文档体系（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 枚举基线、CI、本地质量门
  （提交 `6169ac0`；`docs/13`）。
- WP2：身份/会话/容量/邀请码/账号生命周期/管理端/审计/前端页面；空库 migration、
  18/18 集成测试、浏览器矩阵（`docs/14`）。
- WP3：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API
  与用户端记账页面（`docs/16`）。
- WP4：Shortcuts/Drafts/Attachments 契约、DeviceCredential/Attachment/DraftRecord
  migration、设备凭证生命周期、快捷指令幂等草稿、草稿中心、附件/OCR 适配器与
  用户端页面（`docs/18`）。
- WP5：Calendar/Tasks/Reminders 契约与枚举、三张新表与 migration、日程/待办/
  提醒 CRUD 与状态机、重复展开与调度器、通知适配器、今日安排卡片与三个新页面
  （`docs/20`）。
- WP6：Trips/TripItems/PackingItems 契约与 `TripItemType` 枚举、三张新表与
  `transactions.trip_id`、行程/节点/行李 CRUD、超范围节点确认、服务端费用汇总、
  行程详情日历入口、关联账单与前端页面（`docs/22`）。
- WP7：Sync 变更流/幂等 mutations/状态契约与错误码、`sync_mutations` 表与游标索引、
  后端变更流与版本冲突、IndexedDB 离线队列/同步器/SyncBadge/冲突页/离线会话/
  退出清理（`docs/24`）。
- WP8：契约/安全/上传复查与修复（审计枚举、用户自助审计、确认令牌密钥、上传魔数校验、
  文档一致性）、可访问性与响应式矩阵、全量回归、备份恢复与账号删除演练、staging 发布清单
  （`docs/26`、`docs/27`）。
- 机制 v1：跨任务自动恢复项目状态（`1aab5ec`）。
- 机制 v2：session/decisions/check:context 脚本与可选 pre-commit Hook。

## Remaining Work

- In Progress: None。
- 待用户授权推送：WP2–WP7 分支尚未推送；如需远端 CI 逐一验证需另行授权。
- Partially Completed: 浏览器 QA 一键脚本化（OPEN-009）。
- Not Started: staging 创建/部署（需授权）。
- Needs Verification: 真实 OCR/对象存储/通知供应商业效（OPEN-004/005/006）。

## Blockers

- staging 未创建；部署域、产品名等未定（OPEN-001~008）。
- 便携 MySQL 8.4 位于仓库外，其他机器复跑集成测试需自备 MySQL 8.x。
- 邮件/通知/OCR/AI/对象存储供应商未确定（OPEN-003/004/005/006），当前使用本地
  适配器与假实现。
- 发布决策未确认项：OPEN-006 部署地域与对象存储（其余 OPEN-001/005/009/011 已决策，详见 `docs/27`）。

## Known Issues

| 问题 | 影响 | 相关模块 | 当前状态 |
| --- | --- | --- | --- |
| 浏览器 QA 未固化为仓库内一键脚本 | 复现依赖 `playwright-cli` 与本地服务 | web/admin/CI | OPEN-009 |
| origin 仓库名 `richangzhushou` 与产品名不一致 | 品牌/仓库命名 | 仓库 | OPEN-002 |
| CI 纯净环境 typecheck 失败（缺 Prisma 生成客户端与 contracts dist） | 首次远端 CI 失败 | CI/Prisma/api-contracts | 已修复（`3e88808`，run `31084755305` PASS） |
| WP3 边界：整体预算 NULL 唯一性服务层校验；原账单软删后退款仍计入统计；统计仅 CNY；CSV 上限 10,000 行 | V1 规模可接受 | finance | `docs/16` |
| OCR/AI 与对象存储供应商未定；当前使用假实现与本地临时存储 | 真实识别/上传能力未验收 | integrations | OPEN-004/006 |
| 通知通道未定；当前为应用内 + 假适配器；调度器按单进程周期扫描 | 真实推送未验收；多实例部署前需租约 | reminders/integrations | OPEN-005；`docs/20` |
| 账号删除期满清理 | OPEN-007 已实现并合并到 main（PR #1，`6d9c888`）；调度器默认关闭，staging 单实例验证后再开启 | auth/account-deletion | 已实现（OPEN-007） |
| 本机 Git 全局代理 7890 不可用、7897 可用 | 远程 Git 操作需临时覆盖 | 本机环境 | 未修改全局配置 |

## Verification Status

- OPEN-009（本地）: PASS（smoke 20/20、完整矩阵 70/70）。
- main 远程 CI（`6d9c888`）: PASS（run `31136793516`；quality、空库 migrate deploy、WP2 集成测试全部通过）。
- OPEN-007（本地）: PASS（API 111/111、空库 8 migrations、CLI 演练；`npm run quality` 以最终跑批为准）。
- 远端 CI（`main` @ `42bcef0`）: PASS（run `31086031458`；quality、空库 migrate deploy、WP2 集成测试全部通过；main 推送触发）。
- 远端 CI（`codex/wp8-release-prep` @ `42bcef0`）: PASS（run `31085287317`；quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 首页界面优化: PASS（`npm run quality` 全绿；用户端 15/15；浏览器 375/390/430/768/1440
  无横向溢出，未登录/登录态、更多菜单、底部导航验证通过；记录于 `docs/29`）
- WP9（身份与录入简化）: PASS（quality、迁移、92/92 集成/单元、浏览器与重启持久化）
- Runtime Verification（本机运行）: PASS（3000/5173/5174 服务运行中；登录、核心数据读写、重启持久化均通过）
- Lint: PASS（WP8 验收时 `npm run quality`）
- Type Check: PASS
- Unit Tests: PASS（API 29/29 + 契约 132/132 + 前端 3/3，见 `docs/26`）
- Integration Tests: PASS（63/63，真实 MySQL 8.4；WP2–WP7）
- Build: PASS（全部 workspace）
- Runtime Verification: PASS（浏览器矩阵 174/174 含 200% 缩放、主流程与错误态、
  离线排队→恢复→单条落库、备份恢复 24/24 表一致、账号删除演练）
- Unverified Areas: WP2–WP7 分支远端 CI（未推送）；真实 OCR/对象存储/通知供应商业效

## Recent Changes

- 本次：V1 决策固化与 OPEN-009——产品名统一配置、仅应用内提醒、命名分离决策；
  Playwright smoke/matrix 与 CI browser-qa；web 401 单飞刷新；分支
  `codex/v1-decisions-browser-qa`。
- 本次：OPEN-007 PR #1 squash 合并到 main（`6d9c888`），任务分支已删除；main CI run
  `31136793516` PASS；随后创建状态同步分支 `codex/post-open-007-merge-status`（PR 待确认）。
- 本次：OPEN-007——账户期满删除清理实现（migration、原子领取调度、附件清理、匿名墓碑、
  取消删除、契约/OpenAPI/管理端同步、docs/27 修正、测试与 CLI），分支
  `codex/open-007-deletion-cleanup`。
- 本次：发布准备第二阶段——确认 wp8 完整包含 wp1（0/42）后，从 `codex/wp8-release-prep` @ `42bcef0` 创建并推送正式 `main`；main CI run `31086031458` PASS；未强推、未改旧分支；GitHub 默认分支已切换为 main（用户网页操作）。
- 本次：main 状态文档收尾——统一 9 个状态文档并提交推送（`docs: sync project status after main branch setup`，以 `git log` 为准）。
- 本次：发布准备第一阶段——推送 `codex/wp8-release-prep`（`71b9f74`）；首轮远端 CI 失败后最小修复 `.github/workflows/ci.yml`（quality 前生成 Prisma client 并构建 api-contracts），提交 `3e88808` 并推送；run `31084755305` PASS。
- `71b9f74` feat: WP9 身份与录入简化（docs/28）
- `68f3987` 首页优化（docs/29）
- 本次：首页界面优化（今日概览/友好认证状态/精简导航/移动端底部导航/本月财务/空状态/
  同步状态；`npm run quality` 通过；提交 `68f3987` 并已推送）
- 本次：WP9 身份与录入简化（账号密码登录、管理员建号/重置、首登强制改密、邮箱/邀请码/截图 OCR 下线；`npm run quality` 通过；提交 `71b9f74` 并已推送）
- 本次：本机启动与访问验证（API dev + Web + Admin；本地库 daily_assistant_local；`.env` 已备份；状态文档已更新未提交）
- `7cb7656` feat(contracts): WP4 shortcuts, drafts and attachments OpenAPI contracts
- `4be9524` feat(db): WP4 device credentials, drafts and attachments schema and migration
- `4cd75e9` feat(api): WP4 device credentials, shortcut drafts, draft center, and attachment OCR
- `c1cfc33` fix(api): return ATTACHMENT_TYPE_NOT_ALLOWED from service after DTO validation
- `4383adb` docs: WP6 行程执行规划与状态切换（docs/21）
- `d039efc` feat(contracts): WP6 trips, trip items and packing items OpenAPI contracts
- `c767ba5` feat(db): WP6 trips, trip items and packing items schema and migration
- `8f70868` feat(api): WP6 trips CRUD, expense summary, calendar link and transaction tripId
- `abbdeb7` feat(web): WP6 trips list, detail, itinerary, packing, calendar link and transaction trip select
- `6ed79da` feat(contracts): WP7 sync cursor, mutations and conflict contracts
- `3ddf4e7` feat(db): WP7 sync mutations table, idempotency keys and cursor indexes
- `c9fee8c` feat(api): WP7 sync change stream, idempotent mutations and conflict handling
- `479b0a9` feat(web): WP7 IndexedDB offline queue, sync engine, badge and conflict page
- `c7a4fa1` fix(web): WP7 reconnect token refresh, tombstone pull and logout cache cleanup
- 本次：WP8 验收与文档提交（`codex/wp8-release-prep` 分支，以 `git log` 为准）

## Important Constraints

- 遵循 `AGENTS.md`：任务前按 Project State Recovery / Required Workflow 恢复状态；
  用户当前任务优先；不自动执行多个 roadmap 任务；未经授权不 push、不部署、不改生产；
  保留未知未提交修改。
- 状态职责：`context.md` 长期项目状态；`session.md` 当前或暂停任务；`decisions.md`
  只记录可从代码/Git/文档确认的决策。
- 不擅改架构、不删功能、不碰无关文件、不动 `D:\codex-worker` 的开封旅游助手仓库。
- 数据库/API/部署变更必须先检查数据字典、OpenAPI、migration 与回滚、环境变量、
  CORS/安全配置兼容性。
- 跨工作区变更必须通过 `npm run quality` 与 `git diff --check`；项目状态文件一致性
  通过 `npm run check:context`。
- 真实凭据严禁写入仓库或文档；未验证功能不得写成已验证；未实现功能不得写成已完成。

## Handoff Instructions

Before starting any task:

1. Read AGENTS.md.
2. Read .project/context.md.
3. Read .project/session.md.
4. Read docs/progress.md and docs/roadmap.md.
5. Inspect the current Git branch, HEAD and working tree.
6. Inspect relevant recent commits.
7. Compare documentation with actual code.
8. Restore the current task, blockers and verification status.
9. Execute the current user request only after restoring project state.
10. Update project state files before ending the task.
