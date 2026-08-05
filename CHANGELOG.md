# Changelog

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
