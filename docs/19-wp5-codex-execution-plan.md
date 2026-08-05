# 19 WP5 日程、待办与提醒 — Codex 可执行规划

文档版本：0.1<br>
状态：完成（本地验收通过，报告见 `20-wp5-acceptance-report.md`）<br>
更新：2026-08-05<br>
适用版本：V1.0

## 1. 任务目标

实现 WP5“日程、待办与提醒”：日历事件（CalendarEvent）、待办（Task）、简单重复提醒（Reminder）、今日安排卡片与通知适配器。完成定义：应用内完整可用；外部通知能力按供应商和权限明确降级（`docs/12`）。

## 2. 前置条件与授权边界

- 前置：WP1/WP2/WP3/WP4 已完成本地验收（`docs/13`、`docs/14`、`docs/16`、`docs/18`）。
- 开工前需用户另行授权。建议授权范围：
  - 创建 `codex/wp5-calendar-tasks` 分支；
  - 修改本地代码、Prisma schema/migration、OpenAPI、测试与文档；
  - 安装 WP5 必需的正常开发依赖；
  - 完成本地 checkpoint 与提交；
  - 禁止推送、PR、部署、购买服务、创建云资源、写入真实凭据；
  - 禁止实现 WP6（行程）及之后的业务功能。
- 未授权前不得进入实现。

## 3. 开始前阅读顺序（按 AGENTS.md）

1. `.project/context.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`
5. 当前工作包定义：`docs/12-development-handoff.md`（WP5 部分）与本文件
6. 实现与详细文档：`docs/03-business-rules.md`（BR-CAL-*、BR-TASK-*、BR-REM-*）、`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/08-ui-ux-and-wireframes.md`、`docs/09-test-and-acceptance.md`；现有实现参考 `apps/api/src/{finance,shortcuts,drafts,attachments}`、`apps/web/src/views`、`packages/api-contracts`

## 4. 只读检查（任一不满足即停止并报告）

1. WP4 是否完成并有最终验收报告（`docs/18`）。
2. `npm run quality` 是否通过（或先复跑）。
3. 工作树是否干净、无其他任务修改同一目录。
4. 当前工作包是否已正式切换到 WP5（TODO/MASTER_PLAN/状态文档一致）。

## 5. 设计约束（契约与业务不变量）

- 契约先行：先补全 Calendar/Tasks/Reminders 的 OpenAPI 请求、响应、DTO、错误码与共享类型（含必要新枚举，如 `CalendarEventStatus`），再实现；枚举与数据字典、Prisma、前端映射必须一致。
- 时间（BR-COMMON-001）：API 时间 ISO 8601；业务展示、自然日/自然月以 `Asia/Shanghai` 计算；全天日程使用本地日期边界（BR-CAL-001）。
- 日程（BR-CAL-001/002）：结束时间不得早于开始时间，违规拒绝；时间重叠仅提示冲突，不阻止创建。
- 待办（BR-TASK-001）：状态为 `OPEN`、`COMPLETED`、`CANCELLED`；过期是计算状态，不单独持久化；完成/取消写入明确时间。
- 提醒（BR-REM-001）：V1 支持一次性和日/周/月简单重复；复杂日历规则进入 V1.1。
- 提醒抑制（BR-REM-002）：账号 `CLOSED`/`SUSPENDED`/`DELETION_PENDING` 或通知权限撤销时不发送提醒，并保留可诊断状态（`ReminderStatus`：`SCHEDULED`/`SENT`/`CANCELLED`/`FAILED`/`SUPPRESSED`）。
- 调度（`docs/07`）：数据库记录 + 单进程周期扫描；领取任务时使用原子状态更新避免重复发送；不引入消息队列；多实例部署前必须引入数据库租约或等价互斥（V1 按单实例实现）。
- 通知适配器：应用内提醒 + 通知适配器接口（支持时 Web Push）；无推送权限时保留应用内提醒并显示“通知未开启”（`docs/06` 外部集成降级）。
- 用户隔离：所有资源强制 `userId` 范围；跨用户访问返回 404（延续 QA-SEC-001）；管理员默认不能调用用户日程/待办/提醒正文 API（延续 QA-SEC-002）。
- 可同步资源遵循 `docs/05` 通用约定：`version` + `createdAt`/`updatedAt`/`deletedAt` 软删除；修改携带当前 `version`，过期返回 `VERSION_CONFLICT`；创建支持 `clientMutationId` 幂等（与 WP3/WP4 模式一致，供 WP7 同步落地）。
- 高风险操作（批量删除/清空）必须二次确认并审计（BR-AI-004，沿用 WP4 `confirmationToken` 模式）。
- 日志禁止记录用户正文等敏感内容；所有写接口提供字段错误、权限错误、幂等冲突、版本冲突与服务不可用状态。

## 6. Checkpoints（逐个实现并验证）

1. OpenAPI、共享类型、错误码与契约测试：`/calendar-events`、`/tasks`、`/reminders` 端点、DTO 与枚举；新错误码与 `CalendarEventStatus` 等枚举同步到数据字典与 Prisma。
2. Prisma 实体、约束、索引、migration、seed 与回滚说明：`CalendarEvent`、`Task`、`Reminder`；简单重复表示（一次性/日/周/月）、软删除、`version`、用户索引与时间索引。
3. 日程 CRUD：时间校验（结束 ≥ 开始、全天日期边界）、重叠冲突提示（不阻止）、软删除/恢复。
4. 待办 CRUD 与状态机：`OPEN`/`COMPLETED`/`CANCELLED` 转换、完成/取消时间、逾期计算字段（计算状态，不持久化）。
5. 提醒 CRUD 与重复展开：一次性/日/周/月重复的生成与边界计算（`Asia/Shanghai`）；账号状态与权限撤销的抑制规则。
6. 提醒调度器：数据库记录 + 单进程周期扫描；原子领取、防重复发送、失败重试上限与 `FAILED`/`SUPPRESSED` 诊断状态；多实例租约预留说明。
7. 通知适配器与前端：`NotificationAdapter` 接口 + 假实现/应用内展示；今日安排卡片、日程页、待办页、提醒设置页；错误与网络失败状态、通知权限拒绝降级文案。
8. 集成、并发、安全、前端与浏览器验收；文档、状态与 WP5 验收报告（`docs/20-wp5-acceptance-report.md`）同步。

## 7. 强制测试与停止条件

- QA-CAL-001：结束早于开始被拒绝；重叠仅提示不阻止创建。
- QA-TASK-001：完成、延期、取消与逾期计算正确（含 `Asia/Shanghai` 边界）。
- QA-REM-001：关闭、暂停或权限撤销的用户不发送提醒；已调度提醒进入可诊断状态。
- 提醒调度：同一提醒不重复发送（原子领取）；日/周/月重复在时区边界计算正确。
- 幂等与版本：相同 `clientMutationId` 重放返回原结果，不同内容返回冲突；PATCH 携带过期 `version` 返回 `VERSION_CONFLICT`。
- QA-SEC-001/002（延续）：跨用户访问 404；管理员访问用户内容 API 403。
- 集成测试在真实 MySQL 空库通过（WP2+WP3+WP4+WP5 全量）；`prisma migrate deploy` 空库成功。
- `npm run quality` 与 `git diff --check` 通过。
- 浏览器矩阵 375/390/430/768/1440：今日安排、日程、待办、提醒主流程与错误状态（校验失败、网络失败、通知权限拒绝）无横向溢出，控制台 0 error / 0 warning。
- 文档、状态与 WP5 验收报告与实际一致；WP5 本地提交完成；不进入 WP6。

## 8. 风险与未决（不阻塞实现，需记录）

- 通知渠道未确认（OPEN-005）：应用内提醒完整可用；真实 Web Push/系统通知验收阻塞公开试用，不阻塞本地实现。
- PWA 通知在设备、权限和系统策略下不稳定（RISK-001）：应用内明确提醒状态；V1.1 评估原生应用与替代渠道。
- 重复提醒与多实例并发：V1 单进程原子领取；多实例部署前必须引入数据库租约（`docs/07`）。
- `CalendarEventStatus` 等新枚举取值若数据字典未定义，需标注 `[关键假设]` 并记入 `docs/decisions.md`（延续 DEC-112 做法）。
- 浏览器 QA 未固化为仓库内一键脚本（OPEN-009）：继续使用 `playwright-cli` 产物并记录证据。
- WP5 的 `version`/`clientMutationId` 契约需与 WP7 同步语义保持一致。
