# 项目进度（Progress）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05

说明：条目尽量附文件、模块或 Git 提交依据。提交：`5d52395` = 初始化项目（WP0 规划）；`6169ac0` = WP1 工程骨架与共享契约。

## 已完成

| 条目 | 依据 |
| --- | --- |
| WP0 规划文档体系（00–12） | 提交 `5d52395`；`docs/00`–`docs/12` |
| 独立 Git 仓库初始化 | 提交 `5d52395`；`git log` |
| Monorepo 工程骨架（3 apps + 2 packages） | 提交 `6169ac0`；根 `package.json` |
| 用户端/管理端/API 空壳与路由 | 提交 `6169ac0`；`apps/*/src` |
| PWA 配置（manifest、Workbox 外壳） | 提交 `6169ac0`；`apps/web/vite.config.ts` |
| OpenAPI 3.1 契约（59 路径 / 86 操作：85 业务 + 1 health） | 提交 `6169ac0`；`packages/api-contracts/openapi/openapi.yaml` |
| 共享枚举/边界类型及 TS↔OpenAPI 对齐测试 | 提交 `6169ac0`；`packages/api-contracts/src`、`test` |
| Prisma 7 + MySQL 基线（11 个共享枚举，无业务表） | 提交 `6169ac0`；`apps/api/prisma/schema.prisma` |
| API 安全基线（Helmet、allow-list 校验、精确 CORS、127.0.0.1 监听） | 提交 `6169ac0`；`apps/api/src/main.ts` |
| CI workflow（质量门 + 空库 migrate deploy） | 提交 `6169ac0`；`.github/workflows/ci.yml` |
| WP1 本地质量门与 HTTP 冒烟 | `docs/13-wp1-acceptance-report.md` |
| 浏览器矩阵检查（本机产物，未入库） | `docs/13`；`.playwright-cli/`、`output/playwright/` |
| 项目上下文与接管文档体系 | 本次提交（见 `docs/changelog.md`） |
| WP2 契约：OpenAPI/共享类型/错误码/状态机 | `packages/api-contracts`；`docs/14` |
| WP2 Prisma 实体与首个 migration | `apps/api/prisma/schema.prisma`、`prisma/migrations/20260805000000_wp2_identity_capacity` |
| WP2 身份与会话：Argon2id、刷新 Cookie、恢复凭证 | `apps/api/src/auth`；`docs/14` |
| WP2 容量与邀请码事务 | `apps/api/src/capacity`、`apps/api/src/auth`；`docs/14` |
| WP2 管理端 API、角色守卫与审计 | `apps/api/src/admin`、`apps/api/src/audit` |
| WP2 用户端与管理端页面 | `apps/web/src/views`、`apps/admin/src/views` |
| WP2 集成与浏览器验收 | `apps/api/src/integration/wp2.integration.test.ts`；`output/playwright/wp2` |
| WP2 复核（2026-08-05）：空库迁移、seed、18/18 集成测试与 5 宽度浏览器矩阵 | `docs/14-wp2-acceptance-report.md` v2.0；`output/playwright/wp2` |
| 跨任务自动恢复机制（Project State Recovery 工作流） | 本次提交；`AGENTS.md`、`.project/context.md` |
| WP3 契约：Finance OpenAPI/共享类型/错误码/契约测试 | `c1c8f92`；`packages/api-contracts` |
| WP3 Prisma 实体、migration、seed 与回滚说明 | `3fcf1df`；`apps/api/prisma`；`migrations/20260805080803_wp3_finance` |
| WP3 Finance API 与单元/集成测试 | `e7b971c`；`apps/api/src/finance`、`apps/api/src/integration/wp3.integration.test.ts` |
| WP3 用户端记账页面 | `3fe6739`；`apps/web/src/views`、`stores/finance.ts` |
| WP3 修复与浏览器矩阵验收 | `3db5b40`；`docs/16-wp3-acceptance-report.md`；`output/playwright/wp3` |
| 持久化项目状态恢复机制（session/decisions/check:context 与可选 Hook） | 本次提交；`.project/session.md`、`.project/decisions.md`、`scripts/check-project-context.mjs` |

## 部分完成

| 条目 | 现状 | 依据 |
| --- | --- | --- |
| 共享契约接入应用代码 | `apps/api` 已引用 `@daily-assistant/api-contracts`；前端使用本地 client 类型 | `apps/api/package.json` |
| PWA 离线能力 | 仅应用外壳 + manifest；无业务缓存、离线写入、同步队列 | `apps/web/vite.config.ts` |
| CI 验证 | 配置存在并加入 WP2 集成测试，但当前分支未推送，GitHub Actions 未执行 | `.github/workflows/ci.yml`；`docs/14` |
| 浏览器矩阵验证 | 已用 `playwright-cli` 完成 5 宽度并保存产物；尚未固化为仓库内一键脚本 | `output/playwright/wp2`（gitignored 部分） |

## 进行中

- 无进行中业务任务。

## 未开始

- WP4 快捷指令、OCR 与统一录入
- WP5 日程、待办与提醒
- WP6 行程
- WP7 PWA 与离线同步
- WP8 全量质量与发布准备

以上工作包状态与 `MASTER_PLAN.md`、`TODO.md` 一致：WP0–WP3 已 DONE（WP3 验收见 `docs/16`），WP4–WP8 为 `NOT_STARTED`。

## 已知问题

| 问题 | 影响 | 状态 |
| --- | --- | --- |
| 便携 MySQL 8.4 位于仓库外 | 其他机器复跑集成测试需要自备 MySQL 8.x | 记录于 `docs/14` |
| 浏览器 QA 未固化为仓库内一键脚本 | 复现依赖 `playwright-cli` 与本地服务 | 待后续固化 |
| 远端 CI 未执行 | “CI 通过”无法被远端证实 | 待推送授权 |
| origin 仓库名 `richangzhushou` 与产品名 Daily Assistant 不一致 | 品牌/仓库命名 `[待确认]` | OPEN-001/002 |
| WP3 整体预算 NULL 唯一性由服务层校验；原账单软删除后其退款仍计入统计；统计摘要仅按 CNY 汇总；CSV 单次上限 10,000 行 | 边界行为，V1 规模可接受 | 记录于 `docs/16` |

## 待验证事项

- 当前机器 `npm run quality` 已复跑通过（WP3 分支，2026-08-05）。
- 便携 MySQL 8.4 空库 `prisma migrate deploy`（2 migrations）与 seed 已真实执行通过；WP2+WP3 集成测试 29/29 通过。
- GitHub Actions 远端执行待推送授权。
- 浏览器矩阵（375/390/430/768/1440）已用 `playwright-cli` 复跑验证（30/30）；一键脚本化复现待后续（OPEN-009）。
- `npm run check:context` 与 `npm run quality` 已在本次机制任务中复跑通过。
- 未实现功能一律不得视为已验证；计划中的功能不得写成已完成。
