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
