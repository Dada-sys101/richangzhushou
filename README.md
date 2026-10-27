# 日常助手（Daily Assistant）

> 2026-10-23 交付更新：补丁 fb50097 已提交推送，Draft PR #83 已创建；PR CI 39916174760 SUCCESS（数据库 162 项、浏览器 86 项通过），Push CI 39916145898 也为 SUCCESS。后续文档提交的最终 HEAD/CI 以 PR 为准。详见 [交付快照](docs/55-vite-security-patch-20261023.md)；以下未提交状态为早期检查点，未合并或部署。

面向约 10 名管理员建号的首批用户。V1 已实现记账、日程、待办、提醒、行程、
Apple 快捷指令辅助记账、云端同步和本地离线；V1.5 在现有基础上增量加入受控 AI、
可选 Web Push 和后续迁移能力。

站内提醒是首发保底能力。Web Push 属 R1.1，若真机送达或许可证门禁未通过，
保持 Feature Flag 关闭，不阻塞 R1 基础上线。AI 是 R1 首发硬门禁，只能生成
待确认 Proposal，不得直接写正式业务记录。

> 当前阶段（2026-10-23）：受邀用户私有预览运营。Integration 为 6cab22f，历史合并 CI 38364527083 三项通过；预览仍为 d3db83b，API/Nginx/MySQL active。最新导航、依赖和 AI 校验修复已合入但尚未全部部署。
> 本地 Vite 8.2.4 补丁已通过完整 quality 和正式依赖审计（0 High/Critical、8 Moderate），已提交推送为 fb50097，Draft PR #83；最终 HEAD 的 CI 以 PR 检查为准，尚未合并或部署。R1 历史批准、独立 Staging 豁免及私有预览 H6/H7/H8 边界保留；公网/生产未发布。
> 本轮候选、验证与回滚/验收条件见 [准备清单](docs/54-private-preview-update-plan-20261023.md)。

## 工程结构

- `apps/web`：Vue 3 + TypeScript + Vite 用户端 PWA。
- `apps/admin`：Vue 3 + TypeScript + Vite + Element Plus 管理端。
- `apps/api`：NestJS 单体 API 与 Prisma/MySQL。
- `packages/api-contracts`：OpenAPI 3.1、共享枚举、API 边界类型和契约测试。
- `packages/config`：共享 TypeScript、ESLint 及安全的非秘密默认配置。

## 本地开发

要求 Node.js 24、项目固定的 npm 11.18.0，以及需要验证真实 migration 时使用的 MySQL 8.x。
仓库通过 `packageManager`、精确 npm engine 和 `.npmrc` 的 `engine-strict` 拒绝其他 npm 版本；
请使用隔离方式安装/调用 npm 11.18.0，不要为本项目修改系统全局 npm。CI 会在安装依赖前固定并核验该版本。
安装脚本采用精确版本 allowlist。统一入口 `npm run install:locked` 会先以 `--ignore-scripts` 安装，
再 fail-closed 检查不存在未审阅脚本，最后才执行 allowlist 中的脚本；出现新的或版本变化的安装脚本时不会进入 rebuild。

```powershell
npm run install:locked
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
- 上传仍由 API 服务端代理；新附件键为 `users/{userId}/attachments/{fileId}`，
  旧 `attachments/` 键兼容读取与删除。
- 实现代码已随 PR #6 合入 main，main quality/browser-qa 通过。
- 尚未创建真实 OSS Bucket/RAM，尚未完成真实连通测试；Staging 未创建、生产未部署。
- 仓库文档曾提及 `deploy/staging/.env.staging.example`；当前路径状态应在 Staging 任务中重新核验，
  不得仅依赖旧文档判断文件存在。

## 质量门

```powershell
npm run check:context
npm run quality
git diff --check
```

`npm run quality` 依次验证格式、Lint、类型、单元/契约测试、全部 workspace 构建、Prisma schema、OpenAPI 3.1、离线 migration diff 和依赖审计。连接真实空 MySQL 库后额外运行 migration deploy。

GitHub Actions 使用临时 MySQL 8.4 service，不接触生产资源。

### PR6a 临时 MySQL 8.4 验证

对显式指定的本机 loopback MySQL 8.4 实例创建随机目标库、guard database 和 scoped user，运行
全部 migration 与 DB tests，并验证权限隔离及 DB/user 清理：

```powershell
$env:PR6A_MYSQL_ADMIN_URL = "mysql://<temporary-admin>@127.0.0.1:3306/mysql"
npm run validate:mysql84:temporary
```

只允许 `127.0.0.1`、`::1`、`localhost`，不存在远程 override；管理员凭据不进入 migration 或
Vitest 子进程。完整安全边界和验收证据见 `docs/41-pr6a-mysql84-validation.md`。

## V1.5 项目状态恢复机制

- `AGENTS.md`：强制恢复、执行、验证和授权纪律。
- `PLANS.md`：V1.5 唯一执行总路线。
- `.project/v15-execution-state.md`：唯一仓库内执行状态快照，不是 GitHub/CI 实时镜像。
- `.project/context.md`：长期状态；`.project/session.md`：当前/暂停任务；
  `.project/decisions.md`：ADR 索引。
- 当前 canonical successor：R1 Quality Gate（`BLOCKED / NOT_READY；H7 CLOSED`；未发现独立任务契约）；最近完成的治理契约为
  `tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md`。
- PR19 V10 契约：`tasks/PR19.md`；Accepted PR20/H7 边界：`docs/adr/ADR-028-v15-pr20-adapter-integration-h7-boundary.md`。
- 校验：`npm run check:context`（已并入 `npm run quality`）。

## 当前首发边界

- 账号仅由管理员创建；邮箱注册、邀请码注册和截图 OCR 已下线。
- 正常账号占用名额，关闭账号释放名额，恢复账号重新检查容量。
- iPhone Safari/主屏幕 PWA 是主要验收端；Android 为响应式 Web/PWA。
- 云端同步，同时保留本地缓存和离线写入能力。
- R1 不包含家庭共享。
- AI 正式写入必须经用户确认和审计；H7 虽已关闭，Provider enablement 和 R1 上线仍须完成独立发布门禁。
- ADR-028 已使 PR20 adapter integration 与 live Provider validation 分开记录；本机受控合成评估已形成
  `DONE_LOCAL / H7_CLOSED` 证据。Dada 已接受当前阶段的 DeepSeek、条款和 provisional schema/effect 结果，但
  生产 Provider 使用、真实用户/生产数据评测、Provider enablement、REL-04 和 R1 advancement 仍未获授权。
  CI 绿色不等于生产批准，且 run `33043413216` 的 Playwright report upload 被跳过。
- ADR-027 仍冻结 Provider/模型候选、服务端接入、安全/预算/韧性和评测策略；当前阶段暂定 DeepSeek
  `deepseek-v4-flash`，长期候选未冻结。ADR-029 记录自然月/暂不设固定金额上限的临时策略；该策略不提供
  金额超支保护，也不等于生产预算 enforcement 已完成。
- Import、新 RRULE 切换、完整 IndexedDB 加密迁移和 Shrink 在 R2/R3，后移不取消。

## 文档入口

- [执行总规划](PLANS.md)
- [V1.5 执行状态快照](.project/v15-execution-state.md)
- [最近完成的治理契约](tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md)
- [PR19 V10 契约](tasks/PR19.md)
- [Accepted ADR-028 H7 边界](docs/adr/ADR-028-v15-pr20-adapter-integration-h7-boundary.md)
- [Accepted ADR-027](docs/adr/ADR-027-ai-provider-evaluation-policy.md)
- [Accepted temporary ADR-029](docs/adr/ADR-029-ai-budget-calendar-month-observation.md)
- [PR6a MySQL 8.4 验收](docs/41-pr6a-mysql84-validation.md)
- [文档索引](docs/README.md)
- [总体计划](MASTER_PLAN.md)
- [当前状态](PROJECT_STATUS.md)
- [冻结基线 V1.2](docs/40-v15-final-development-baseline.md)
- [Accepted ADR-026](docs/adr/ADR-026-v15-release-scope-r1.md)

## 仓库边界

本项目是独立 Git 仓库，不得并入或修改开封旅游助手仓库。
