# 16 WP3 验收报告

报告版本：1.0<br>
日期：2026-08-05<br>
分支：`codex/wp3-finance`（未推送）<br>
结论：WP3 本地验收通过；未推送、未部署、未进入 WP4

## 范围结论

- 契约先行：`packages/api-contracts` 的 OpenAPI 3.1、共享类型、错误码与 Finance 契约（账单、分类、账户、预算、统计、CSV）已补全并通过契约测试。
- 数据：Prisma 新增 `Category`、`FinancialAccount`、`Transaction`、`Budget` 与枚举 `CategoryKind`、`FinancialAccountKind`；新 migration `20260805080803_wp3_finance` 已在便携 MySQL 8.4 空库执行通过。
- API：账单 CRUD/软删除/恢复、疑似重复提示、分类/账户 CRUD（归档而非物理删除）、预算 CRUD 与自然月校验、统计摘要与今日卡片、CSV 导出均已实现，并通过真实 MySQL 集成测试。
- 安全：所有 Finance 路由要求 `USER` 角色（管理员默认不能调用用户内容 API，延续 QA-SEC-002）；所有用户资源强制 `userId` 范围，跨用户访问返回 404/400。
- 前端：用户端新增今日财务卡片、账单列表/表单、分类、账户、预算页面与 CSV 导出；375/390/430/768/1440 无横向溢出，主流程与错误状态通过。

## 验收证据

| 检查 | 结果 |
| --- | --- |
| `npm run quality`（格式、Lint、类型、单测、构建、Prisma、OpenAPI、migration diff、依赖审计） | PASS |
| 空库 `prisma migrate deploy`（MySQL 8.4.9，全新 `daily_assistant_wp3_browser`） | PASS，2 个 migration |
| `prisma:seed`（含 `SEED_DEMO_USER=true` 演示数据） | PASS |
| `npm run test:integration`（真实 MySQL，WP2+WP3） | PASS，29/29（WP2 18 + WP3 11） |
| 单元测试（金额精度、时区边界、服务业务规则） | PASS，18/18 |
| `git diff --check` | PASS |
| 浏览器矩阵 375/390/430/768/1440（首页、账单、表单、预算、分类、账户） | PASS，30/30 无横向溢出 |
| 浏览器主流程：登录、新增支出、编辑、删除/恢复、今日卡片、预算、CSV、校验失败、网络失败 | PASS |
| 控制台 | 0 error / 0 warning（网络失败测试中仅预期内的请求失败日志） |

## 强制验收场景映射

| 场景 | 结果 |
| --- | --- |
| QA-FIN-001：`0.10 + 0.20` 等金额累计无浮点误差 | PASS（汇总返回 `0.30`，Decimal 精确计算） |
| QA-FIN-002：退款正确冲减支出；负数金额被拒绝 | PASS（支出 100.00 + 退款 20.00 → netExpense `80.00`；`-5.00` 返回 400） |
| QA-FIN-003：软删除后统计排除、恢复后重新计入 | PASS |
| QA-FIN-004：疑似重复提示且不自动删除 | PASS（同商户/同指纹 10 分钟窗口返回 `POSSIBLE_DUPLICATE`，6 条记录全部保留） |
| QA-SEC-001（延续）：用户 A 不能读取/修改用户 B 的账单、分类、账户与预算 | PASS（全部 404；跨用户退款引用返回 400） |
| QA-SEC-002（延续）：管理员不能调用用户内容 API | PASS（Finance 路由统一 403；管理员无用户内容读取接口） |
| 预算自然月边界（Asia/Shanghai） | PASS（UTC `2026-07-31T16:00:00.000Z` 计入 8 月） |
| 预算唯一约束与进度 | PASS（整体预算重复创建 409；进度 `spent/amount` 精确） |
| 幂等创建（相同键重放、不同内容冲突） | PASS |
| 版本冲突 | PASS（PATCH 携带过期 version 返回 409 `VERSION_CONFLICT`） |
| CSV 导出 | PASS（仅当前用户、UTF-8 BOM、安全文件名、内容含正确列与数据） |

## 浏览器验收记录（Playwright CLI）

- 使用 `playwright-cli` 会话完成登录（demo@example.com）后逐页检查。
- 5 宽度矩阵：`/`、`/transactions`、`/transactions/new`、`/finance/budgets`、`/finance/categories`、`/finance/accounts` 共 30 项，`scrollWidth === clientWidth`。
- 主流程：新增支出 88.88 → 编辑为 99.99 → 删除（空状态出现）→ 显示已删除 → 恢复；今日卡片显示今日支出 ¥99.99；创建整体预算 1000.00 后进度显示 10%；CSV 导出无报错；金额留空提交显示校验错误；API 停止后页面显示“服务暂时不可用，请稍后重试”且无横向溢出。
- 修复记录：浏览器验收中发现查询 DTO 编译元数据丢失（控制器误用 `import type`）与非 JSON 错误体导致的异常文案，已修复并复验（提交 `3db5b40`）。

## 复现命令

```powershell
$env:DATABASE_URL='mysql://root@127.0.0.1:3307/<空库>'
npm run prisma:migrate:deploy --workspace @daily-assistant/api
$env:SEED_DEMO_USER='true'; npm run prisma:seed --workspace @daily-assistant/api
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run test:integration --workspace @daily-assistant/api
npm run quality
git diff --check
```

## 边界与剩余项

- 当前分支未推送；GitHub Actions 远端 CI 未执行（需推送授权）；未创建生产资源、未部署。
- `CategoryKind`/`FinancialAccountKind` 取值为 WP3 补充的 `[关键假设]`（`docs/decisions.md` DEC-112），待产品确认。
- 整体预算（`categoryId IS NULL`）唯一性由服务层校验，因为 MySQL 唯一索引允许多个 NULL；并发下存在极小概率重复，V1 规模可接受并已记录。
- 原账单被软删除后，其退款仍按退款计入统计（不自动联动删除），属边界行为，已在实现中明确。
- 统计摘要按 V1 默认币种 CNY 汇总；多币种汇总能力不在 WP3 范围。
- CSV 导出单次上限 10,000 行（V1 10–20 人规模足够）。
- 浏览器 QA 仍依赖 `playwright-cli` 与本机服务，未固化为仓库内一键脚本（OPEN-009）。
- WP2 验收报告中“管理员访问 `/transactions` 返回 404”的表述已随 WP3 路由实现更新为 403（`UserOnlyGuard`），语义为“管理员不能调用用户内容 API”。
- 未进入 WP4；WP4 快捷指令、OCR、统一录入及之后业务均未实现。
