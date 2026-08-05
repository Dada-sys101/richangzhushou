# 06 API 与外部集成

文档版本：0.1  
状态：设计草案  
更新：2026-08-04  
适用版本：V1.0

## 通用契约

- 基础路径：`/api/v1`。
- JSON 字段使用 camelCase，ID 为字符串，时间为 ISO 8601。
- 认证用户接口使用短期访问令牌与可撤销刷新会话；具体 Cookie/Token 方案在 WP1 以安全评审确定。
- 写接口支持 `Idempotency-Key` 或 `clientMutationId`。
- 列表使用游标或简单页码分页；V1 单资源列表默认不返回全部历史。
- 错误响应包含 `code`、`message`、`requestId` 和可选字段错误，不返回堆栈。

## 端点清单

### 身份与账号

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /me`
- `POST /me/close`
- `POST /me/reopen`
- `POST /me/request-deletion`
- `DELETE /me/sessions/:sessionId`

`POST /auth/register` 必须在服务端事务中验证注册开关、邀请码和容量。

### 记账（WP3）

- `GET/POST /transactions`
- `GET/PATCH/DELETE /transactions/:id`
- `POST /transactions/:id/restore`
- `GET/POST /categories`、`PATCH /categories/:id`（归档而非物理删除）
- `GET/POST /financial-accounts`、`PATCH /financial-accounts/:id`（归档而非物理删除）
- `GET/POST /budgets`、`PATCH/DELETE /budgets/:id`
- `GET /finance/summary`
- `GET /finance/export.csv`

Finance 契约要点：

- 金额为两位小数字符串（`Money`），支出/收入/退款金额必须大于 0；退款必须引用原账单或标记为无原单退款。
- 列表支持 `cursor`/`limit` 游标分页与 `month`、`type`、`categoryId`、`accountId`、`includeDeleted` 过滤；分类/账户列表支持 `includeArchived`。
- 创建支持可选 `clientMutationId` 幂等重放；修改必须携带当前 `version`，过期返回 `VERSION_CONFLICT`。
- 疑似重复以 `duplicateWarning`（`POSSIBLE_DUPLICATE`）返回，不自动删除。
- 统计与月预算按 `Asia/Shanghai` 自然月（`YYYY-MM`）计算；CSV 导出仅当前用户已确认未删除账单，UTF-8 带 BOM。

### 草稿、OCR 和统一录入

- `POST /drafts/parse-text`
- `POST /drafts/ocr`
- `GET /drafts`
- `GET/PATCH /drafts/:id`
- `POST /drafts/:id/confirm`
- `POST /drafts/:id/discard`

OCR/AI 只填充草稿，不直接创建 `CONFIRMED` 业务记录。

### 快捷指令

- `POST /shortcut-credentials`
- `GET /shortcut-credentials`
- `DELETE /shortcut-credentials/:id`
- `POST /shortcuts/transaction-drafts`
- `GET /shortcuts/today-spend`

设备凭证按最小范围授权，例如 `transaction:draft:create`、`finance:summary:read`，创建时明文只展示一次，数据库只存哈希。

### 日程、待办和提醒

- `GET/POST /calendar-events`
- `GET/PATCH/DELETE /calendar-events/:id`
- `GET/POST /tasks`
- `GET/PATCH/DELETE /tasks/:id`
- `POST /tasks/:id/complete`
- `GET/POST /reminders`
- `GET/PATCH/DELETE /reminders/:id`

### 行程

- `GET/POST /trips`
- `GET/PATCH/DELETE /trips/:id`
- `POST /trips/:id/items`
- `PATCH/DELETE /trip-items/:id`
- `POST /trips/:id/packing-items`
- `PATCH/DELETE /packing-items/:id`

### 文件与同步

- `POST /attachments/upload-intents`
- `POST /attachments/:id/complete`
- `DELETE /attachments/:id`
- `GET /sync/changes?cursor=...`
- `POST /sync/mutations`
- `GET /sync/status`

### 管理端

- `GET /admin/dashboard`
- `GET/POST /admin/invites`
- `POST /admin/invites/:id/revoke`
- `GET /admin/users`
- `POST /admin/users/:id/suspend`
- `POST /admin/users/:id/close`
- `POST /admin/users/:id/reopen`
- `GET/PATCH /admin/settings/registration`
- `GET /admin/audits`
- `GET /admin/health`

## 核心错误码

| 错误码 | HTTP | 含义 |
| --- | --- | --- |
| `REGISTRATION_DISABLED` | 403 | 注册已关闭 |
| `CAPACITY_REACHED` | 409 | 有效用户达到上限 |
| `INVITE_INVALID` | 400 | 邀请码不存在或格式错误 |
| `INVITE_EXPIRED` | 410 | 邀请码过期 |
| `INVITE_EXHAUSTED` | 409 | 邀请码次数用尽 |
| `ACCOUNT_NOT_ACTIVE` | 403 | 账号不可登录或写入 |
| `REOPEN_CAPACITY_REACHED` | 409 | 恢复时已满员 |
| `IDEMPOTENCY_CONFLICT` | 409 | 同一幂等键内容不同 |
| `VERSION_CONFLICT` | 409 | 同步版本冲突 |
| `DUPLICATE_RESOURCE` | 409 | 分类/账户/预算唯一约束冲突 |
| `DRAFT_CONFIRMATION_REQUIRED` | 409 | 必须先确认草稿 |
| `RESOURCE_NOT_FOUND` | 404 | 不存在或不属于当前用户 |

## 外部集成与降级

- 邮件：注册验证、找回密码；失败时不创建无法验证的外部状态。
- OCR：失败时保留图片和手动表单入口。
- AI：超时或不可用时回退到规则解析或手动录入。
- 对象存储：上传采用短期签名和服务端完成确认；失败不创建悬空正式附件。
- 通知：无推送权限时保留应用内提醒并显示通知未开启。

## OpenAPI 要求

WP1 必须把本端点表转换为 OpenAPI 3.1，并为注册容量、快捷指令、同步冲突和权限隔离编写契约测试。
