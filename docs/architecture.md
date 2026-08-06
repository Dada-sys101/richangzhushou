# 架构说明（Architecture）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05
说明：本文件描述“当前实际架构”；目标/规划架构见 `docs/07-technical-architecture-and-security.md` 与根目录 `ARCHITECTURE.md`。规划但未实现的组件均明确标注。

## 1. 前端架构

### 用户端 `apps/web`

- Vue 3 + TypeScript + Vite；依赖 Vue Router、Pinia（auth/finance/drafts store）和
  vite-plugin-pwa。
- 已实现业务页面：首页今日财务、账单/分类/账户/预算、交易表单、快捷记录
  （文本/截图 OCR）、草稿中心（DraftReviewCard + 批量丢弃二次确认）、快捷指令
  配置页、注册/登录/找回密码/账号页与 404。
- PWA：manifest、`registerType: "prompt"`、Workbox `navigateFallback`（denylist
  `/api`）；WP7 起以 IndexedDB 实现业务离线缓存、离线会话、待发送队列与
  Service Worker 应用外壳缓存（不缓存 API 响应）。
- 离线层：`apps/web/src/offline/{db,sync,handler,local,money}.ts` + `stores/sync.ts`；
  API 客户端在断网时自动将写操作转入离线队列并返回本地占位实体。
- API 客户端：`apps/web/src/api/client.ts`（fetch + Bearer 注入 + 结构化错误）；
  Vite 开发代理 `/api` → `http://127.0.0.1:3000`。

### 管理端 `apps/admin`

- Vue 3 + TypeScript + Vite + Element Plus；已实现登录、概览、邀请码、用户、
  设置、审计页面与 API 调用（WP2）。

### 构建与开发

- 端口约定：web 5173、admin 5174、API 3000（API 监听 `127.0.0.1`）。
- 浏览器 QA 产物仅存在于本机 gitignored 目录（`.playwright-cli/`、
  `output/playwright/`），仓库内无 Playwright 依赖/脚本（OPEN-009）。

## 2. 后端架构

- NestJS 11 单体（`apps/api`），`AppModule` 注册：auth、account、capacity、
  invites（admin/audit 内）、finance、drafts、shortcuts、attachments、
  integrations、mail、security、rate-limiter、prisma。
- `main.ts`：`API_BASE_PATH` 前缀、Helmet、全局 ValidationPipe
  （whitelist/forbidNonWhitelisted/transform）、精确 CORS、127.0.0.1 监听。
- 已实现模块：
  - `auth/account/capacity/invites/admin/audit`：注册登录、刷新 Cookie、容量
    事务、邀请码、账号生命周期、管理端与脱敏审计（WP2）。
  - `finance`：账单/分类/账户/预算/统计/CSV，Decimal 金额与自然月（WP3）。
  - `shortcuts`：`DeviceCredentialGuard`（SHA-256 哈希、撤销、账号、作用域、
    限流）、凭证生命周期、幂等交易草稿、今日支出（WP4）。
  - `drafts`：规则解析、OCR 草稿、CRUD、确认（事务 + resultId）、丢弃、
    批量二次确认与审计（WP4）。
  - `attachments`：上传意图、一次性令牌内容上传、完成（扫描门控）、删除
    （WP4）。
  - `integrations`：`StorageAdapter`/`OcrAdapter`/`ScanAdapter` 接口与本地
    假实现（WP4）。
- 未实现模块：无（WP1–WP7 业务模块均已实现）。

## 3. 数据库与数据存储

- Prisma 7 + MySQL 8（`apps/api/prisma/schema.prisma`）。
- 业务表：users/sessions/recovery_codes/invite_codes/invite_redemptions/
  admin_audits（WP2）；categories/financial_accounts/transactions/budgets
  （WP3）；device_credentials/attachments/draft_records（WP4）。
- migration：`20260805000000_wp2_identity_capacity`、
  `20260805080803_wp3_finance`、`20260805085724_wp4_shortcuts_ocr`，
  均已在空库 MySQL 8.4 部署验证。
- 对象存储：本地临时存储适配器（`apps/api/.local-storage`，gitignored）；
  真实对象存储供应商未定（OPEN-006）。

## 4. API 结构

- 契约文件：`packages/api-contracts/openapi/openapi.yaml`（OpenAPI 3.1），
  应用代码已消费共享枚举/类型。
- 安全方案：`accessToken`（短期 Bearer）、`refreshCookie`（HttpOnly 刷新
  Cookie）、`shortcutToken`（设备凭证 Bearer）均已实现。
- 已实现端点：auth/me、capacity/admin/audit（WP2）；finance 全部（WP3）；
  drafts/parse-text、drafts/ocr、drafts CRUD+confirm/discard、batch-discard、
  shortcut-credentials、shortcuts/transaction-drafts、shortcuts/today-spend、
  attachments/upload-intents、attachments/:id/content、
  attachments/:id/complete、attachments/:id（WP4）。
- 未实现端点：无（WP2–WP7 端点均已实现；批次删除等未声明端点不实现）。

## 5. 模块依赖关系

当前实际依赖：

```text
根配置（eslint.config.mjs、tsconfig.base.json）──► packages/config
packages/api-contracts ──► 无运行时依赖（独立契约包）
apps/web / apps/admin / apps/api ──► 引用 packages/api-contracts（类型/枚举/校验）
```

外部适配层（可降级，已实现接口与本地假实现）：

```text
apps/api ──► Prisma（MySQL）、StorageAdapter（本地）、OcrAdapter（假）、
             ScanAdapter（假）、MailAdapter（内存）
```

## 6. 部署架构

- 无部署配置（无 Dockerfile、无静态站点配置、无托管商配置）。
- CI：`.github/workflows/ci.yml` 在 Ubuntu + Node 24 + 临时 MySQL 8.4 service 上执行 `npm run quality` 和 `prisma migrate deploy`；未在远端运行。
- 远端：origin 已配置但未推送。
- 规划最小部署单元（静态用户端/管理端 + 单个 API 实例 + 单个 MySQL + 私有对象存储 + HTTPS 入口）见 `docs/10-deployment-and-operations.md`，全部 `[待确认]`。

## 7. 关键数据流

当前实际数据流：

```text
浏览器 ──► /api/v1/* ──► AccessTokenGuard/UserOnlyGuard ──► 业务模块 ──► MySQL
快捷指令 ──► DeviceCredentialGuard（哈希/作用域/限流）──► DraftsService ──► MySQL
图片 ──► 上传意图/一次性令牌 ──► 本地存储 ──► 扫描门控 ──► OCR 适配器 ──► 草稿
```

规划数据流（已实现，见 `docs/24`）：

- 邀请码注册：验证注册开关 → 验证邀请码 → 事务内锁容量配置并计数 → 创建用户并消耗邀请码（`docs/02`、`docs/03`）。
- 快捷指令记账：幂等键提交 → 服务端草稿（已实现） → 用户确认 → 正式入账（已实现，`docs/18`）。
- 离线同步：本地 IndexedDB 待发送队列 → `POST /sync/mutations` 幂等提交 →
  版本冲突进入 `/sync/conflicts` 由用户确认（`docs/02`、`docs/07`、`docs/24`）。

## 8. 当前架构风险

- OCR/AI 与对象存储供应商未定：当前使用本地假实现/临时存储，真实效果验收待供应商决策（OPEN-004/006）。
- 浏览器 QA 未固化为仓库内一键脚本：仍依赖 `playwright-cli` 与本机服务（OPEN-009）。
- 离线同步、多设备冲突与 PWA 业务缓存已实现（WP7，本地验收见 `docs/24`）；
  浏览器 QA 一键脚本化与真实供应商通道仍待后续。
- 部署与运维全部未定：供应商、域名、备份、监控、合规均 `[待确认]`。
- 部署与运维全部未定：供应商、域名、备份、监控、合规均 `[待确认]`。
