# Project Status

版本：1.0<br>
状态：WP8 本地验收完成（WP1–WP8 均已通过本地验收）<br>
更新：2026-08-06

## 当前状态

- 项目：Daily Assistant（临时名称）
- 位置：`D:\daily-assistant`
- 当前工作包：WP8 已完成本地验收（分支 `codex/wp8-release-prep`，未推送）
- 代码：WP2 身份/容量/邀请码/管理端已实现；WP3 记账已实现；WP4 快捷指令/草稿/OCR 已实现；WP5 日程/待办/提醒已实现；WP6 行程/节点/行李/账单关联/费用汇总已实现；WP7 PWA/IndexedDB 离线缓存/同步队列/冲突页已实现；WP8 安全/上传/可访问性/全量回归/发布准备已完成（详见 `docs/26`、`docs/27`）
- Git 仓库：独立仓库，当前分支 `codex/wp8-release-prep`（未推送）
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
- WP6：Trips/TripItems/PackingItems 契约与 `TripItemType` 枚举、三张新表与 `transactions.trip_id`、行程/节点/行李 CRUD、超范围节点确认、服务端费用汇总、行程详情日历入口、关联账单与前端页面（见 `docs/22-wp6-acceptance-report.md`）。
- WP7：Sync 变更流/幂等 mutations/状态契约与错误码、`sync_mutations` 表与游标索引、后端变更流与版本冲突、IndexedDB 离线队列/同步器/SyncBadge/冲突页/离线会话/退出清理（见 `docs/24-wp7-acceptance-report.md`）。

## 下一步

- 确认 WP1–WP6 远端 CI 结果（需推送授权）。
- WP8 全量质量与发布准备（未开始；可执行规划见 `docs/25-wp8-codex-execution-plan.md`）。

## 阻塞项

- WP2 使用便携 MySQL 8.4 完成本地真实空库 migration 与集成测试；该 MySQL 位于仓库外，不随仓库分发。
- 当前分支未推送，远端 CI 结果待确认；`gh` 未登录，无法通过命令行查询。
- 发布前需确认部署地域、域名、邮件/OCR/AI/对象存储服务及合规要求。
