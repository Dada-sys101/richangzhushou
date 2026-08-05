# 实时项目上下文（Project Context）

更新时间：2026-08-05
维护规则：每次会话开始与结束时更新本文件；本文是后续模型恢复项目状态时优先读取的文件。

## 项目当前状态

- 项目：Daily Assistant（临时名称，正式产品名待确认）。
- 阶段：WP0/WP1 已完成；WP2 本地验收完成；WP3–WP8 未开始且未获授权。
- 本轮任务：WP2 身份认证、邀请码、容量限制、账号生命周期与管理端（已完成本地实现与验收）。

## 当前分支

- `codex/wp2-identity-capacity`（未推送；`main` 保留 WP0 规划基线，`codex/wp1-foundation` 已推送）。

## 最近一次有效提交

- 截至本文撰写：WP2 分支本地提交待创建；最新提交以 `git log -1 --oneline` 为准。

## 最近修改的模块

- 本轮：`apps/api`（auth/account/admin/capacity/audit/mail/prisma）、`apps/web`、`apps/admin`、`packages/api-contracts`、CI、文档与状态文件。

## 当前运行情况

- 验收时曾启动 API（127.0.0.1:3000）、用户端（localhost:5173）、管理端（localhost:5174）与便携 MySQL 8.4（127.0.0.1:3307）。
- `prisma migrate deploy` 已在便携 MySQL 8.4 真实空库执行通过。
- 最近一次 `npm run quality` 通过；WP2 集成测试在 `TEST_DATABASE_URL` 下通过。

## 当前部署状态

- 无任何部署，未创建云资源。
- `codex/wp1-foundation` 已推送（提交 `518477e`）；`codex/wp2-identity-capacity` 未推送。
- GitHub Actions 首次运行与 WP2 CI 结果待确认（本机 `gh` 未登录，无法查询）。
- origin 为 `https://github.com/Dada-sys101/richangzhushou.git`。

## 已完成任务

- WP0：产品、规则、数据、API、架构、测试、部署与交接文档（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 基线、CI、本地质量门与浏览器矩阵（提交 `6169ac0`，详见 `docs/13-wp1-acceptance-report.md`）。
- WP2：契约、migration、身份与会话、容量与邀请码、账号生命周期、管理端与审计、前端页面与验收（详见 `docs/14-wp2-acceptance-report.md`）。

## 正在进行的任务

- 等待：WP2 分支本地提交确认与远端 CI 结果；WP3 开工授权。

## 下一步建议任务

1. 检查 `codex/wp2-identity-capacity` 本地提交与 `git diff --check`。
2. 如需远端验证，推送前需另行授权；CI 已加入 WP2 集成测试步骤。
3. 确认 OPEN-008（邮箱验证策略）后再决定公开试用注册流程。

## 当前阻塞问题

- 远端 CI 运行结果未确认（当前分支未推送，本机 `gh` 未登录）。
- 便携 MySQL 位于仓库外，其他机器需要自行准备 MySQL 8.x 才能复跑集成测试。
- 邮件供应商未确定，当前使用内存 MailAdapter（OPEN-003）。
- 产品名、供应商、部署地域、保留期、邮件验证策略等未决（`docs/decisions.md` OPEN-001~008）。

## 重要注意事项

- 遵循 `AGENTS.md`：不擅自改架构、不删功能、不碰无关文件、不动 `D:\codex-worker` 的开封旅游助手仓库。
- 涉及数据库/API/部署的变更必须先检查数据字典、OpenAPI、migration 与回滚、环境变量、CORS/安全配置兼容性。
- 跨工作区变更必须通过 `npm run quality` 与 `git diff --check`；任务完成后更新进度文档并独立提交。
- 真实凭据（密码、Token、API Key、私钥、生产数据库 URL）严禁写入仓库或文档。
- 未实现的功能不得写成已完成；无法确认的信息必须标注“待确认/未发现实现/文档与代码不一致”。
- 本机 Git 全局代理 `127.0.0.1:7890` 当前不可用；系统代理 `127.0.0.1:7897` 可用。远程 Git 操作可临时加 `-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`；未修改全局配置。

## 后续模型接手时的阅读顺序

1. `.project/context.md`（本文件）
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`
5. 当前工作包定义：`docs/12-development-handoff.md`
6. 实现代码与详细文档：`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/09-test-and-acceptance.md`
