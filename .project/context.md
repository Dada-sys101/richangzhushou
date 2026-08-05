# 实时项目上下文（Project Context）

更新时间：2026-08-05
维护规则：每次会话开始与结束时更新本文件；本文是后续模型恢复项目状态时优先读取的文件。

## 项目当前状态

- 项目：Daily Assistant（临时名称，正式产品名待确认）。
- 阶段：WP0/WP1 已完成（WP1 为“本地完成”）；WP2–WP8 全部未开始且未获授权。
- 本轮任务：项目分析、文档补齐、进度固化（已完成，无业务代码改动）。

## 当前分支

- `codex/wp1-foundation`（唯一功能分支；`main` 保留 WP0 规划基线；无远程分支）。

## 最近一次有效提交

- 截至本文撰写：`6169ac0`（完成 WP1 工程骨架与共享契约）。
- 本文件所在提交：`docs: establish project context and development handoff`；提交完成后以 `git log -1 --oneline` 为准。

## 最近修改的模块

- 本轮：`AGENTS.md`、`docs/`（新增 project-overview/architecture/progress/roadmap/decisions/changelog，更新 README）、`.project/context.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`。
- 上一轮（WP1）：`apps/web`、`apps/admin`、`apps/api`、`packages/api-contracts`、`packages/config`、CI 与工程配置。

## 当前运行情况

- 本地当前未启动任何服务；可分别启动 API（127.0.0.1:3000）、用户端（5173）、管理端（5174）。
- 本机无 MySQL/Docker，`prisma migrate deploy` 未在真实空库执行过。
- 最近一次 `npm run quality` 在本轮文档任务完成后复跑（结果见验证记录）。

## 当前部署状态

- 无任何部署，未创建云资源。
- CI workflow 已配置但未在 GitHub 执行（未推送）。
- origin 已配置为 `https://github.com/Dada-sys101/richangzhushou.git`，未推送任何分支。

## 已完成任务

- WP0：产品、规则、数据、API、架构、测试、部署与交接文档（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 基线、CI、本地质量门与浏览器矩阵（提交 `6169ac0`，详见 `docs/13-wp1-acceptance-report.md`）。
- 本轮：项目上下文与接管文档体系（DA-0102，见 `TODO.md`）。

## 正在进行的任务

- 无业务开发任务。等待：推送 WP1 分支授权、WP2 开工授权。

## 下一步建议任务

1. 获得授权后推送 `codex/wp1-foundation`，让 GitHub Actions 首次执行质量门与空库 migration deploy。
2. 确认 OPEN-008（邮箱验证策略）后启动 WP2（身份、容量、邀请码与管理端）。
3. 并行补齐可复现的浏览器 QA 脚本（R-P0-3），修复/复核 favicon 404 控制台记录。

## 当前阻塞问题

- 未获推送与远端协作授权；未获 WP2 开工授权。
- 本机无 MySQL/Docker，真实 migration 验证受阻（CI 可解但未运行）。
- 浏览器 QA 证据未固化且存在 favicon 404 记录，`docs/13`“控制台 0 error”待复核。
- 产品名、供应商、部署地域、保留期、邮件验证策略等未决（`docs/decisions.md` OPEN-001~008）。

## 重要注意事项

- 遵循 `AGENTS.md`：不擅自改架构、不删功能、不碰无关文件、不动 `D:\codex-worker` 的开封旅游助手仓库。
- 涉及数据库/API/部署的变更必须先检查数据字典、OpenAPI、migration 与回滚、环境变量、CORS/安全配置兼容性。
- 跨工作区变更必须通过 `npm run quality` 与 `git diff --check`；任务完成后更新进度文档并独立提交。
- 真实凭据（密码、Token、API Key、私钥、生产数据库 URL）严禁写入仓库或文档。
- 未实现的功能不得写成已完成；无法确认的信息必须标注“待确认/未发现实现/文档与代码不一致”。

## 后续模型接手时的阅读顺序

1. `.project/context.md`（本文件）
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`
5. 当前工作包定义：`docs/12-development-handoff.md`
6. 实现代码与详细文档：`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/09-test-and-acceptance.md`
