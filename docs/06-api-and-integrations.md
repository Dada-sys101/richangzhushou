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

- `POST /drafts/parse-text`：规则解析文本，生成 `source=TEXT` 的 `PENDING` 草稿；
  无法识别金额时返回 `VALIDATION_ERROR`。
- `POST /drafts/ocr`：对已上传且 `scanStatus=SCANNED` 的附件调用 OCR 适配器，
  生成 `source=OCR` 的 `PENDING` 草稿；OCR 不可用时返回 `OCR_UNAVAILABLE`（503），
  手动录入路径不受影响（QA-DRAFT-001）。
- `GET /drafts`：当前用户草稿列表，支持 `status`/`cursor`/`limit`。
- `GET/PATCH /drafts/:id`：查看与编辑；只有 `PENDING` 可编辑，否则返回
  `DRAFT_NOT_EDITABLE`（409）；编辑携带 `version`，过期返回 `VERSION_CONFLICT`。
- `POST /drafts/:id/confirm`：单事务内将草稿标记 `CONFIRMED` 并创建
  `CONFIRMED` 交易，保留 `source` 与 `clientMutationId`；已确认草稿重放返回原交易；
  未确认草稿不计入任何统计（QA-DRAFT-002）。
- `POST /drafts/:id/discard`：丢弃 `PENDING` 草稿。
- `POST /drafts/batch-discard`：高风险批量丢弃/清空的第一次确认，返回短期
  `confirmationToken` 与受影响草稿 ID；`ids` 省略表示清空全部待确认。
- `POST /drafts/batch-discard/confirm`：二次确认后执行丢弃并写脱敏审计
  （action=`DRAFT_BATCH_DISCARD`）（QA-DRAFT-003）。

OCR/AI 只填充草稿，不直接创建 `CONFIRMED` 业务记录。

### 快捷指令

- `POST /shortcut-credentials`：创建设备凭证（名称 + `ShortcutScope[]`），
  明文令牌只显示一次；数据库只存 SHA-256 哈希与 8 位展示前缀。
- `GET /shortcut-credentials`：仅返回元数据（名称/范围/前缀/最近使用/撤销时间）。
- `DELETE /shortcut-credentials/:id`：撤销后立即失效（QA-SC-003）。
- `POST /shortcuts/transaction-drafts`：设备凭证作用域
  `transaction:draft:create`，幂等创建 `PENDING` 交易草稿；同一
  `Idempotency-Key` 相同内容返回原草稿，不同内容返回 `IDEMPOTENCY_CONFLICT`
  （QA-SC-001/002）。
- `GET /shortcuts/today-spend`：设备凭证作用域 `finance:summary:read`，
  返回 `Asia/Shanghai` 今日支出（定点字符串）。

设备凭证按最小范围授权，例如 `transaction:draft:create`、`finance:summary:read`，
创建时明文只展示一次，数据库只存哈希；快捷指令端点经
`DeviceCredentialGuard` 校验哈希、撤销状态、账号状态、作用域并限流。

### 日程、待办和提醒

- `GET/POST /calendar-events`
- `GET/PATCH/DELETE /calendar-events/:id`
- `POST /calendar-events/:id/restore`
- `GET/POST /tasks`
- `GET/PATCH/DELETE /tasks/:id`
- `POST /tasks/:id/restore`
- `POST /tasks/:id/complete`
- `GET/POST /reminders`
- `GET/PATCH/DELETE /reminders/:id`
- `POST /reminders/:id/restore`

WP5 契约要点：
- 三个资源均为用户范围内容 API（`AccessTokenGuard` + `UserOnlyGuard`），
  管理员默认 403；跨用户访问 404；软删除/恢复、`version` 乐观并发与
  `clientMutationId` 幂等与 Finance/草稿一致。
- 日程：`endsAt` 不得早于 `startsAt`；全天事件使用 `Asia/Shanghai` 本地午夜
  边界（endsAt 为次日后边界）；重叠只返回 `overlapWarning` 不阻止创建；
  列表支持 `date`/`month`/`status`/`includeDeleted` 过滤。
- 待办：`overdue` 为计算状态（仅 `OPEN` 且 `dueAt` 已过）；`POST
  /tasks/:id/complete` 仅对 `OPEN` 生效并写入 `completedAt`；`PATCH` 状态
  转换写入 `completedAt`/`cancelledAt`，终态不可再转换。
- 提醒：`scheduleType` 为 `ONCE`/`DAILY`/`WEEKLY`/`MONTHLY`；
  `scheduledAt` 恒为下一次应发送时间；`recurrence` 为
  `{ interval?, weekdays?, dayOfMonth?, until? }`；`targetType` 支持
  `CALENDAR_EVENT`/`TASK`/`STANDALONE`，目标必须属于当前用户。
- 调度器为数据库记录 + 单进程周期扫描；领取采用原子状态/重试字段更新，
  防重、失败重试上限与 `FAILED`/`SUPPRESSED` 可诊断状态；多实例部署前必须
  引入数据库租约或等价互斥。
- 通知适配器：`NotificationAdapter` 接口 + 本地假实现；无推送权限时保留
  应用内提醒并显示“通知未开启”。

### 行程

- `GET/POST /trips`
- `GET/PATCH/DELETE /trips/:id`
- `POST /trips/:id/items`
- `PATCH/DELETE /trip-items/:id`
- `POST /trips/:id/packing-items`
- `PATCH/DELETE /packing-items/:id`

### 文件与同步

- `POST /attachments/upload-intents`
- `PUT /attachments/:id/content?uploadToken=...`：一次性令牌上传原始字节；
  令牌只存哈希，意图过期返回 `UPLOAD_INTENT_EXPIRED`，超限返回
  `ATTACHMENT_TOO_LARGE`。
- `POST /attachments/:id/complete`
- `DELETE /attachments/:id`
- `GET /sync/changes?cursor=...`
- `POST /sync/mutations`
- `GET /sync/status`

上传采用“短期上传意图 + 一次性上传令牌 + 完成确认”流程；完成前扫描状态门控，
扫描失败返回 `ATTACHMENT_SCAN_FAILED` 且附件不可用于 OCR；失败不会产生悬空正式附件。

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
