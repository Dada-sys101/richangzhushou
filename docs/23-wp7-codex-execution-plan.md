# 23 WP7 PWA 与离线同步 — Codex 可执行规划

文档版本：1.0<br>
状态：已执行（本地验收完成，见 `docs/24-wp7-acceptance-report.md`）<br>
更新：2026-08-06<br>
适用版本：V1.0

## 1. 任务目标

实现 WP7“PWA 与离线同步”：应用安装、本地缓存（IndexedDB）、离线写入队列、同步游标、幂等批处理、冲突页面与账号退出清理。完成定义：核心新增在离线刷新后不丢失，联网后安全同步（`docs/12`）。

## 2. 前置条件与授权边界

- 前置：WP1–WP6 已完成本地验收（`docs/13`、`docs/14`、`docs/16`、`docs/18`、`docs/20`、`docs/22`）；依赖 WP3–WP6 的稳定实体契约。
- 开工前需用户另行授权。建议授权范围：
  - 创建 `codex/wp7-pwa-sync` 分支；
  - 修改本地代码、Prisma schema/migration、OpenAPI、测试与文档；
  - 安装 WP7 必需的正常开发依赖；
  - 完成本地 checkpoint 与提交；
  - 禁止推送、PR、部署、购买服务、创建云资源、写入真实凭据；
  - 禁止实现 WP8（全量质量与发布准备）及之后的业务功能。
- 未授权前不得进入实现。

## 3. 开始前阅读顺序（按 AGENTS.md）

1. `.project/context.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`
5. 当前工作包定义：`docs/12-development-handoff.md`（WP7 部分）与本文件
6. 实现与详细文档：`docs/03-business-rules.md`（BR-SYNC-*、BR-AI-003）、`docs/05-data-model-and-dictionary.md`（SyncMutation 与各同步实体）、`docs/06-api-and-integrations.md`（sync 端点）、`docs/07-technical-architecture-and-security.md`（客户端离线架构）、`docs/08-ui-ux-and-wireframes.md`（SyncBadge/冲突文案）、`docs/09-test-and-acceptance.md`（QA-SYNC-*）；现有实现参考 `apps/api/src/{finance,calendar,tasks,reminders,trips,drafts}`、`apps/web/src/{api,stores,views}`、`apps/web/vite.config.ts`

## 4. 只读检查（任一不满足即停止并报告）

1. WP6 是否完成并有最终验收报告（`docs/22`）。
2. `npm run quality` 是否通过（或先复跑）。
3. 工作树是否干净、无其他任务修改同一目录。
4. 当前工作包是否已正式切换到 WP7（TODO/MASTER_PLAN/状态文档一致）。

## 5. 设计约束（契约与业务不变量）

- 契约先行：先补全 Sync 的 OpenAPI 请求、响应、DTO、错误码与共享类型（`SyncChange`、`SyncMutationRequest`、`SyncStatus`、游标），再实现；枚举与数据字典、Prisma、前端映射一致。
- 服务端主副本（DEC-005）：客户端缓存只是镜像，不产生第二真相；所有写入最终由服务端校验后落库。
- 不引入消息队列、事件总线或额外基础设施（架构不变量）：变更流由数据库记录直接查询聚合；V1 按单实例实现。
- 幂等（BR-SYNC-001/002）：离线写入必须携带用户范围内唯一的 `clientMutationId`；同键同内容返回原结果，同键不同内容返回 `IDEMPOTENCY_CONFLICT`；服务端 `SyncMutation` 保存 `requestHash` 与 `resultRef`。
- 版本与冲突（BR-SYNC-003/004）：敏感字段（金额、时间、状态、删除）基于旧版本修改返回 `VERSION_CONFLICT`，不静默覆盖；普通备注等低风险字段在明确无并发修改时采用最后写入。
- 墓碑：软删除记录在变更流中以下发 `deleted` 变更的形式同步，客户端本地应用墓碑清理，不残留已删除记录。
- 变更流：`GET /sync/changes?cursor=...` 返回当前用户范围内增量（创建/更新/删除），游标单调递增、分页不丢失不重复。
- 用户隔离：同步数据全部按 `userId` 隔离；跨用户访问返回 404（延续 QA-SEC-001）；管理员不能读取用户同步内容（延续 QA-SEC-002）。
- 客户端离线架构（`docs/07`）：IndexedDB 保存用户范围内的近期业务数据、同步游标与待发送队列；本地记录按用户隔离；退出或关闭账号清除可解密本地数据与凭证；Service Worker 只缓存应用外壳，不缓存认证响应或跨用户敏感 API 响应。
- 附件二进制不进入离线同步队列（`[待确认]`：V1 只同步元数据/引用，附件上传仍走在线接口）。
- 同步器按创建顺序重试，采用指数退避并允许用户手动重试；版本冲突进入专门页面，由用户比较选择，不做后台静默覆盖或自动合并。
- 安全：DTO allow-list、登录/同步端点限流、批量大小上限、日志脱敏（不记录用户正文、令牌、完整邮箱）。

## 6. Checkpoints（逐个实现并验证）

1. OpenAPI、共享类型、错误码与契约测试：`GET /sync/changes`、`POST /sync/mutations`、`GET /sync/status` 的请求/响应/DTO；新增错误码（如 `CURSOR_INVALID`、`MUTATION_BATCH_TOO_LARGE`）；契约测试同步。
2. Prisma 实体、约束、索引、migration、seed 与回滚说明：`SyncMutation`（`userId+clientMutationId` 唯一、`requestHash`、`resultRef`、状态与时间字段）；游标方案（基于各实体 `updatedAt`/`version` 的聚合查询或用户级同步游标，实现时以契约与 ADR 为准，不引入消息队列）。
3. 后端变更流：聚合已同步实体（Transaction/Category/FinancialAccount/Budget/CalendarEvent/Task/Reminder/Trip/TripItem/PackingItem/DraftRecord 等）的增量（含墓碑）；游标单调、分页与用户隔离。
4. 后端幂等批处理：`POST /sync/mutations` 批量接收；逐条校验 `clientMutationId` 幂等（同键同内容返回原结果、不同内容冲突）；`requestHash` 校验；写入 `resultRef`；限流与批量上限。
5. 冲突语义：`VERSION_CONFLICT` 返回实体、字段与服务端当前值；低风险字段最后写入策略；冲突结果透传给客户端。
6. 客户端本地层：IndexedDB 用户隔离缓存（近期业务数据、同步游标、待发送队列）；应用启动恢复；退出/关闭账号清理本地数据。
7. 同步器与 UI：拉取变更并应用增量/墓碑；按序推送待发送队列；指数退避与手动重试；`SyncBadge`（已同步/待同步/失败/冲突）与离线横幅。
8. 冲突页面、账号清理、集成/浏览器验收：冲突列表页（比较服务端/本地、选择保留并生成新 mutation）；退出/关闭账号清空 IndexedDB 与会话；文档、状态与 WP7 验收报告（`docs/24-wp7-acceptance-report.md`）同步。

## 7. 强制测试与停止条件

- QA-SYNC-001：断网新增账单，刷新页面后仍存在于待同步队列（不丢失）。
- QA-SYNC-002：恢复网络后只生成一条服务器记录（幂等重放）。
- QA-SYNC-003：两设备修改同一金额返回冲突，不静默覆盖；冲突页可选择保留版本。
- QA-SYNC-004：退出或关闭账号后本地敏感缓存与会话清理（IndexedDB 清空、SW 不保留敏感响应）。
- 墓碑：一个设备删除的记录在另一设备同步后消失。
- 幂等：同键重放返回原结果；同键不同内容返回 `IDEMPOTENCY_CONFLICT`。
- 限流与批量上限：超限返回结构化错误。
- QA-SEC-001/002（延续）：跨用户同步访问 404；管理员访问用户同步内容 403；日志无正文/令牌。
- 集成测试在真实 MySQL 空库通过（WP2–WP7 全量）；`prisma migrate deploy` 空库成功。
- `npm run quality` 与 `git diff --check` 通过。
- 浏览器矩阵 375/390/430/768/1440：离线新增/刷新/恢复/冲突/退出清理主流程与错误状态无横向溢出；控制台 0 error / 0 warning（离线场景预期网络错误日志除外）。
- 文档、状态与 WP7 验收报告与实际一致；WP7 本地提交完成；不进入 WP8。

## 8. 风险与未决（不阻塞实现，需记录）

- 离线同步复杂度（RISK-004）：只同步已定义实体；敏感冲突人工确认；不做通用协作平台。
- 变更流聚合范围与游标方案未在产品文档精确定义：默认“服务端单调游标 + 用户范围增量”，实现时记录 ADR；不引入消息队列。
- 附件二进制不同步（`[待确认]`）：V1 只同步元数据/引用，上传走在线接口；如需离线附件再另行成文。
- 双设备/离线验收依赖 `playwright-cli` 多会话模拟；浏览器 QA 一键脚本化仍待后续（OPEN-009）。
- WP7 新增错误码/枚举需在 WP8 全量验收前同步到数据字典与 OpenAPI。
- 未来多实例部署需要数据库租约（与 WP5 调度器一致），V1 按单实例实现。
