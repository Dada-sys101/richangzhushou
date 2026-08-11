# 架构说明（Architecture）

文档版本：1.1
状态：已与代码、Git 历史和 V1.5 集成线交叉核对
更新：2026-08-11
说明：本文件描述“当前实际架构”；目标/规划架构见 `docs/07-technical-architecture-and-security.md`、根目录 `ARCHITECTURE.md`、`docs/40-v15-final-development-baseline.md` 与 `PLANS.md`。规划但未实现的组件均明确标注。

## 1. 前端架构

### 用户端 `apps/web`

- Vue 3 + TypeScript + Vite；依赖 Vue Router、Pinia 和 vite-plugin-pwa。
- 已实现：首页、账号、财务、快速记录、草稿、快捷指令、日历、待办、提醒、同步冲突、行程等页面。
- WP9 已下线邮箱注册、邀请码注册和截图 OCR；账号由管理员创建，首登/重置后强制改密。
- PWA：manifest、Workbox 应用外壳缓存；WP7 已以 IndexedDB 实现业务离线缓存、离线会话、待发送队列和同步恢复。
- 离线层：`apps/web/src/offline/*` + `stores/sync.ts`；API 客户端在断网时将写操作转入队列并返回本地占位实体。
- API 客户端：fetch + Bearer 注入 + 结构化错误 + 401 单飞刷新；开发代理 `/api` → API。

### 管理端 `apps/admin`

- Vue 3 + TypeScript + Vite + Element Plus；已实现登录、概览、用户、设置、审计及管理端账号操作。
- 旧邀请页面/逻辑已随 WP9 下线，不得按早期架构描述恢复。

### 构建与浏览器 QA

- 端口约定：web 5173、admin 5174、API 3000（API 默认监听 `127.0.0.1`）。
- Playwright 配置、E2E 脚本和 GitHub Actions `browser-qa` 已进入仓库。
- CI 运行 Chromium 桌面/移动 Smoke；本地可运行 Chromium/Firefox/WebKit 完整矩阵。
- 失败产物为 screenshot、trace、video 和 HTML report，相关输出已 gitignore。

## 2. 后端架构

- NestJS 11 单体（`apps/api`）。
- `main.ts`：API 前缀、Helmet、全局 ValidationPipe、精确 CORS 和安全监听。
- 已实现模块：
  - auth/account/capacity/admin/audit：账号、会话、容量、生命周期和脱敏审计；
  - finance：账单、分类、账户、预算、统计和 CSV；
  - shortcuts/drafts/attachments/integrations：设备凭证、草稿、附件和存储适配；
  - calendar/tasks/reminders：日历、待办、提醒和现有调度路径；
  - trips：行程、节点、行李、关联账单和汇总；
  - sync：变更游标、批次幂等、冲突和离线恢复；
  - account-deletion：删除调度、清理、取消和匿名墓碑；
  - Aliyun OSS Adapter：已进入 main，真实资源/连通仍未验证。
- WP9 已删除 Invite/邮件恢复/OCR 业务实现。

### V1.5 尚未正式实现

- AI 正式数据库、Proposal/Operation API/UI、Router 和真实 Provider；
- Push 正式数据库、订阅 API、自定义 Service Worker 和真实投递；
- 新 RRULE 引擎的正式读写、backfill/parity 和调度切换；
- CSV/XLSX 正式导入；
- V2EncryptedRepository、MigrationCoordinator、dual-read/write；
- Cutover 完整管理页、Shrink 和生产发布。

相关 PoC 只作为选型与边界证据，不等于正式实现或生产批准。

## 3. 数据库与数据存储

- Prisma 7 + MySQL 8.4。
- 已有正式实体覆盖用户/会话/审计、财务、草稿/附件/设备凭证、日历/待办/提醒、行程和同步。
- PR #8 已在 V1.5 integration 中加入 RRULE DB Expand；未进入 main，未启用新读写或调度。
- 对象存储支持 local/OSS Adapter；生产禁止 local。
- 服务端数据库是正式权威；客户端 IndexedDB 是缓存、离线队列和冲突工作区。
- V1.5 数据变更继续使用 Expand → 兼容 → 切换 → 保留 → Shrink；Shrink 需单独批准。

## 4. API 结构

- 契约文件：`packages/api-contracts/openapi/openapi.yaml`（OpenAPI 3.1）；共享 TypeScript 类型/枚举由契约包维护。
- 认证：短期 access token、HttpOnly refresh Cookie、可撤销快捷指令设备凭证。
- 已实现 V1 端点覆盖 auth/account/admin/finance/drafts/shortcuts/attachments/calendar/tasks/reminders/trips/sync。
- V1.5 AI、Push 和 Import 契约尚未进入正式实现；按 PR5、PR16、PR4/PR14 的职责分别补充。

## 5. 模块依赖关系

```text
根配置 ──► packages/config
packages/api-contracts ──► 共享 OpenAPI/类型/枚举
apps/web / apps/admin / apps/api ──► packages/api-contracts
apps/api ──► Prisma / StorageAdapter / NotificationAdapter / 后续 AiProvider
```

保持适配器隔离和失败降级，不在业务层绑定具体供应商。

## 6. 部署架构

- CI 已存在：Ubuntu + Node 24 + 临时 MySQL 8.4，运行 quality、migration 和 browser-qa。
- 目标最小部署单元：静态 Web/Admin + 单 NestJS API + 单 MySQL + 私有 OSS + HTTPS。
- Staging 未创建，生产未部署。
- OPEN-006 OSS Adapter 已合入 main；真实 Bucket/RAM/连通与备份上传仍需独立授权。
- 仓库文档曾提及 `deploy/staging/.env.staging.example`，当前真实路径必须在 Staging 任务中重新核验。

## 7. 关键数据流

### 已实现

```text
浏览器 → /api/v1 → Guard → 业务服务 → MySQL
快捷指令 → DeviceCredentialGuard → Draft/Finance → MySQL
客户端离线写入 → IndexedDB queue → /sync/mutations → 幂等/冲突 → MySQL
附件 → 上传意图/一次性令牌 → StorageAdapter → 完成确认
提醒 → 现有 scheduler → NotificationAdapter / 站内状态
```

### V1.5 规划

```text
Browser/PWA → Daily Assistant API → AiProviderAdapter → Provider HTTPS
Provider response → parse → JSON Schema validation → domain validation → AiProposal
→ 用户检查/编辑/补充 → 最终确认 → 正式 domain service → business tables
```

```text
Reminder → Delivery/Job → InApp 或 WebPushChannel
```

以上 AI 流程是 ADR-027 已冻结但尚未实现的目标架构。浏览器不得直连 Provider 或持有 credential；
R1 禁止自动跨 Provider fallback，只允许服务端受控配置切换。Provider output 不得直接写业务表、
直接调用业务写 API 或绕过正式 domain service，正式写入必须 100% 经用户最终确认。

AI 和 Push 均不得绕过 Feature Flag、审计、幂等和人工门禁。

## 8. V1.5 扩展边界

- `AiProviderAdapter`：候选顺序为 DeepSeek、阿里云百炼 / Qwen、OpenAI（仅对照）；当前不冻结
  唯一 Provider。PR20 受控真实评测后 final provider/model/effect thresholds 仍需人工批准。
- AI credential 仅允许 server secret/env reference 或未来经批准的 secret manager；唯一字段白名单、
  raw response 不持久化、正文不入普通日志、预算与 timeout/retry/breaker 见 ADR-027。
- Notification：站内提醒为保底；Web Push 为 R1.1，可关闭。
- `RecurrenceEngine`：PR1 已 DB Expand；R2 才完成新引擎和切换。
- Repository：R1 统一现有访问；完整加密迁移在 R3。
- Import：PR4/PR14/PR15 在 R2。
- Cutover/Shrink：PR21 在 R2，PR22/PR23 在 R3。
- 不引入微服务、外部消息队列或 Kubernetes；由用户量和指标触发后续评估。

## 9. 当前架构风险

- H7 未关闭：真实 AI Provider 的网络、额度、费用、延迟和结构化输出未验证；
- H6/H8 未关闭：真实 Push 送达和 MPL-2.0 评审未完成；
- Staging、域名/隧道、备份恢复和正式监控尚未建立；
- iPhone PWA/离线门禁需正式归档；
- Android 仅在真实设备 Smoke 后才能声明支持；
- 完整本地加密迁移和 Shrink 后移至 R3，v1 数据继续保留。
