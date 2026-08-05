# Daily Assistant

面向 10–20 名受邀早期用户的个人日常助手。V1.0 聚焦记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账，以及云端同步和本地离线能力。

> 当前阶段：WP1 工程骨架与共享契约。尚未实现注册、邀请码、记账、日程、待办、行程或同步业务，也没有生产环境。

## 工程结构

- `apps/web`：Vue 3 + TypeScript + Vite 用户端 PWA 空壳。
- `apps/admin`：Vue 3 + TypeScript + Vite + Element Plus 管理端空壳。
- `apps/api`：NestJS 单体 API 与 Prisma/MySQL 基线，仅实现非敏感健康检查。
- `packages/api-contracts`：OpenAPI 3.1、共享枚举、API 边界类型和契约测试。
- `packages/config`：共享 TypeScript、ESLint 及安全的非秘密默认配置。

## 本地开发

要求 Node.js 24、npm 11，以及需要验证真实 migration 时使用的 MySQL 8.x。

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
npm run dev --workspace @daily-assistant/api
npm run dev --workspace @daily-assistant/web
npm run dev --workspace @daily-assistant/admin
```

默认地址：API `http://127.0.0.1:3000/api/v1/health`、用户端 `http://localhost:5173`、管理端 `http://localhost:5174`。`.env.example` 只含本地占位值；真实密码、Token、API Key 和生产凭据不得提交。

## 质量门

```powershell
npm run quality
git diff --check
```

`npm run quality` 依次验证格式、Lint、类型、单元/契约测试、全部 workspace 构建、Prisma schema、OpenAPI 3.1、离线 migration diff 和依赖审计。连接真实的空 MySQL 库后，额外运行：

```powershell
npm run prisma:migrate:deploy --workspace @daily-assistant/api
```

GitHub Actions 使用临时 MySQL 8.4 service 执行同一质量门与空库 migration deploy，不接触生产资源。

## 已确认边界

- 早期用户规模为 10–20 人，可配置全局有效用户上限。
- 采用邀请码注册；达到人数上限时邀请码也不能突破限制。
- 正常账号占用名额，关闭账号释放名额，恢复账号重新检查容量。
- 同时提供 iPhone 可安装网页（PWA）和电脑网页。
- 云端同步，同时保留本地缓存和离线写入能力。
- V1.0 不包含家庭共享。
- AI 低风险写操作经确认后执行；高风险操作二次确认并可审计。
- 记账入口优先级：快捷指令辅助 > 截图识别 > 语音文字 > 文件导入。

## 文档入口

- [文档索引](docs/README.md)
- [总体计划](MASTER_PLAN.md)
- [当前状态](PROJECT_STATUS.md)
- [开发交接](docs/12-development-handoff.md)

## 仓库边界

本项目是 `D:\daily-assistant` 中的独立 Git 仓库。不得把代码并入或修改 `D:\codex-worker` 的开封旅游助手仓库。
