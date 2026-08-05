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

## 部分完成

| 条目 | 现状 | 依据 |
| --- | --- | --- |
| 共享契约接入应用代码 | 契约包已定义并通过自身测试，但 `apps/*` 尚未引用 `@daily-assistant/api-contracts`，API 也未按契约实现 | `packages/api-contracts`；`rg "@daily-assistant" apps` 无业务 import |
| PWA 离线能力 | 仅应用外壳 + manifest；无业务缓存、离线写入、同步队列 | `apps/web/vite.config.ts` |
| CI 验证 | 配置存在，但仓库未推送，GitHub Actions 未执行 | `.github/workflows/ci.yml`；`docs/13` |
| 浏览器矩阵验证 | 有截图/快照产物，但未固化为可复现脚本；`docs/13` 声称“控制台 0 error”，而 `.playwright-cli` 留有 favicon.ico 404 记录 | `.playwright-cli/`（gitignored）；`docs/13` |

## 进行中

- 无业务工作在进行中。当前仅文档/上下文固化；完成后 WP1 保持“本地完成”，WP2 仍未开始且未获授权。

## 未开始

- WP2 身份、容量、邀请码与管理（`docs/12`）
- WP3 基础记账与今日财务
- WP4 快捷指令、OCR 与统一录入
- WP5 日程、待办与提醒
- WP6 行程
- WP7 PWA 与离线同步
- WP8 全量质量与发布准备

以上工作包状态与 `MASTER_PLAN.md`、`TODO.md` 一致，均为 `NOT_STARTED`。

## 已知问题

| 问题 | 影响 | 状态 |
| --- | --- | --- |
| 本机无 MySQL/Docker，真实空库 `prisma migrate deploy` 未执行 | migration 正确性仅有离线 diff 证据 | 环境阻塞；CI 路径已配置但未远端执行 |
| 浏览器 QA 未固化为仓库脚本（无 Playwright 依赖/配置/npm 脚本） | `docs/13` 的矩阵验收不可复现 | 待补齐 |
| `.playwright-cli` 留有一条 favicon.ico 404 控制台记录，与“控制台 0 error”表述不一致 | 验收报告与原始记录存在张力 | 待复核 |
| 应用尚未引用共享契约包 | 契约与运行时实现可能漂移 | WP2 接入时解决 |
| 远端 CI 未执行 | “CI 通过”无法被证实 | 待推送授权 |
| origin 仓库名 `richangzhushou` 与产品名 Daily Assistant 不一致 | 品牌/仓库命名 `[待确认]` | OPEN-001/002 |

## 待验证事项

- 在当前机器重新运行 `npm run quality` 的结果（本文更新时复跑）。
- 真实 MySQL 8 空库 `prisma migrate deploy`（本地或远端 CI）。
- GitHub Actions 首次远端执行。
- 浏览器矩阵（375/390/430/768/1440、404、Back、离线）脚本化复现与控制台断言。
- 契约包接入后 API 行为与 OpenAPI 的一致性。
- 未实现功能一律不得视为已验证；计划中的功能不得写成已完成。
