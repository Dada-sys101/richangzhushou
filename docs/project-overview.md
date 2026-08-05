# 项目概述（Project Overview）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05
适用版本：V1.0

## 项目名称

- 当前名称：Daily Assistant（临时名称；正式产品名 `[待确认]`，见 `docs/decisions.md` OPEN-001）。

## 项目目标

面向 10–20 名受邀早期用户的个人日常助手。V1.0 聚焦记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账，以及云端同步和本地离线能力；同时提供管理端用于容量、邀请码、账号状态与审计管理，管理员默认不能读取用户生活数据正文。

## 使用场景

- 手机端（iPhone 可安装 PWA）：支付后通过快捷指令快速生成账单草稿、截图/语音文字识别草稿、查看今日安排与同步状态。
- 电脑网页端：账单整理与统计、分类/账户/预算配置、行程管理、导出。
- 管理端：维护全局容量、注册开关、邀请码和账号状态，查看脱敏审计与运行状态。

## 核心功能

| 功能 | V1.0 目标 | 当前实际状态 |
| --- | --- | --- |
| 邀请码注册与全局容量控制 | 完整 | 未开始（仅 OpenAPI/枚举契约） |
| 基础记账（账单/分类/账户/预算/统计/导出） | 完整主流程 | 未开始（仅契约） |
| Apple 快捷指令辅助记账 | 完整主流程 | 未开始（仅契约） |
| OCR/文字/语音统一录入草稿 | 框架加可用流程 | 未开始（仅契约） |
| 日程/待办/提醒 | 基础可用 | 未开始（仅契约） |
| 行程 | 框架加可用主流程 | 未开始（仅契约） |
| PWA 与离线同步 | 完整主流程 | 仅 PWA 应用壳与 manifest；离线写入/同步未实现 |
| 管理后台 | 完整必要功能 | 仅管理端空壳 |

> 详细功能范围与验收标准见 `docs/01-prd-and-feature-scope.md`、`docs/09-test-and-acceptance.md`。

## 技术栈（当前实际）

- Monorepo：npm workspaces；要求 Node.js 24、npm 11。
- 用户端 `apps/web`：Vue 3 + TypeScript + Vite + Vue Router + Pinia + vite-plugin-pwa。
- 管理端 `apps/admin`：Vue 3 + TypeScript + Vite + Element Plus。
- 后端 `apps/api`：NestJS 11 单体 + TypeScript；Prisma 7 + MySQL 8 provider 基线。
- 契约 `packages/api-contracts`：OpenAPI 3.1、共享枚举与 API 边界类型。
- 共享配置 `packages/config`：TypeScript、ESLint、Prettier 基线。
- 测试：Vitest（单元/契约/HTTP 冒烟）；CI：GitHub Actions（临时 MySQL 8.4）。

说明：`docs/07` 中规划的对象存储、OCR/AI/邮件/通知适配器、数据库调度、IndexedDB 离线层等目标能力均尚未实现；Pinia 已作为依赖引入用户端，但尚无业务 store。

## 仓库结构

```text
apps/
  web/        Vue 3 + Vite + PWA 用户端（Home/404 壳）
  admin/      Vue 3 + Element Plus 管理端（Home/404 壳）
  api/        NestJS 单体（仅 /api/v1/health 实现）、Prisma schema 与迁移目录
packages/
  api-contracts/  OpenAPI 3.1、共享枚举/类型、契约测试
  config/         共享 ESLint/TypeScript/构建配置
docs/         规划文档 00–13（产品、规则、数据、API、架构、测试、部署、交接）
.github/workflows/ci.yml  质量门 + 空库 migration deploy
.project/context.md       实时上下文（后续模型优先阅读）
```

## 本地运行方式

要求 Node.js 24、npm 11；真实 migration 验证需要 MySQL 8.x。

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
npm run dev --workspace @daily-assistant/api
npm run dev --workspace @daily-assistant/web
npm run dev --workspace @daily-assistant/admin
```

默认地址：API `http://127.0.0.1:3000/api/v1/health`、用户端 `http://localhost:5173`、管理端 `http://localhost:5174`。`.env.example` 只含本地占位值，真实凭据不得提交。

质量门：

```powershell
npm run quality
git diff --check
```

连接真实空 MySQL 库后额外执行：

```powershell
npm run prisma:migrate:deploy --workspace @daily-assistant/api
```

## 当前部署方式

- 无生产、staging 或测试部署，未创建任何云资源。
- `.github/workflows/ci.yml` 已配置（`npm ci` → `npm run quality` → 临时 MySQL 8.4 空库 `prisma migrate deploy`），但分支未推送，远端 CI 尚未执行。
- `git remote -v` 已配置 origin（`https://github.com/Dada-sys101/richangzhushou.git`），尚未推送任何分支；仓库名与产品名的关系 `[待确认]`。
- 发布所需域名、供应商、合规要求与保留期等均为未决项，见 `docs/decisions.md`。

## 文档导航

- 索引：`docs/README.md`
- 架构：`docs/architecture.md`（当前实际）与 `docs/07-technical-architecture-and-security.md`（目标设计）
- 进度：`docs/progress.md`、`PROJECT_STATUS.md`、`TODO.md`
- 路线图：`docs/roadmap.md`、`MASTER_PLAN.md`
- 决策：`docs/decisions.md`
- 变更：`docs/changelog.md`、`CHANGELOG.md`
- 工作包：`docs/12-development-handoff.md`
