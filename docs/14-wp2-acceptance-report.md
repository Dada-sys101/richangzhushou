# 14 WP2 验收报告

报告版本：2.0<br>
日期：2026-08-05（v1.0 首次验收；v2.0 复核）<br>
分支：`codex/wp2-identity-capacity`（未推送）<br>
结论：WP2 本地验收通过，v2.0 复核再次通过；未推送、未部署、未进入 WP3

## 范围结论

- 契约先行：`packages/api-contracts` 的 OpenAPI 3.1、共享类型、错误码与账号状态机已更新，并通过契约测试。
- 数据：Prisma 新增 `SystemSetting`、`User`、`Session`、`RecoveryCode`、`InviteCode`、`InviteRedemption`、`AdminAudit`；首个真实 migration `20260805000000_wp2_identity_capacity` 已在本机便携 MySQL 8.4 空库执行通过。
- 身份：Argon2id 密码哈希；短期访问令牌只由前端内存保存；刷新令牌为 HttpOnly/Secure/SameSite Cookie，数据库仅保存 SHA-256 哈希，支持轮换、单设备撤销和全部撤销。
- 容量：注册、恢复、关闭、暂停、删除申请和容量设置变更锁定 `SystemSetting` 单例行；锁顺序固定为 SystemSetting → InviteCode；可重试数据库冲突有上限重试。
- 账号：`ACTIVE`、`SUSPENDED` 占容量；`CLOSED`、`DELETION_PENDING`、`DELETED` 不占；关闭/暂停/删除申请立即撤销会话；CLOSED 用户只能通过短期单用途恢复凭证重新激活。
- 管理端：独立角色守卫；所有管理写操作要求原因并写入脱敏、不可由产品 API 删除的 `AdminAudit`；管理员默认不能访问用户生活数据正文。
- 邮件：通过 `MailAdapter` 接入；测试使用内存假实现，不向日志/stdout 输出重置令牌。
- 默认设置：`registrationEnabled=false`、`inviteRequired=true`、`maxActiveUsers=20`；提供一次性管理员 bootstrap CLI，无管理员公开注册接口。

## 2026-08-05 复核记录（v2.0）

在全新空库上重新执行真实验收：

| 检查 | 结果 |
| --- | --- |
| `npm run quality`（格式、Lint、类型、单测、构建、Prisma、OpenAPI、migration diff、依赖审计） | PASS |
| 空库 `prisma migrate deploy`（MySQL 8.4.9，`daily_assistant_wp2_verify`） | PASS |
| `prisma:seed` | PASS，默认 `registrationEnabled=false`、`inviteRequired=true`、`maxActiveUsers=20` |
| `npm run test:integration`（真实 MySQL） | PASS，18/18 |
| 用户端浏览器矩阵 375/390/430/768/1440（`/register`、`/login`、`/account`） | PASS，无横向溢出；注册（430）与登录（375）主流程通过 |
| 管理端浏览器矩阵 375/390/430/768/1440（`/login`、`/dashboard`、`/invites`、`/users`、`/settings`、`/audits`） | PASS，无横向溢出；设置保存与邀请码创建通过 |
| 控制台 | 0 error / 0 warning（仅 Chromium 内部 DOM 无障碍提示，非页面错误） |
| `git diff --check` | PASS |

复核产物：`output/playwright/wp2/.playwright-cli/`（时间戳截图与快照，gitignored）。

## 自动化验收证据

| 检查 | 命令/路径 | 结果 |
| --- | --- | --- |
| 格式 | `npm run format:check` | PASS |
| Lint | `npm run lint` | PASS |
| 类型 | `npm run typecheck` | PASS，5 workspaces |
| 单元/契约/HTTP 测试（无 DB 环境） | `npm test` | PASS |
| 集成测试（真实 MySQL） | `TEST_DATABASE_URL=... npm run test:integration --workspace @daily-assistant/api` | PASS，21 tests |
| 构建 | `npm run build` | PASS，5 workspaces |
| Prisma validate | `npm run validate:prisma` | PASS |
| OpenAPI lint | `npm run validate:openapi` | PASS |
| Migration diff | `npm run validate:migration` | PASS（schema 与 migration 内容一致） |
| 空库 migration | `prisma migrate deploy`（便携 MySQL 8.4.9） | PASS |
| 依赖审计 | `npm run audit:dependencies` | PASS，0 vulnerability |
| Git 空白错误 | `git diff --check` | PASS |

## 强制验收场景映射

| 场景 | 结果 |
| --- | --- |
| QA-CAP-001：上限 20、占用 19、有效邀请码注册成功 | PASS |
| QA-CAP-002：占用 20 时返回 `CAPACITY_REACHED` 且不消耗邀请码 | PASS |
| QA-CAP-003：两个独立数据库连接争抢最后名额仅一个成功 | PASS（两个独立 Nest 应用/Prisma 连接并发请求） |
| QA-CAP-004：关闭 ACTIVE 用户立即释放容量并撤销会话 | PASS |
| QA-CAP-005：满员时 CLOSED 用户恢复失败且保持 CLOSED | PASS |
| QA-CAP-006：SUSPENDED 用户仍占容量且不能登录 | PASS |
| QA-SEC-001：用户 A 不能观察/撤销用户 B 的会话 | PASS |
| QA-SEC-002：管理员不能调用用户账单/日程/待办/行程正文 API | PASS（WP3+ 路由尚未实现，管理员调用返回 404） |
| QA-SEC-003：数据库无邀请码/刷新令牌/恢复凭证明文 | PASS |
| QA-SEC-004：日志与内存邮件适配器不输出认证秘密 | PASS（单元测试断言） |
| 刷新令牌轮换后旧令牌失效、新令牌可用 | PASS |
| 全部会话撤销后所有刷新令牌失效 | PASS |
| 密码重置非枚举、单用途、重置后旧会话失效 | PASS |
| 忘记密码限流（5 次后第 6 次 429） | PASS |
| 容量上限不能降到当前占用量以下 | PASS |
| 所有管理写操作产生脱敏审计 | PASS |
| 邀请码明文只展示一次，数据库只存哈希与安全前缀 | PASS |

## 浏览器验收（Playwright CLI）

使用 `playwright-cli` 对本地 API（3000）、用户端（5173）、管理端（5174）与便携 MySQL 完成：

- 用户端注册（邀请码）、登录、账号页主流程通过；账号页展示昵称/邮箱/状态。
- 管理端登录、概览、邀请码创建（明文只显示一次）、用户、设置、审计页主流程通过。
- 375/390/430/768/1440 CSS px 下，注册、登录、账号、管理登录、概览、邀请码、用户、设置、审计页均无横向溢出（`scrollWidth === clientWidth`）。
- 新会话控制台 0 error / 0 warning。
- 产物：`output/playwright/wp2/`（部分文件被 gitignore）。

## 复现命令

准备 MySQL 8.x 后：

```powershell
$env:DATABASE_URL='mysql://<user>:<password>@127.0.0.1:3306/<database>'
npm run prisma:migrate:deploy --workspace @daily-assistant/api
npm run prisma:seed --workspace @daily-assistant/api
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run test:integration --workspace @daily-assistant/api
npm run quality
```

管理员 bootstrap：

```powershell
$env:ADMIN_BOOTSTRAP_PASSWORD='<至少12位本地密码>'
npm run bootstrap:admin --workspace @daily-assistant/api -- --email=admin@example.com
```

## 边界与剩余项

- 当前分支未推送；GitHub Actions 的 WP2 集成测试步骤已配置但未远端执行。
- 便携 MySQL 8.4 位于 `C:\Users\hebia\.codex\mysql8`（仓库外），不随仓库分发。
- 邮件使用内存假实现；真实邮件供应商与强制邮箱验证策略（OPEN-003/OPEN-008）未确认，公开试用前需决策。
- 浏览器验收使用 `playwright-cli` 产物，尚未固化为仓库内一键脚本（OPEN-009）。
- 未创建生产资源、未部署、未推送、未创建 PR；WP3 及以后业务未实现。
