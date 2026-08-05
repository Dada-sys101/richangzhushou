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
