# 变更日志（Changelog）

文档版本：1.0
更新：2026-08-05
说明：根目录 `CHANGELOG.md` 与本文件保持同步；本文件是后续模型接手的标准变更入口。

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
