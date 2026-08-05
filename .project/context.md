# Project Context

## Last Updated

2026-08-05 16:47 +08:00（随提交 `chore: add persistent project state recovery workflow` 更新；提交哈希以 `git log -1` 为准，不虚构）

## Repository State

- Repository: `D:\daily-assistant`（独立 Git 仓库；origin: `https://github.com/Dada-sys101/richangzhushou.git`）
- Current Branch: `codex/wp3-finance`
- HEAD Commit: `e5cb9a4`（docs: WP3 本地验收通过并输出验收报告）；以 `git log -1 --oneline` 为准
- Working Tree Status: 本任务的状态文档改动未提交（将随本次提交）；并行会话产生的 `docs/README.md` 与 `docs/17-wp4-codex-execution-plan.md` 修改未提交且不纳入本次提交
- Last Verified Commit: `e5cb9a4`（WP3 验收：quality、空库 migration、29/29 集成测试、浏览器矩阵通过，记录于 `docs/16-wp3-acceptance-report.md`）

## Project Summary

- 项目目标：面向 10–20 名受邀用户的个人日常助手（V1.0），覆盖记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账、云端同步与本地离线。
- 当前技术栈：npm workspaces monorepo；Vue 3 + Vite PWA 用户端、Vue 3 + Element Plus 管理端、NestJS 单体 API、Prisma 7 + MySQL 8；OpenAPI 3.1 共享契约（`packages/api-contracts`）。
- 核心模块：auth/users/capacity/invites/admin/audit（WP2）、finance（WP3）、web 用户端、admin 管理端。
- 当前部署方式概述：无任何部署；CI workflow 已配置但远端未运行；origin 已配置未推送 WP2/WP3 分支。

## Current Development Stage

- WP0（规划）、WP1（工程骨架）、WP2（身份/容量/邀请码/管理端）、WP3（基础记账与今日财务）均已完成并通过本地验收（`docs/13`、`docs/14`、`docs/16`）。
- WP4–WP8 未开始；WP4 可执行规划已由并行会话产出为 `docs/17-wp4-codex-execution-plan.md`（未提交，开工仍需用户授权）。
- 无生产部署。

## Last Completed Task

- Task: 建立“跨会话、跨模型、跨任务持续开发”项目状态恢复机制（v2：AGENTS.md 四章规则、`.project/session.md`、`.project/decisions.md`、`check:context` 校验脚本与可选 pre-commit Hook）。
- Completion Date: 2026-08-05
- Related Files: `AGENTS.md`、`.project/context.md`、`.project/session.md`、`.project/decisions.md`、`scripts/check-project-context.mjs`、`scripts/pre-commit-context-check.mjs`、`package.json`、`README.md`、`docs/progress.md`、`docs/changelog.md` 等
- Verification: `node scripts/check-project-context.mjs`、`npm run check:context`、`npm run quality`、`git diff --check`、静态敏感信息扫描
- Related Commit: 本次提交（提交信息 `chore: add persistent project state recovery workflow`；哈希以 `git log -1` 为准）

## Current Task

None（当前没有正在进行的开发任务；等待用户授权推送 WP2/WP3 分支并确认远端 CI，或授权启动 WP4）。

## Next Recommended Task

- Task: 确认 WP2/WP3 分支推送与远端 CI 结果（需用户授权；本机 `gh` 未登录，无法命令行查询）。
- Priority: P0（前置动作）
- Reason: 本地 WP0–WP3 已验收，但远端 CI 从未运行；推送与 CI 通过是 WP4 开工前的可验证基线。
- Dependencies: 用户推送授权；网络代理可用（本机全局代理 7890 不可用，可用 7897 临时覆盖）。
- Acceptance Criteria: GitHub Actions 在 WP2/WP3 分支首次运行通过（`npm run quality` + 空库 migration）。

WP4 快捷指令/OCR/统一录入规划见 `docs/17-wp4-codex-execution-plan.md`，开工需另行授权。

## Completed Work

- WP0：规划文档体系（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 枚举基线、CI、本地质量门（提交 `6169ac0`；`docs/13`）。
- WP2：身份/会话/容量/邀请码/账号生命周期/管理端/审计/前端页面；空库 migration、18/18 集成测试、浏览器矩阵（`docs/14`）。
- WP3：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API 与集成测试、用户端记账页面、浏览器矩阵与验收（`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`、`3db5b40`；`docs/16`）。
- 机制 v1：跨任务自动恢复项目状态（提交 `1aab5ec`；AGENTS.md 恢复工作流 + context 固定结构）。
- 机制 v2（本次）：session/decisions/check:context 脚本/可选 pre-commit Hook。

## Remaining Work

- In Progress: None（并行会话正在产出 `docs/17-wp4-codex-execution-plan.md`，未提交，不属于本次任务）。
- Partially Completed: 远端 CI 验证（未推送）；浏览器 QA 一键脚本（OPEN-009）；PWA 离线同步（WP7 范畴）。
- Not Started: WP4 快捷指令/OCR/统一录入、WP5 日程/待办/提醒、WP6 行程、WP7 PWA/离线同步、WP8 全量质量与发布准备。
- Needs Verification: WP4–WP8 全部功能；远端 CI。

## Blockers

- 远端 CI 结果未确认（本机 `gh` 未登录；WP2/WP3 分支未推送）。
- 便携 MySQL 8.4 位于仓库外，其他机器复跑集成测试需自备 MySQL 8.x。
- 邮件供应商未确定（OPEN-003），当前使用内存 MailAdapter。
- 产品名、部署地域、保留期等未决（OPEN-001~008）。

## Known Issues

| 问题 | 影响 | 相关模块 | 当前状态 |
| --- | --- | --- | --- |
| 并行会话未提交修改（`docs/README.md`、`docs/17-wp4-codex-execution-plan.md`） | 不属于本次任务 | docs | 保留未提交，不纳入本次提交 |
| 浏览器 QA 未固化为仓库内一键脚本 | 复现依赖 `playwright-cli` 与本地服务 | web/admin/CI | OPEN-009 |
| origin 仓库名 `richangzhushou` 与产品名不一致 | 品牌/仓库命名 | 仓库 | OPEN-002 |
| WP3 边界：整体预算 NULL 唯一性服务层校验；原账单软删后退款仍计入统计；统计仅 CNY；CSV 单次上限 10,000 行 | V1 规模可接受 | finance | `docs/16` |
| 本机 Git 全局代理 7890 不可用、7897 可用 | 远程 Git 操作需临时覆盖 | 本机环境 | 未修改全局配置 |

## Verification Status

- Lint: PASS（WP3 验收时 `npm run quality`；本次复跑结果见最终报告）
- Type Check: PASS
- Unit Tests: PASS（单元 + 契约，见 `docs/16`）
- Integration Tests: PASS（29/29，真实 MySQL 8.4）
- Build: PASS（全部 workspace）
- Runtime Verification: PASS（浏览器 5 宽度 30/30、主流程/错误状态、启动验证）
- Unverified Areas: 远端 CI（未推送）；WP4–WP8 全部功能；校验脚本在远端 CI 中的表现（本地已通过）

## Recent Changes

- `e5cb9a4` docs: WP3 本地验收通过并输出验收报告（docs/16）
- `3db5b40` fix: 查询 DTO 元数据与前端非 JSON 错误体处理
- `1aab5ec` docs: add automatic project state recovery workflow
- `3fe6739` feat(web): WP3 记账页面（今日卡片、账单、表单、分类、账户、预算与 CSV 导出）
- `e7b971c` feat(finance): WP3 账单/分类/账户/预算/统计/CSV API 与集成测试
- `3fcf1df` feat(db): WP3 Finance 表结构、migration、seed 与回滚说明
- 本次：chore: add persistent project state recovery workflow（提交后以 `git log` 为准）

## Important Constraints

- 遵循 `AGENTS.md`：任务前按 Project State Recovery / Required Workflow 恢复状态；用户当前任务优先；不自动执行多个 roadmap 任务；未经授权不 push、不部署、不改生产；保留未知未提交修改。
- 状态职责：`context.md` 负责长期项目状态；`session.md` 负责当前或暂停任务；`decisions.md` 只记录可从代码/Git/文档确认的决策。
- 不擅自改架构、不删功能、不碰无关文件、不动 `D:\codex-worker` 的开封旅游助手仓库。
- 数据库/API/部署变更必须先检查数据字典、OpenAPI、migration 与回滚、环境变量、CORS/安全配置兼容性。
- 跨工作区变更必须通过 `npm run quality` 与 `git diff --check`；项目状态文件一致性通过 `npm run check:context`。
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
