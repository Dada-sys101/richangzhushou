# Project Context

## Last Updated

2026-08-05（随 WP3 本地验收完成更新）

## Repository State

- repository: `D:\daily-assistant`（独立 Git 仓库；origin: `https://github.com/Dada-sys101/richangzhushou.git`）
- current_branch: `codex/wp3-finance`
- latest_commit: 以 `git log -1 --oneline` 为准（WP3 验收提交见 Recent Changes）
- working_tree_status: 干净（WP3 相关修改已全部提交）

## Project Summary

Daily Assistant：面向 10–20 名受邀用户的个人日常助手（V1.0），聚焦记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账、云端同步与本地离线。技术栈：npm workspaces monorepo；Vue 3 + Vite PWA 用户端、Vue 3 + Element Plus 管理端、NestJS 单体 API、Prisma 7 + MySQL 8；OpenAPI 3.1 共享契约（`packages/api-contracts`）。

## Current Development Stage

- WP0（规划）、WP1（工程骨架）、WP2（身份/容量/邀请码/管理端）已完成并通过本地验收（`docs/13`、`docs/14`）。
- WP3（基础记账与今日财务）已完成并通过本地验收（`docs/16-wp3-acceptance-report.md`）。
- WP4–WP8 未开始；无生产部署。

## Last Completed Task

WP3 基础记账与今日财务：完成 Finance 契约、Prisma migration、账单/分类/账户/预算/统计/CSV API、29/29 集成测试、用户端记账页面与浏览器矩阵验收，输出 `docs/16-wp3-acceptance-report.md` 并同步状态文档。

## Current Task

- 当前任务：无进行中任务。等待用户决定是否推送 WP2/WP3 分支并确认远端 CI，或授权 WP4。
- 当前完成程度：WP3 全部 checkpoint 完成（DA-0301~0308 全部 DONE）；`npm run quality`、空库 migration、29/29 集成测试与浏览器矩阵全部通过。

## Next Recommended Task

1. 确认 WP2/WP3 分支是否推送与远端 CI 结果（需推送授权；本机 `gh` 未登录）。
2. WP4 快捷指令/OCR/统一录入开工需另行授权，规划见 `docs/12-development-handoff.md`。

## Completed Work

- WP0：规划文档体系（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 枚举基线、CI、本地质量门（提交 `6169ac0`；`docs/13`）。
- WP2：身份/会话/容量/邀请码/账号生命周期/管理端/审计/前端页面；空库 migration、18/18 集成测试、浏览器矩阵（`docs/14`）。
- WP3：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API 与集成测试、用户端记账页面、浏览器矩阵与验收报告（`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`、`3db5b40`；`docs/16`）。
- 机制建立：跨任务自动恢复项目状态（本次 docs 提交）。

## Remaining Work

- WP4 快捷指令/OCR/统一录入、WP5 日程/待办/提醒、WP6 行程、WP7 PWA/离线同步、WP8 全量质量与发布准备：全部未开始。
- 工程债：浏览器 QA 一键脚本（OPEN-009）、远端 CI 确认、便携 MySQL 复跑说明。

## Blockers

- 远端 CI 结果未确认（本机 `gh` 未登录；WP2/WP3 分支未推送）。
- 便携 MySQL 8.4 位于仓库外，其他机器复跑集成测试需自备 MySQL 8.x。
- 邮件供应商未确定（OPEN-003），当前使用内存 MailAdapter。
- 产品名、部署地域、保留期等未决（OPEN-001~008）。

## Known Issues

- WP3 已知边界：整体预算 NULL 唯一性由服务层校验；原账单软删除后其退款仍计入统计；统计摘要仅按 CNY 汇总；CSV 单次导出上限 10,000 行（详见 `docs/16`）。
- 浏览器 QA 未固化为仓库内一键脚本（OPEN-009）；`docs/13` 曾记录的 favicon 404 与“0 error”表述需以最新验收为准。
- origin 仓库名 `richangzhushou` 与产品名 Daily Assistant 不一致（OPEN-002）。
- 本机 Git 全局代理 `127.0.0.1:7890` 不可用；系统代理 `127.0.0.1:7897` 可用（远程 Git 操作临时覆盖，未修改全局配置）。

## Verification Status

- 已通过：WP3 `npm run quality`；空库 `prisma migrate deploy` + seed；WP2+WP3 集成测试 29/29；浏览器 5 宽度矩阵 30/30 与主流程/错误状态；`git diff --check`（`docs/16`）。
- 已通过（历史）：WP2 复核时 quality、空库 migration、18/18 集成测试与浏览器矩阵（`docs/14`）。
- 未运行/未确认：远端 CI（分支未推送）；WP4–WP8 全部功能。

## Recent Changes

- `820ef78` docs: WP3 开工状态切换与任务清单
- `c1c8f92` feat(contracts): 补全 WP3 Finance OpenAPI、共享类型、错误码与契约测试
- `3fcf1df` feat(db): WP3 Finance 表结构、migration、seed 与回滚说明
- `e7b971c` feat(finance): WP3 账单/分类/账户/预算/统计/CSV API 与集成测试
- `3fe6739` feat(web): WP3 记账页面（今日卡片、账单、表单、分类、账户、预算与 CSV 导出）
- `1aab5ec` docs: add automatic project state recovery workflow
- `3db5b40` fix: 查询 DTO 元数据与前端非 JSON 错误体处理
- 本次：docs/状态：WP3 本地验收完成（`docs/16-wp3-acceptance-report.md`）

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
