# Prisma migrations

WP1 establishes the MySQL datasource and shared enums only. It deliberately adds no
business tables, so the offline `prisma migrate diff --from-empty --to-schema ...`
result is empty. WP2 created the first schema migration together with its models,
rollback notes, and concurrency tests. WP3 adds the Finance tables.

To verify migrations against a real empty MySQL 8 database, create an untracked
`apps/api/.env` from `.env.example`, provision a local disposable database, and run:

```powershell
npm run prisma:migrate:deploy --workspace @daily-assistant/api
```

For the V1.5 PR6a disposable MySQL 8.4 workflow, point the explicit admin URL at
the `mysql` system database on a temporary server and run:

```powershell
$env:PR6A_MYSQL_ADMIN_URL = "mysql://<temporary-admin>@127.0.0.1:3306/mysql"
npm run validate:mysql84:temporary
```

This entry is loopback-only with no remote override. It creates a random target
database, task-owned guard database, and scoped temporary user. The admin
credential is never sent to migration or Vitest child processes. After all
migrations, integration tests, and the isolation check, it drops the databases
and user and verifies that both residual counts are zero.

No production or shared database URL belongs in this repository.

## WP4 Shortcuts/OCR migration（20260805085724_wp4_shortcuts_ocr）

- 新增表：`device_credentials`、`attachments`、`draft_records`；新增枚举
  `AttachmentScanStatus`（PENDING/SCANNED/FAILED）、`AttachmentOwnerType`
  （TRANSACTION_DRAFT）与 `DraftTargetType`（TRANSACTION）。
- 设备凭证：`token_hash` 唯一且只存 SHA-256；`scopes` 以 JSON 数组保存
  `ShortcutScope` 字符串（`transaction:draft:create` / `finance:summary:read`，
  冒号值不适用 MySQL ENUM，因此不使用枚举列）。
- 附件：`object_key` 与 `upload_token_hash` 唯一；上传令牌只存哈希；
  `scan_status` 完成前门控；软删除使用 `deleted_at`。
- 草稿：`client_mutation_id` 唯一用于幂等；`attachment_id` 外键 SetNull；
  `result_id` 在确认后指向正式记录。
- 回滚：`prisma migrate resolve --rolled-back 20260805085724_wp4_shortcuts_ocr`
  后删除该 migration 目录，再 `prisma migrate deploy`；或对非生产库执行
  `DROP TABLE draft_records, attachments, device_credentials`（先删草稿，
  再删附件与凭证，注意外键顺序）。

## WP3 Finance migration（20260805080803_wp3_finance）

- 新增表：`categories`、`financial_accounts`、`transactions`、`budgets`；新增枚举
  `CategoryKind`（EXPENSE/INCOME）与 `FinancialAccountKind`
  （CASH/DEBIT_CARD/CREDIT_CARD/DIGITAL_WALLET/OTHER）。
- 金额统一 `DECIMAL(18,2)`；`transactions.client_mutation_id` 唯一；软删除统一使用
  `deleted_at`（分类与账户使用 `is_archived` 归档，不物理删除）。
- 唯一约束：分类 `(user_id, kind, name)`、账户 `(user_id, name)`、预算
  `(user_id, month, category_id)`。预算 `category_id` 为 NULL（整体预算）时由服务层
  校验同用户同月只能存在一个整体预算，因为 MySQL 唯一索引允许多个 NULL。
- 回滚：`prisma migrate resolve --rolled-back 20260805080803_wp3_finance` 后删除该
  migration 目录，再 `prisma migrate deploy` 到上一个版本；或对非生产库执行
  `DROP TABLE transactions, budgets, financial_accounts, categories`（注意外键顺序）。
- 演示数据：`SEED_DEMO_USER=true npm run prisma:seed --workspace @daily-assistant/api`
  会创建本地演示用户及默认分类/账户；默认密码仅用于本地开发，生产不得使用。

## WP5 Calendar/Tasks/Reminders migration（20260805095154_wp5_calendar_tasks_reminders）

- 新增枚举：`CalendarEventStatus`（SCHEDULED/CANCELLED）、`ReminderScheduleType`
  （ONCE/DAILY/WEEKLY/MONTHLY）与 `ReminderTargetType`
  （CALENDAR_EVENT/TASK/STANDALONE）。
- 新增表：`calendar_events`、`tasks`、`reminders`；软删除、`version` 与
  `client_mutation_id` 唯一键沿用 Finance/草稿的同步资源约定。
- 提醒调度字段：`reminders.attempt_count`/`next_attempt_at`/`last_attempt_at`
  支撑原子领取与失败重试；`recurrence_json` 保存 JSON 重复规则（interval/weekdays/
  dayOfMonth/until）。
- 回滚：`prisma migrate resolve --rolled-back 20260805095154_wp5_calendar_tasks_reminders`
  后删除该 migration 目录，再 `prisma migrate deploy` 到上一个版本；或对非生产库执行
  `DROP TABLE reminders, tasks, calendar_events`（注意外键顺序）。
- 演示数据：`SEED_DEMO_USER=true` 会额外创建日程、待办与提醒的本地演示记录。

## WP6 Trips migration（20260806011520_wp6_trips）

- 新增枚举：`TripItemType`（TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）；新增表：
  `trips`、`trip_items`、`packing_items`；同时给 `transactions` 增加可空
  `trip_id` 外键（ON DELETE SET NULL）和 `(user_id, trip_id)` 索引。
- 行程/节点/行李均支持软删除、`version` 与 `client_mutation_id`
  唯一键，沿用 WP3–WP5 的同步资源约定；`trips.user_id + start_date` 与
  `trip_items/packing_items.trip_id + position` 索引。
- 回滚：`prisma migrate resolve --rolled-back 20260806011520_wp6_trips`
  后删除该 migration 目录，再 `prisma migrate deploy` 到上一个版本；或对非生产库执行
  `DROP TABLE packing_items, trip_items, trips` 并
  `ALTER TABLE transactions DROP FOREIGN KEY transactions_trip_id_fkey, DROP COLUMN trip_id`
  （注意先删子表再删行程，外键顺序）。
- 演示数据：`SEED_DEMO_USER=true` 会创建本地演示行程、节点与行李清单。

## WP7 Sync migration（20260806074500_wp7_sync）

- 新增枚举：`SyncEntityType`（TRANSACTION/CATEGORY/FINANCIAL_ACCOUNT/BUDGET/
  CALENDAR_EVENT/TASK/REMINDER/TRIP/TRIP_ITEM/PACKING_ITEM/DRAFT_RECORD）、
  `SyncAction`（CREATE/UPDATE/DELETE/RESTORE）与 `SyncMutationStatus`
  （APPLIED/CONFLICTED/FAILED）。
- 新增表：`sync_mutations`；`user_id + client_mutation_id` 唯一，
  `request_hash` 保存幂等请求摘要，同键同内容返原结果、同键不同内容返回
  `IDEMPOTENCY_CONFLICT`；`result_ref` 存储应用结果或错误，支持重放。
- `categories`/`financial_accounts`/`budgets` 增加 `client_mutation_id` 唯一列，
  使用户端离线创建的分类/账户/预算也可幂等。
- 为同步游标添加索引：同步实体 `(user_id, updated_at)` 索引；
  `trip_items`/`packing_items` 使用 `(trip_id, updated_at)` 索引（节点属于行程，
  查询通过 `trip.user_id` 隔离）。
- 回滚：`prisma migrate resolve --rolled-back 20260806074500_wp7_sync`
  后删除该 migration 目录，再 `prisma migrate deploy` 到上一个版本；或对非生产库执行
  `DROP TABLE sync_mutations` 并
  `ALTER TABLE categories/financial_accounts/budgets DROP COLUMN client_mutation_id`
  及删除相关索引（注意外键顺序）。

## WP9 Identity & entry simplification（20260806140000_wp9_identity_entry_simplification）

- 变更：`users` 增加 `username`/`normalized_username`（唯一）与
  `must_change_password`，删除 `email`/`normalized_email`；删除
  `recovery_codes`/`invite_codes`/`invite_redemptions` 表；
  `system_settings` 删除 `registration_enabled`/`invite_required`；
  `attachments` 删除 `scan_status`；`RecordSource` 移除 `OCR`。
- 存量数据：`username` 由邮箱本地部分清洗回填（小写、仅 `[a-z0-9_]`、截断 20），
  冲突时按行号追加 `_N`；`normalized_username` 与 `username` 一致。
- 回滚（破坏性，先备份）：`prisma migrate resolve --rolled-back
  20260806140000_wp9_identity_entry_simplification` 后删除该 migration 目录，
  再 `prisma migrate deploy` 到上一个版本；或对非生产库手工重建被删表/列
  （`email`/`normalized_email`、`recovery_codes`、`invite_codes`、
  `invite_redemptions`、`scan_status`、注册/邀请开关列），并按原 schema 回填。
- 演示数据：`SEED_DEMO_USER=true` 创建 `username=demo` 的本地演示账号
  （`must_change_password=false`）；管理员账号用 `bootstrap:admin --username=...` 创建。

## OPEN-007 Account deletion cleanup（20260806092920_open007_account_deletion_cleanup）

- 变更：`users.status` 枚举新增 `DELETION_PROCESSING`；`users` 新增
  `deletion_scheduled_at`/`deletion_started_at`/`deletion_completed_at`/
  `deletion_attempt_count`/`deletion_last_error`/`deletion_lease_expires_at`
  六列，支撑计划删除、原子领取、租约重试与匿名墓碑时间。
- 语义：`DELETION_PENDING` 为保留期内等待；`DELETION_PROCESSING` 为已领取清理中
  （含失败等待租约过期重试）；`DELETED` 为清理完成后的匿名墓碑。清理任务由
  `apps/api/src/account-deletion/*` 实现，配置项见 `.env.example`
  （`ACCOUNT_DELETION_*`），手工执行 `npm run account-deletion:run`。
- 回滚（破坏性，先备份）：`prisma migrate resolve --rolled-back
  20260806092920_open007_account_deletion_cleanup` 后删除该 migration 目录，再
  `prisma migrate deploy` 到上一个版本；或对非生产库执行
  `ALTER TABLE users DROP COLUMN deletion_lease_expires_at, DROP COLUMN
  deletion_last_error, DROP COLUMN deletion_attempt_count, DROP COLUMN
  deletion_completed_at, DROP COLUMN deletion_started_at, DROP COLUMN
  deletion_scheduled_at` 并将 `status` 恢复为不含 `DELETION_PROCESSING` 的
  ENUM（注意先把 `DELETION_PROCESSING` 行重置为 `DELETION_PENDING`）。

## V1.5 PR2 AI DB Expand（20260812120000_v15_expand_ai）

- 变更：仅新增五个枚举与四个 AI 表；不改动任何旧表/旧列。
  - 枚举：`AiRequestStatus`（CLAIMED/RUNNING/SUCCEEDED/FAILED/CANCELLED）、
    `AiProposalStatus`（PENDING_REVIEW/PARTIALLY_APPLIED/APPLIED/REJECTED/EXPIRED/
    FAILED/CANCELLED）、`AiOperationType`（TRANSACTION/CALENDAR_EVENT/TASK/REMINDER/TRIP）、
    `AiOperationStatus`（PENDING/ACCEPTED/REJECTED/APPLIED/FAILED/EXPIRED）、
    `AiProviderAttemptStatus`（RUNNING/SUCCEEDED/FAILED/CANCELLED）。
  - 表：`ai_requests`、`ai_proposals`、`ai_operations`、`ai_provider_attempts`。
- 关系：`AiRequest.userId` → users Cascade；`AiProposal.aiRequestId`（UNIQUE）→
  ai_requests Cascade；`AiProposal.sourceDraftId` → draft_records SetNull；
  `AiOperation.proposalId` → ai_proposals Cascade；`AiOperation.resultDraftId` →
  draft_records SetNull；`AiProviderAttempt.aiRequestId` → ai_requests Cascade。
  `AiRequest.proposalId` 为逻辑标量，无 FK（避免循环引用）。无 raw
  input/prompt/request/response body/credential 字段。
- 唯一约束：`ai_requests.idempotency_key`；`ai_proposals.ai_request_id`；
  `ai_operations.(proposal_id, ordinal)`；`ai_provider_attempts.(ai_request_id, attempt_no)`。
- 索引：`ai_requests.(user_id, status, created_at)`；
  `ai_proposals.(user_id, status, created_at)` 与 `(expires_at)`；
  `ai_provider_attempts.started_at`。不建重复 FK 索引。
- 回滚（破坏性，先备份）：`prisma migrate resolve --rolled-back
  20260812120000_v15_expand_ai` 后删除该 migration 目录，再 `prisma migrate
  deploy` 到上一版本；或对非生产库按 FK 顺序执行
  `DROP TABLE ai_provider_attempts, ai_operations, ai_proposals, ai_requests`。
