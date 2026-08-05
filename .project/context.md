# Project Context

## Last Updated

2026-08-05（随提交 `docs: add automatic project state recovery workflow` 更新）

## Repository State

- repository: `D:\daily-assistant`（独立 Git 仓库；origin: `https://github.com/Dada-sys101/richangzhushou.git`）
- current_branch: `codex/wp3-finance`
- latest_commit: `3fe6739`（feat(web): WP3 记账页面…），以 `git log -1 --oneline` 为准
- working_tree_status: 3 个未提交修改——`apps/api/src/finance/finance.controller.ts`（DTO import 调整）、`apps/admin/src/api/client.ts` 与 `apps/web/src/api/client.ts`（HTTP 错误解析防御性修复）；来源未完全确认，已全部保留，未纳入本次提交

## Project Summary

Daily Assistant：面向 10–20 名受邀用户的个人日常助手（V1.0），聚焦记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账、云端同步与本地离线。技术栈：npm workspaces monorepo；Vue 3 + Vite PWA 用户端、Vue 3 + Element Plus 管理端、NestJS 单体 API、Prisma 7 + MySQL 8；OpenAPI 3.1 共享契约（`packages/api-contracts`）。

## Current Development Stage

- WP0（规划）、WP1（工程骨架）、WP2（身份/容量/邀请码/管理端）已完成并通过本地验收（`docs/13`、`docs/14`）。
- WP3（基础记账与今日财务）已获授权并执行中：Finance 契约、表结构/migration、API 与集成测试、用户端页面已提交；验收与文档同步未完成（TODO DA-0308 IN_PROGRESS）。
- WP4–WP8 未开始；无生产部署。

## Last Completed Task

建立“跨任务自动恢复项目状态”固定机制（仅文档）：AGENTS.md 增加 Project State Recovery、Required workflow before every task、Task completion state updates、Task priority rules；`.project/context.md` 规范化为固定结构；同步 progress、changelog 与状态文件。提交：`docs: add automatic project state recovery workflow`。

## Current Task

- 当前任务：WP3 收尾——完成验收、处理 3 个未提交的业务文件修改（`finance.controller.ts`、`admin/src/api/client.ts`、`web/src/api/client.ts`）并提交，输出 `docs/16-wp3-acceptance-report.md` 并同步状态文档（对应 TODO DA-0308）。
- 当前完成程度：功能代码已提交（`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`）；验收/文档未完成；存在 1 个未提交的业务文件修改。
- 涉及模块：`apps/api/src/finance`、`apps/web/src/views`（记账页面）、`packages/api-contracts`、`docs`。
- 验收标准：`npm run quality` 通过；真实 MySQL 空库 migration 与集成测试通过；浏览器 5 宽度矩阵通过；验收报告与状态文档同步。

## Next Recommended Task

完成 WP3 本地验收并提交：先确认并提交 `apps/api/src/finance/finance.controller.ts` 的未提交修改，再运行 `npm run quality`、真实 MySQL 集成测试与浏览器矩阵，输出 `docs/16-wp3-acceptance-report.md`。
依据：WP3 功能代码已提交（`3fe6739` 等），当前唯一进行中任务为 DA-0308（验收与文档同步）；这是 `docs/progress.md` 中依赖已满足的最高优先级进行中任务。

## Completed Work

- WP0：规划文档体系（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 枚举基线、CI、本地质量门（提交 `6169ac0`；`docs/13`）。
- WP2：身份/会话/容量/邀请码/账号生命周期/管理端/审计/前端页面；空库 migration、18/18 集成测试、浏览器矩阵（`docs/14`）。
- WP3（已提交、未验收）：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API 与集成测试、用户端记账页面（`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`）。
- 机制建立：跨任务自动恢复项目状态（本次 docs 提交）。

## Remaining Work

- WP3 验收与文档同步（DA-0308 IN_PROGRESS）；3 个未提交的业务文件修改待确认提交。
- WP4 快捷指令/OCR/统一录入、WP5 日程/待办/提醒、WP6 行程、WP7 PWA/离线同步、WP8 全量质量与发布准备：全部未开始。
- 工程债：浏览器 QA 一键脚本（OPEN-009）、远端 CI 确认、便携 MySQL 复跑说明。

## Blockers

- 远端 CI 结果未确认（本机 `gh` 未登录；WP2/WP3 分支未推送）。
- 便携 MySQL 8.4 位于仓库外，其他机器复跑集成测试需自备 MySQL 8.x。
- 邮件供应商未确定（OPEN-003），当前使用内存 MailAdapter。
- 产品名、部署地域、保留期等未决（OPEN-001~008）。

## Known Issues

- `apps/api/src/finance/finance.controller.ts`、`apps/admin/src/api/client.ts`、`apps/web/src/api/client.ts` 存在来源未完全确认的未提交修改，已全部保留未提交。
- 浏览器 QA 未固化为仓库内一键脚本（OPEN-009）；`docs/13` 曾记录的 favicon 404 与“0 error”表述需以最新验收为准。
- origin 仓库名 `richangzhushou` 与产品名 Daily Assistant 不一致（OPEN-002）。
- 本机 Git 全局代理 `127.0.0.1:7890` 不可用；系统代理 `127.0.0.1:7897` 可用（远程 Git 操作临时覆盖，未修改全局配置）。

## Verification Status

- 已通过（记录）：WP2 复核时 `npm run quality`；WP2 空库 migration + 18/18 集成测试；WP2 浏览器 5 宽度矩阵。
- 构建状态：WP1/WP2 基线构建通过；WP3 提交后尚未在本轮复跑。
- 未运行/未确认：WP3 提交后的 `npm run quality`、集成测试、浏览器矩阵；远端 CI。
- 尚未验证：WP4–WP8 全部功能；WP3 验收结论。

## Recent Changes

- `3fe6739` feat(web): WP3 记账页面（今日卡片、账单、表单、分类、账户、预算与 CSV 导出）
- `e7b971c` feat(finance): WP3 账单/分类/账户/预算/统计/CSV API 与集成测试
- `3fcf1df` feat(db): WP3 Finance 表结构、migration、seed 与回滚说明
- `c1c8f92` feat(contracts): 补全 WP3 Finance OpenAPI、共享类型、错误码与契约测试
- 本次：docs: add automatic project state recovery workflow

## Important Constraints

- 遵循 `AGENTS.md`：任务前先恢复状态；用户当前任务优先；不自动执行多个 roadmap 任务；未经授权不 push、不部署、不改生产；保留未知未提交修改。
- 不擅自改架构、不删功能、不碰无关文件、不动 `D:\codex-worker` 的开封旅游助手仓库。
- 数据库/API/部署变更必须先检查数据字典、OpenAPI、migration 与回滚、环境变量、CORS/安全配置兼容性。
- 跨工作区变更必须通过 `npm run quality` 与 `git diff --check`。
- 真实凭据严禁写入仓库或文档；未验证功能不得写成已验证；未实现功能不得写成已完成。

## Handoff Instructions

Before starting any task:

1. Read AGENTS.md.
2. Read .project/context.md.
3. Read docs/progress.md.
4. Read docs/roadmap.md.
5. Inspect the current Git branch and working tree.
6. Inspect relevant recent commits.
7. Compare documentation with actual code.
8. Execute the current user request only after project state has been restored.
9. Update this file after completing the task.
