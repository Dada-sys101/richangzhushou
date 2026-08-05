# 变更日志（Changelog）

文档版本：1.0
更新：2026-08-05
说明：根目录 `CHANGELOG.md` 与本文件保持同步；本文件是后续模型接手的标准变更入口。

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
