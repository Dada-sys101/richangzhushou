# 20 WP5 日程、待办与提醒 — 本地验收报告

文档版本：1.0<br>
状态：已与代码、Git 历史交叉核对<br>
更新：2026-08-05<br>
适用版本：V1.0

## 1. 验收结论

WP5「日程、待办与提醒」已在本地完成实现并通过验收：

- 契约先行：Calendar/Tasks/Reminders 的 OpenAPI 请求/响应/DTO/枚举同步，
  契约测试 118/118 通过。
- 数据：`calendar_events`、`tasks`、`reminders` 三张表与
  `CalendarEventStatus`、`ReminderScheduleType`、`ReminderTargetType`
  枚举；migration `20260805095154_wp5_calendar_tasks_reminders` 在空库
  MySQL 8.4.9 部署通过，seed 演示数据（日程/待办/提醒）通过。
- 后端：日程 CRUD（时间校验、重叠提示、软删除/恢复、幂等/版本）、待办
  CRUD 与状态机（完成/取消时间、过期计算）、提醒 CRUD 与重复展开
  （一次性/日/周/月，`Asia/Shanghai` 边界）、提醒调度器（原子领取、防重、
  失败重试上限、`FAILED`/`SUPPRESSED`）、`NotificationAdapter` 与本地假实现。
- 前端：今日安排卡片、日程页、待办页、提醒设置页，通知权限未授权时显示
  “通知未开启”降级提示。
- 安全：跨用户访问 404、管理员访问用户内容 403 均通过集成测试。

## 2. 强制测试结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| `npm run quality`（格式/Lint/类型/单测/构建/Prisma/OpenAPI/migration diff/审计） | PASS | 本次复跑 |
| 空库 `prisma migrate deploy`（4 migrations）+ seed（`SEED_DEMO_USER=true`） | PASS | `daily_assistant_wp5_verify` |
| API 单元测试 | PASS（29/29） | `apps/api/src` |
| 契约测试 | PASS（118/118） | `packages/api-contracts` |
| 集成测试（WP2+WP3+WP4+WP5） | PASS（48/48） | `TEST_DATABASE_URL` 真库 |
| QA-CAL-001：结束早于开始拒绝；重叠仅提示 | PASS | `wp5.integration.test.ts` |
| QA-TASK-001：完成/延期/取消/过期计算 | PASS | `wp5.integration.test.ts` |
| QA-REM-001：关闭/暂停/权限撤销抑制提醒 | PASS | 调度器集成测试 |
| 调度器原子领取与并发防重 | PASS | 并发双跑仅一次发送 |
| 失败重试上限与 `FAILED` 可诊断状态 | PASS | 3 次后终止并保留原因 |
| 幂等与版本冲突 | PASS | `clientMutationId` 重放/冲突、`VERSION_CONFLICT` |
| QA-SEC-001/002 延续：跨用户 404、管理员 403 | PASS | 集成测试 |
| 浏览器矩阵 375/390/430/768/1440（首页/日程/待办/提醒） | PASS（20/20 无横向溢出） | `output/playwright/wp5/` |
| 浏览器主流程（登录→今日安排→建日程→错误校验→建待办→完成→建提醒→权限提示） | PASS | playwright-cli 快照 |
| 控制台 | 主流程 0 error / 0 warning；仅预期 400 校验请求日志 | `.playwright-cli/console-*` |
| `git diff --check` | PASS | 提交前检查 |

## 3. 修改文件

- 契约：`packages/api-contracts/src/{enums,types}.ts`、
  `packages/api-contracts/test/openapi.test.ts`、`openapi/openapi.yaml`
- 数据：`apps/api/prisma/schema.prisma`、
  `prisma/migrations/20260805095154_wp5_calendar_tasks_reminders`、
  `prisma/seed.ts`、`prisma/migrations/README.md`
- 后端：`apps/api/src/{calendar,tasks,reminders}`、
  `apps/api/src/integrations/{integrations.types,fake-notification.adapter,integrations.module}.ts`、
  `apps/api/src/app.module.ts`、`apps/api/src/integration/wp5.integration.test.ts`
- 前端：`apps/web/src/{api/client.ts,router.ts,stores/planner.ts,utils/time.ts}`、
  `apps/web/src/views/{HomeView,CalendarView,TasksView,RemindersView}.vue`、
  `apps/web/src/styles.css`
- 文档与状态：`docs/05/06/07/08/09/12/19/20`、`docs/{progress,roadmap,changelog,README}.md`、
  `docs/decisions.md`、`.project/{context,session,decisions}.md`、
  `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`MASTER_PLAN.md`、`CHANGELOG.md`

## 4. 未验证内容与阻塞

- 远端 CI 仍未运行（分支未推送，需用户授权）。
- 真实 Web Push/系统通知通道未接入（OPEN-005）：应用内提醒完整可用，
  浏览器通知权限未授权时显示降级提示；真实推送验收不阻塞 V1 本地实现。
- 浏览器 QA 仍使用 `playwright-cli` 产物，未固化为仓库内一键脚本（OPEN-009）。
- 提醒调度器当前按单进程周期扫描实现；多实例部署前必须引入数据库租约或等价互斥
  （已在 `docs/07` 说明）。
- 未推送、未部署、未创建生产资源、未进入 WP6。

## 5. 关键假设

- `CalendarEventStatus`（SCHEDULED/CANCELLED）、`ReminderTargetType`
  （含 STANDALONE）与提醒 `title`/`note` 字段为 `[关键假设]`，待产品确认
  （见 `docs/decisions.md` DEC-117/DEC-118）。
- 提醒 `recurrenceJson` 为 `{ interval?, weekdays?, dayOfMonth?, until? }`；
  `startsAt` 作为重复规则锚点持久化；`scheduledAt` 恒为下一次应发送时间。
