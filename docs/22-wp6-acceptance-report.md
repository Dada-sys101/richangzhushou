# 22 WP6 行程 —— 本地验收报告

文档版本：1.0<br>
状态：已与代码、Git 历史交叉核对<br>
更新：2026-08-06<br>
适用版本：V1.0

## 1. 验收结论

WP6「行程」已在本机完成实现并通过验收：
- 契约先行：Trips/TripItems/PackingItems 的 OpenAPI 请求/响应/DTO/枚举同步，
  `TripItemType`（TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）、`TripExpenseSummary`、
  `TripDetailResponse`、`TripItemOutOfRangeWarning` 与 `Transaction.tripId`；
  契约测试 127/127 通过。
- 数据：`trips`、`trip_items`、`packing_items` 三张表与 `transactions.trip_id`
  外键/索引；migration `20260806011520_wp6_trips` 在空库 MySQL 8.4.9 部署通过，
  seed 演示行程/节点/行李通过。
- 后端：行程/节点/行李 CRUD（软删除/恢复、幂等、版本并发、position 排序），
  超范围节点“未确认不保存、确认后保存并返回提示”，交易关联行程（跨用户 404），
  服务端定点费用汇总（已确认未删除支出减退款），行程详情返回日期范围内日历事件。
- 前端：行程列表/详情/节点/行李/费用汇总/关联账单/日历跳转/记账表单行程选择，
  首页“行程”与“最近行程”入口；错误与网络失败状态沿用统一错误展示。
- 安全：跨用户访问 404、管理员访问用户内容 403 均通过集成测试。

## 2. 强制测试结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| `npm run quality`（格式/Lint/类型/单测/构建/Prisma/OpenAPI/migration diff/审计） | PASS | 本次复跑 |
| 空库 `prisma migrate deploy`（5 migrations）+ seed（`SEED_DEMO_USER=true`） | PASS | `daily_assistant_wp6_verify` / `daily_assistant_wp6_browser` |
| API 单元测试 | PASS（29/29） | `apps/api/src` |
| 契约测试 | PASS（127/127） | `packages/api-contracts` |
| 集成测试（WP2+WP3+WP4+WP5+WP6） | PASS（55/55） | `TEST_DATABASE_URL` 真库 |
| QA-TRIP-001：关联账单汇总（支出 100.00 + 退款 20.00 → 80.00；只计 CONFIRMED 未删除；跨用户不可关联） | PASS | `wp6.integration.test.ts` |
| BR-TRIP-001：结束日期早于开始日期被拒绝 | PASS | `wp6.integration.test.ts` |
| BR-TRIP-002：超范围节点未确认不保存、确认后保存并返回 `TRIP_ITEM_OUT_OF_RANGE` | PASS | `wp6.integration.test.ts` + 浏览器 |
| 幂等与版本冲突（`clientMutationId` 重放/冲突、`VERSION_CONFLICT`） | PASS | `wp6.integration.test.ts` |
| 并发幂等创建只生成一条记录 | PASS | `wp6.integration.test.ts` |
| QA-SEC-001/002 延续：跨用户 404、管理员 403 | PASS | `wp6.integration.test.ts` |
| 浏览器矩阵 375/390/430/768/1440（行程列表 + 详情，含节点/行李/费用/关联账单/日历入口） | PASS（10/10 无横向溢出） | `output/playwright/wp6/overflow-results.txt` |
| 浏览器主流程（登录 → 行程列表 → 校验失败 → 新建 → 详情 → 超范围确认 → 行李勾选 → 日历跳转 → 关联账单） | PASS | `output/playwright/wp6/*.png` |
| 控制台 | 主流程 0 warning；仅预期 1 条 400 校验请求日志 | `output/playwright/wp6/console.log` |
| `git diff --check` | PASS | 提交前检查 |

## 3. 修改文件

- 契约：`packages/api-contracts/src/{enums,types}.ts`、`enums.test.ts`、
  `test/openapi.test.ts`、`openapi/openapi.yaml`
- 数据：`apps/api/prisma/schema.prisma`、`prisma/migrations/20260806011520_wp6_trips`、
  `prisma/seed.ts`、`prisma/migrations/README.md`
- 后端：`apps/api/src/trips/*`、`apps/api/src/finance/{dto,service,mapper}.ts`、
  `apps/api/src/drafts/drafts.service.ts`、`apps/api/src/shortcuts/dto/shortcuts.dto.ts`、
  `apps/api/src/app.module.ts`、`apps/api/src/integration/wp6.integration.test.ts` 及
  wp2–wp5 集成测试 reset 扩展
- 前端：`apps/web/src/{api/client.ts,router.ts,stores/{finance,trips}.ts,styles.css}`、
  `apps/web/src/views/{TripsView,TripDetailView,TransactionFormView,HomeView,CalendarView}.vue`
- 文档与状态：`docs/03/05/06/08/09/12/21/22`、`docs/{README,progress,roadmap,changelog,decisions}.md`、
  `.project/{context,session,decisions}.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、
  `TODO.md`、`MASTER_PLAN.md`、`CHANGELOG.md`

## 4. 未验证内容与阻塞

- 远端 CI 仍未运行（分支未推送，需用户授权）。
- 真实 OCR/对象存储/通知/邮件供应商未接入（OPEN-003/004/005/006），WP6 不依赖这些能力。
- 浏览器 QA 仍使用 `playwright-cli` 产物，未固化为仓库内一键脚本（OPEN-009）。
- 网络失败路径未单独模拟，沿用客户端统一错误处理（与 WP3–WP5 一致）。
- 未推送、未部署、未创建生产资源、未进入 WP7。

## 5. 关键假设

- `TripItemType` 取值（TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）为 `[关键假设]`
  （见 `docs/decisions.md` DEC-121），待产品确认。
- 行程详情聚合（含日期范围内日历事件与关联账单）为 `docs/12` “日程关联入口”
  的最小实现形态，未新增跨实体外键（见 DEC-122/DEC-123）。
- WP6 未提供批量删除/清空节点或行李端点；后续新增时须按 BR-AI-004 二次确认并
  写脱敏审计（DEC-125）。
