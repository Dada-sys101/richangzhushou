# 日常助手（Daily Assistant）

面向 10–20 名受邀早期用户的个人日常助手。V1.0 聚焦记账、日程、待办、提醒、行程、Apple 快捷指令辅助记账，以及云端同步和本地离线能力。

V1 提醒仅应用内查看（不承诺 Web Push/系统通知/短信/邮件，Web Push 与系统通知列为 V1.1 候选）。

> 当前阶段：WP1–WP8 已完成本机验收；WP9 完成身份与录入简化（账号密码登录、管理员建号、首登强制改密、邮箱/邀请码/截图 OCR 下线）；对象存储接入代码已完成并随 PR #6 合并到 main（main CI 通过），真实云资源与 staging 待授权。没有生产环境。

## 工程结构

- `apps/web`：Vue 3 + TypeScript + Vite 用户端 PWA（注册/登录/账号/记账页面）。
- `apps/admin`：Vue 3 + TypeScript + Vite + Element Plus 管理端（概览/邀请码/用户/设置/审计）。
- `apps/api`：NestJS 单体 API 与 Prisma/MySQL（身份、容量、管理端、Finance API）。
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

## 浏览器 QA（OPEN-009）

- 安装浏览器：`npx playwright install chromium firefox webkit`
- 冒烟（Chromium 桌面 + 390×844 移动）：`npm run test:e2e:smoke`
- 完整矩阵（Chromium/Firefox/WebKit、1440/390/375/430）：`npm run test:e2e:matrix`
- 全部用例：`npm run test:e2e`；带界面调试：`npm run test:e2e:headed`

E2E 使用独立测试库，本地运行前设置 `E2E_DATABASE_URL`（专用 MySQL 8 库，禁止使用开发/生产库）；
测试启动脚本会自动执行 Prisma generate、契约构建、migration、测试管理员引导并启动 API/Web/管理端，
结束后关闭进程。失败产物位于 `test-results/` 与 `playwright-report/`（已 gitignore）。

默认地址：API `http://127.0.0.1:3000/api/v1/health`、用户端 `http://localhost:5173`、管理端 `http://localhost:5174`。`.env.example` 只含本地占位值；真实密码、Token、API Key 和生产凭据不得提交。

## 对象存储（OPEN-006）

- 本地/测试默认 `STORAGE_PROVIDER=local`（`LocalStorageAdapter`，写入 `LOCAL_STORAGE_DIR`）。
- Staging/生产必须 `STORAGE_PROVIDER=oss`：`AliyunOssStorageAdapter` 使用私有 Bucket 与同 Region
  内网 Endpoint；`STORAGE_BUCKET`/`STORAGE_REGION`/`STORAGE_ENDPOINT`/`STORAGE_ACCESS_KEY_ID`/
  `STORAGE_ACCESS_KEY_SECRET` 缺失时启动失败，`NODE_ENV=production` 禁止 local。
- 上传仍由 API 服务端代理（`PUT /api/v1/attachments/:id/content`），无需 OSS 浏览器 CORS；
  新附件键为 `users/{userId}/attachments/{fileId}`，旧 `attachments/` 键兼容读取与删除。
- 实现代码已随 PR #6 squash 合并到 main（merge commit `db5c5d3`）；
  main quality/browser-qa 通过。
- 尚未创建真实 OSS Bucket/RAM，尚未完成真实连通测试；staging 未创建、生产未部署。
- 示例文件：`deploy/staging/.env.staging.example`（仅占位符，真实 `.env.staging` 已 gitignore）。

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

## 项目状态恢复机制

- `AGENTS.md` 强制每次任务开始前按 Project State Recovery / Required Workflow Before Every Task 恢复项目状态（context → session → progress → roadmap → changelog → Git 状态），任务结束前更新状态文件。
- `.project/context.md`：长期项目状态；`.project/session.md`：当前或暂停任务；`.project/decisions.md`：技术决策（ADR）。
- 校验：`npm run check:context`（已并入 `npm run quality`）。
- 可选 pre-commit Hook（不自动安装）：`git config core.hooksPath .githooks`；仓库提供 `.githooks/pre-commit` 调用 `node scripts/pre-commit-context-check.mjs`。Windows 下也可直接运行该命令。

## 已确认边界

- 早期用户规模为 10–20 人，可配置全局有效用户上限。
- 采用邀请码注册；达到人数上限时邀请码也不能突破限制。
- 正常账号占用名额，关闭账号释放名额，恢复账号重新检查容量。
- 同时提供 iPhone 可安装网页（PWA）和电脑网页。
- 云端同步，同时保留本地缓存和离线写入能力。
- V1.0 不包含家庭共享。
- AI 低风险写操作经确认后执行；高风险操作二次确认并可审计。
- 记账入口优先级：快捷指令/文本草稿 > 手动记账；语音文字与文件导入为后续版本。

## 文档入口

- [文档索引](docs/README.md)
- [总体计划](MASTER_PLAN.md)
- [当前状态](PROJECT_STATUS.md)
- [开发交接](docs/12-development-handoff.md)

## 仓库边界

本项目是 `D:\daily-assistant` 中的独立 Git 仓库。不得把代码并入或修改 `D:\codex-worker` 的开封旅游助手仓库。
