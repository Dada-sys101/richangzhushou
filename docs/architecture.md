# 架构说明（Architecture）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05
说明：本文件描述“当前实际架构”；目标/规划架构见 `docs/07-technical-architecture-and-security.md` 与根目录 `ARCHITECTURE.md`。规划但未实现的组件均明确标注。

## 1. 前端架构

### 用户端 `apps/web`

- Vue 3 + TypeScript + Vite；依赖 Vue Router（`createWebHistory`）、Pinia（已安装、未使用）和 vite-plugin-pwa。
- 路由：`/`（HomeView）与 `/:pathMatch(.*)*`（404），仅工程壳页面。
- PWA：manifest（standalone、图标、主题色）、`registerType: "prompt"`、Workbox `navigateFallback: "/index.html"`、`runtimeCaching: []`。
- 实际能力：仅静态壳；无 API 客户端、无认证状态、无离线业务缓存、无业务页面。

### 管理端 `apps/admin`

- Vue 3 + TypeScript + Vite + Element Plus（按组件引入样式）。
- 路由：`/`（HomeView）与 404，仅工程壳页面。
- 实际能力：仅静态壳；无登录、无管理 API 调用。

### 构建与开发

- 端口约定：web 5173、admin 5174、API 3000（API 监听 `127.0.0.1`）。
- 共享 TypeScript/ESLint 配置来自 `packages/config`（根 `tsconfig.base.json`、`eslint.config.mjs`）。
- 浏览器 QA 产物（截图/快照）仅存在于本机 gitignored 目录（`.playwright-cli/`、`output/playwright/`），仓库内没有 Playwright 依赖、配置或 npm 脚本 `[待确认]`。

## 2. 后端架构

- NestJS 11 单体（`apps/api`），当前 `AppModule` 仅注册 `HealthController`。
- `main.ts` 基线：
  - 全局前缀：`API_BASE_PATH`（默认 `/api/v1`）。
  - Helmet 安全头。
  - 全局 `ValidationPipe`：`whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`（DTO allow-list 基线；当前无业务 DTO）。
  - 精确 CORS：`CORS_ORIGINS` 逗号分隔，默认仅本地 5173/5174，`credentials: true`。
  - 监听 `127.0.0.1:3000`（PORT 可配置）。
- 已实现端点：`GET /api/v1/health`（非敏感存活响应）。
- 规划模块（auth、users、capacity、invites、finance、drafts、calendar、tasks、reminders、trips、attachments、sync、admin、audit、integrations）均未实现，见 `docs/07`。

## 3. 数据库与数据存储

- Prisma 7 + MySQL 8 provider（`apps/api/prisma/schema.prisma`）。
- 当前 schema 仅包含 11 个共享枚举（UserRole、UserStatus、InviteStatus、TransactionType、RecordStatus、RecordSource、TaskStatus、Priority、ReminderStatus、SyncState、DraftStatus），没有任何业务表。
- `apps/api/generated/` 为 gitignored 的生成客户端目录；`prisma generate` 脚本已提供。
- `apps/api/prisma/migrations/` 只有 README（说明 WP2 应创建首个业务 migration）；离线 `migrate diff --from-empty` 结果为空。
- 无对象存储代码；`docs/07` 规划的对象存储、附件上传、扫描状态等均未实现。

## 4. API 结构

- 契约文件：`packages/api-contracts/openapi/openapi.yaml`（OpenAPI 3.1）。
- 规模：59 个路径、86 个操作（1 个 health + 85 个规划业务操作）。
- 通用契约：基础路径 `/api/v1`；ID 为字符串；时间为 ISO 8601；金额为定点字符串（`^-?\d+\.\d{2}$`）；错误响应含 `code/message/requestId`。
- 安全方案（契约层）：`accessToken`（短期 Bearer）、`refreshCookie`（HttpOnly 刷新 Cookie）、`shortcutToken`（最小权限设备凭证）；实际签发与校验逻辑未实现。
- 实现状态：除 health 外全部操作未实现，OpenAPI 中已用 summary 与 `x-error-codes` 明确标注契约边界。

## 5. 模块依赖关系

当前实际依赖：

```text
根配置（eslint.config.mjs、tsconfig.base.json）──► packages/config
packages/api-contracts ──► 无运行时依赖（独立契约包）
apps/web / apps/admin / apps/api ──► 尚未引用 packages/api-contracts
```

规划依赖（未实现）：

```text
apps/web / apps/admin / apps/api ──► packages/api-contracts（共享类型/枚举）
apps/api ──► Prisma（MySQL）、外部适配层（OCR/AI/邮件/对象存储/通知，可降级）
```

> 注意：契约包当前只被自身测试引用，应用代码尚未消费；这是 WP2+ 接入时的主要衔接点。

## 6. 部署架构

- 无部署配置（无 Dockerfile、无静态站点配置、无托管商配置）。
- CI：`.github/workflows/ci.yml` 在 Ubuntu + Node 24 + 临时 MySQL 8.4 service 上执行 `npm run quality` 和 `prisma migrate deploy`；未在远端运行。
- 远端：origin 已配置但未推送。
- 规划最小部署单元（静态用户端/管理端 + 单个 API 实例 + 单个 MySQL + 私有对象存储 + HTTPS 入口）见 `docs/10-deployment-and-operations.md`，全部 `[待确认]`。

## 7. 关键数据流

当前实际数据流：

```text
浏览器 ──► GET /api/v1/health ──► NestJS HealthController ──► 非敏感 JSON 响应
```

规划数据流（文档设计，未实现）：

- 邀请码注册：验证注册开关 → 验证邀请码 → 事务内锁容量配置并计数 → 创建用户并消耗邀请码（`docs/02`、`docs/03`）。
- 快捷指令记账：幂等键提交 → 服务端草稿预览 → 用户确认 → 正式入账（`docs/02`）。
- 离线同步：本地 IndexedDB 待发送队列 → 幂等提交 → 版本冲突确认（`docs/02`、`docs/07`）。

## 8. 当前架构风险

- 契约与实现分离：OpenAPI/枚举契约完整，但应用未引用契约包，业务实现从零开始，存在契约漂移风险。
- 浏览器 QA 不可复现：仓库无 Playwright 依赖/脚本；验收报告声称的控制台 0 error 与 `.playwright-cli` 中一条 favicon 404 记录不一致 `[待确认]`。
- 数据库基线未在真实 MySQL 验证：本机无 MySQL/Docker，migration deploy 未实际执行。
- 安全基线仅“脚手架级”：认证、授权、限流、审计、数据隔离均为契约/文档设计，无实现。
- 前端缺少错误、离线、API 客户端与路由守卫层：后续工作包必须从零建立。
- 部署与运维全部未定：供应商、域名、备份、监控、合规均 `[待确认]`。
