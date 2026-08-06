# Project Status

版本：1.0<br>
状态：WP5 本地验收完成（WP1–WP5 均已通过本地验收）<br>
更新：2026-08-05

## 当前状态

- 项目：Daily Assistant（临时名称）
- 位置：`D:\daily-assistant`
- 当前工作包：WP5 已完成本地验收（分支 `codex/wp5-calendar-tasks`，未推送）
- 代码：WP2 身份/容量/邀请码/管理端已实现；WP3 记账 API 与页面已实现；WP4 设备凭证/快捷指令/草稿中心/附件 OCR 已实现；WP5 日程/待办/提醒 CRUD、调度器与前端页面已实现
- Git 仓库：独立仓库，当前分支 `codex/wp5-calendar-tasks`（未推送）
- 上下文：`.project/context.md` 与 `docs/` 接管文档已建立（见 `docs/README.md`）
- 自动恢复机制：`AGENTS.md` 增加 Project State Recovery / Required workflow，`.project/context.md` 已规范化为固定结构
- 持久化恢复机制 v2：`AGENTS.md` 四章规则、`.project/session.md`、`.project/decisions.md`、`npm run check:context`（并入 quality）与可选 Hook
- 部署：尚未创建
- 当前用户：本地验收数据（非生产）

## 已完成

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

## 下一步

- 确认 WP1–WP5 远端 CI 结果（需推送授权）。
- WP6 行程（未开始；可执行规划见 `docs/21-wp6-codex-execution-plan.md`）。

## 阻塞项

- WP2 使用便携 MySQL 8.4 完成本地真实空库 migration 与集成测试；该 MySQL 位于仓库外，不随仓库分发。
- 当前分支未推送，远端 CI 结果待确认；`gh` 未登录，无法通过命令行查询。
- 发布前需确认部署地域、域名、邮件/OCR/AI/对象存储服务及合规要求。
