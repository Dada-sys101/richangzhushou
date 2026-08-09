# V1.5 PR1：RRULE 数据库 Expand

状态：实现中，默认不启用。

基线：`docs/40-v15-final-development-baseline.md`

目标分支：`codex/v15-integration-foundation`

## 范围

本 PR 只执行数据库渐进迁移的 Expand 阶段：

- 新增 `ReminderRecurrenceRule`；
- 新增 `ReminderRecurrenceException`；
- 新增 RRULE、时间语义、回填状态和例外类型枚举；
- 为 `Reminder` 增加可选反向关系；
- 保留并继续支持原有 `schedule_type`、`recurrence_json`、`starts_at` 和 `scheduled_at`；
- 不回填存量数据；
- 不双读；
- 不切换调度器；
- 不改变 API、UI 或用户行为。

迁移目录：

```text
apps/api/prisma/migrations/20260809033010_v15_expand_rrule/
└── migration.sql
```

## 数据兼容性

旧 Reminder 可以在没有 `ReminderRecurrenceRule` 的情况下继续创建、读取、更新、删除和恢复。

新关系为：

```text
Reminder 1 ─── 0..1 ReminderRecurrenceRule
ReminderRecurrenceRule 1 ─── 0..* ReminderRecurrenceException
ReminderRecurrenceRule 1 ─── 0..* childRules
```

删除规则：

- 删除 Reminder：级联删除 Rule 和 Exception；
- 删除 Rule：级联删除 Exception；
- 删除父 Rule：子 Rule 的 `parentRuleId` 置空；
- 不删除或改写旧 Reminder 字段。

## 验证门禁

自动化验证至少包括：

1. Prisma schema validate/generate；
2. 空 MySQL 数据库完整应用全部迁移；
3. 两张新表、枚举列、索引和外键的实际数据库断言；
4. 新表 CRUD、一对一、唯一约束、外键和级联行为；
5. 旧 Reminder 在新表为空时保持原行为；
6. 原 `recurrence.util.test.ts` 完整执行；
7. 新增 `reminders.service.test.ts` 锁定旧服务行为；
8. 原 `wp5.integration.test.ts` 完整执行且不得跳过；
9. API 全量单元、集成、构建、类型和格式检查。

## 回滚

### 尚未应用迁移

直接撤回本 PR，不产生数据层影响。

### 仅在隔离测试数据库应用

按外键顺序执行：

```sql
DROP TABLE IF EXISTS `reminder_recurrence_exceptions`;
DROP TABLE IF EXISTS `reminder_recurrence_rules`;
```

随后将 Prisma schema 恢复到 PR1 前版本，并对该一次性测试数据库重新执行迁移。

### 未来已存在新表数据

本 PR 不允许部署生产。若后续环境已经产生新表数据，禁止直接删除；必须先导出并核对 Rule/Exception 数据，再由独立回滚方案处理。

## 门禁声明

本 PR 不关闭人工门禁 1～8，也不授权：

- 合并 `main`；
- 部署生产；
- 启用新 RRULE 写入、主读或调度器；
- 自动回填或切换存量 Reminder；
- 删除旧字段或旧数据。
