# Project Context

## Last Updated

2026-08-05 17:45 +08:00（随 WP4 提交更新；提交哈希以 `git log -1` 为准，不虚构）

## Repository State

- Repository: `D:\daily-assistant`（独立 Git 仓库；origin: `https://github.com/Dada-sys101/richangzhushou.git`）
- Current Branch: `codex/wp4-shortcuts-ocr`
- HEAD Commit: 以 `git log -1 --oneline` 为准（WP4 验收提交）
- Working Tree Status: 本次 WP4 状态文档改动将随最终提交；无其他任务修改
- Last Verified Commit: 以 `git log -1 --oneline` 为准（WP4 验收：quality、空库 migration、41/41 集成测试、浏览器矩阵通过，记录于 `docs/18-wp4-acceptance-report.md`）

## Project Summary

- 项目目标：面向 10–20 名受邀用户的个人日常助手（V1.0），覆盖记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账、云端同步与本地离线。
- 当前技术栈：npm workspaces monorepo；Vue 3 + Vite PWA 用户端、Vue 3 + Element Plus 管理端、NestJS 单体 API、Prisma 7 + MySQL 8；OpenAPI 3.1 共享契约（`packages/api-contracts`）。
- 核心模块：auth/account/capacity/invites/admin/audit（WP2）、finance（WP3）、shortcuts/drafts/attachments/integrations（WP4）、web 用户端、admin 管理端。
- 当前部署方式概述：无任何部署；CI workflow 已配置但远端未运行；origin 已配置未推送 WP1–WP4 分支。

## Current Development Stage

- WP0（规划）、WP1（工程骨架）、WP2（身份/容量/邀请码/管理端）、WP3（基础记账与今日财务）、WP4（快捷指令/OCR/统一录入）均已完成并通过本地验收（`docs/13`、`docs/14`、`docs/16`、`docs/18`）。
- WP5–WP8 未开始。
- 无生产部署。

## Last Completed Task

- Task: 执行 WP4 快捷指令、OCR 与统一录入（契约、数据、后端、前端、验收与文档）。
- Completion Date: 2026-08-05
- Related Files: `packages/api-contracts`、`apps/api/prisma`、`apps/api/src/{shortcuts,drafts,attachments,integrations}`、`apps/web/src`、`docs/05/06/17/18` 等
- Verification: `npm run quality`、空库 migration+seed、`npm run test:integration`（41/41）、playwright 矩阵 25/25 与主流程
- Related Commit: `7cb7656`、`4be9524`、`4cd75e9` 及最终前端/文档提交（均以 `git log` 为准）

## Current Task

None（当前没有正在进行的开发任务；等待用户授权推送 WP1–WP4 分支并确认远端 CI，或授权启动 WP5）。

## Next Recommended Task

- Task: 确认 WP1–WP4 分支推送与远端 CI 结果（需用户授权；本机 `gh` 未登录，无法命令行查询）。
- Priority: P0（前置动作）
- Reason: 本地 WP0–WP4 已验收，但远端 CI 从未运行。
- Dependencies: 用户推送授权；网络代理可用（本机全局代理 7890 不可用，可用 7897 临时覆盖）。
- Acceptance Criteria: GitHub Actions 在 WP1–WP4 分支首次运行通过（`npm run quality` + 空库 migration）。

下一开发任务：WP5 日程、待办与提醒（未开始）。

## Completed Work

- WP0：规划文档体系（提交 `5d52395`）。
- WP1：Monorepo 骨架、OpenAPI 3.1、Prisma/MySQL 枚举基线、CI、本地质量门（提交 `6169ac0`；`docs/13`）。
- WP2：身份/会话/容量/邀请码/账号生命周期/管理端/审计/前端页面；空库 migration、18/18 集成测试、浏览器矩阵（`docs/14`）。
- WP3：Finance 契约、表结构/migration/seed、账单/分类/账户/预算/统计/CSV API 与集成测试、用户端记账页面、浏览器矩阵与验收（`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`、`3db5b40`；`docs/16`）。
- WP4：Shortcuts/Drafts/Attachments 契约与错误码、DeviceCredential/Attachment/DraftRecord migration、设备凭证生命周期与 Bearer 守卫、快捷指令幂等草稿、草稿中心（解析/OCR/确认/丢弃/批量二次确认）、附件上传意图/完成/删除、本地适配器与假实现、用户端快捷记录/草稿中心/快捷指令配置页（`7cb7656`、`4be9524`、`4cd75e9`；`docs/18`）。
- 机制 v1：跨任务自动恢复项目状态（提交 `1aab5ec`；AGENTS.md 恢复工作流 + context 固定结构）。
- 机制 v2（本次）：session/decisions/check:context 脚本/可选 pre-commit Hook。

## Remaining Work

- In Progress: None。
- Partially Completed: 远端 CI 验证（未推送）；浏览器 QA 一键脚本（OPEN-009）；PWA 离线同步（WP7 范畴）。
- Not Started: WP5 日程/待办/提醒、WP6 行程、WP7 PWA/离线同步、WP8 全量质量与发布准备。
- Needs Verification: WP5–WP8 全部功能；远端 CI；真实 OCR/对象存储供应商效果（OPEN-004/006）。

## Blockers

- 远端 CI 结果未确认（本机 `gh` 未登录；WP1–WP4 分支未推送）。
- 便携 MySQL 8.4 位于仓库外，其他机器复跑集成测试需自备 MySQL 8.x。
- 邮件供应商未确定（OPEN-003），当前使用内存 MailAdapter。
- 产品名、部署地域、保留期等未决（OPEN-001~008）。

## Known Issues

| 问题 | 影响 | 相关模块 | 当前状态 |
| --- | --- | --- | --- |
| 浏览器 QA 未固化为仓库内一键脚本 | 复现依赖 `playwright-cli` 与本地服务 | web/admin/CI | OPEN-009 |
| origin 仓库名 `richangzhushou` 与产品名不一致 | 品牌/仓库命名 | 仓库 | OPEN-002 |
| WP3 边界：整体预算 NULL 唯一性服务层校验；原账单软删后退款仍计入统计；统计仅 CNY；CSV 单次上限 10,000 行 | V1 规模可接受 | finance | `docs/16` |
| OCR/AI 与对象存储供应商未定：当前使用 `FAKE_OCR_TEXT` 假实现与本地临时存储 | 真实识别/上传能力未验收 | integrations | OPEN-004/006 |
| 本机 Git 全局代理 7890 不可用、7897 可用 | 远程 Git 操作需临时覆盖 | 本机环境 | 未修改全局配置 |

## Verification Status

- Lint: PASS（WP4 验收时 `npm run quality`）
- Type Check: PASS
- Unit Tests: PASS（API 23/23 + 契约 112/112，见 `docs/18`）
- Integration Tests: PASS（41/41，真实 MySQL 8.4，WP2+WP3+WP4）
- Build: PASS（全部 workspace）
- Runtime Verification: PASS（浏览器 5 宽度矩阵 25/25、主流程/OCR 降级/快捷指令、启动验证）
- Unverified Areas: 远端 CI（未推送）；WP5–WP8 全部功能；真实 OCR/对象存储供应商效果

## Recent Changes

- `7cb7656` feat(contracts): WP4 shortcuts, drafts and attachments OpenAPI contracts
- `4be9524` feat(db): WP4 device credentials, drafts and attachments schema and migration
- `4cd75e9` feat(api): WP4 device credentials, shortcut drafts, draft center, and attachment OCR
- `c1cfc33` fix(api): return ATTACHMENT_TYPE_NOT_ALLOWED from service after DTO validation
- 本次：feat(web): WP4 快捷记录/草稿中心/快捷指令配置页与验收文档（提交后以 `git log` 为准）

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
