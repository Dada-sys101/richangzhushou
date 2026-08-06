# 24 WP7 PWA 与离线同步 — 本地验收报告

文档版本：1.0<br>
状态：本地验收完成（未推送、未部署）<br>
更新：2026-08-06<br>
适用版本：V1.0

## 结论

WP7「PWA 与离线同步」已按 `docs/23-wp7-codex-execution-plan.md` 完成本地实现与验收：
契约、数据、后端同步、客户端离线层、冲突页面与账号清理全部落地，并通过
`npm run quality`、空库 6 migrations + seed、集成测试 63/63 与浏览器
QA-SYNC-001~004 及 375/390/430/768/1440 宽度矩阵。

分支：`codex/wp7-pwa-sync`（未推送、未创建 PR、未部署、未创建生产资源）。

## 交付内容

### CP1 契约（`6ed79da`）
- `GET /sync/changes?cursor=&limit=`、`POST /sync/mutations`、`GET /sync/status`
  的请求/响应/DTO 与共享类型（`SyncChange`、`SyncMutationRequest`、
  `SyncMutationResult`、`SyncStatusResponse` 等）。
- 新增错误码 `CURSOR_INVALID`、`MUTATION_BATCH_TOO_LARGE`、
  `MUTATION_UNSUPPORTED`；`Category/FinancialAccount/Budget` 创建请求增加
  `clientMutationId`。
- 契约测试 132/132 通过（含 WP7 断言）。

### CP2 数据（`3ddf4e7`）
- 新表 `sync_mutations`（`user_id + client_mutation_id` 唯一、`request_hash`、
  `result_ref`、`status`、`error_code/message`）。
- `categories/financial_accounts/budgets` 增加 `client_mutation_id` 唯一列。
- 同步实体新增 `(user_id, updated_at)` / `(trip_id, updated_at)` 游标索引。
- migration `20260806074500_wp7_sync` 在空库 MySQL 8.4.9 全部 6 个 migration
  部署通过。

### CP3-5 后端（`c9fee8c`）
- 变更流：按 `(updatedAt, id)` 键集游标聚合 11 类同步实体，删除以墓碑
  `DELETE` 变更下发；游标无效返回 `CURSOR_INVALID`。
- 幂等批量：同键同内容重放返回原结果（`resultRef`），同键不同内容返回
  `IDEMPOTENCY_CONFLICT`；批次上限 50，超限返回 `MUTATION_BATCH_TOO_LARGE`。
- 版本冲突：UPDATE/DELETE/RESTORE 基于旧版本执行，返回 `VERSION_CONFLICT`
  并携带服务端当前实体；不静默覆盖金额、时间、状态或删除。
- 分类/账户/预算创建补齐幂等；`sync/status` 提供用户范围计数。
- 跨用户 404、管理员 403、限流（changes/status 120/min，mutations 30/min）。

### CP6-7 客户端（`479b0a9`、`c7a4fa1`）
- IndexedDB 用户隔离缓存（实体、游标、待发送队列、本地→服务端 ID 映射）。
- 离线写入口：网络不可用时写操作自动入队并返回本地占位实体；离线刷新经
  Service Worker 应用外壳恢复且不丢队列；离线会话（无 access token）可读取
  本地缓存。
- 同步器：按序推送、指数退避、手动重试；401 自动刷新令牌并重试；拉取变更
  应用增量/墓碑；待同步/失败/冲突状态写入本地。
- UI：SyncBadge（已同步/待同步/同步失败/冲突 + 计数 + 重试）、离线横幅、
  `/sync/conflicts` 冲突页（本地 vs 服务端对比，保留本地/保留服务端）。
- 退出/关闭/申请删除账号清理 IndexedDB 本地数据；Service Worker 仅缓存应用
  外壳，不缓存 API 响应。

## 验收结果

| 验收项 | 结果 | 依据 |
| --- | --- | --- |
| `npm run quality` | PASS | 格式/Lint/类型/单测/构建/Prisma/OpenAPI/migration diff/审计 |
| 空库 `prisma migrate deploy`（6 migrations）+ seed | PASS | `daily_assistant_wp7_browser` |
| 集成测试（真实 MySQL） | PASS，63/63 | WP2–WP7 全部集成用例 |
| QA-SYNC-001 断网新增账单，刷新后仍在 | PASS | 离线创建 ¥45.67，刷新后仍在列表，本地 ID 保留 |
| QA-SYNC-002 恢复网络仅生成一条服务端记录 | PASS | 服务端 1 条 transaction + 1 条 sync_mutations |
| QA-SYNC-003 两设备改同一金额返回冲突，不静默覆盖 | PASS | 设备 A 改 99.00/version 2；设备 B 离线改 55.00/version 1 → VERSION_CONFLICT → 冲突页“保留本地”→ 服务端 55.00/version 3 |
| QA-SYNC-004 退出账号清理本地缓存与会话 | PASS | 退出后 IndexedDB entities/pending 均为 0，回到登录页 |
| 墓碑：一端删除，另一端同步后消失 | PASS | 设备 A 删除后设备 B 刷新列表为空 |
| 幂等重放 | PASS | 集成测试：同键同内容返回原结果；同键不同内容 `IDEMPOTENCY_CONFLICT` |
| 批次上限/不支持操作 | PASS | >50 → `MUTATION_BATCH_TOO_LARGE`；分类 DELETE → `MUTATION_UNSUPPORTED` |
| 跨用户 404 / 管理员 403 | PASS | 集成测试 |
| 限流 | PASS | 第 121 次 changes 请求 429 |
| 浏览器宽度矩阵 | PASS，20/20 | 首页/账单/冲突页/行程在 375/390/430/768/1440 无横向溢出 |
| 控制台 | 0 warning | 仅离线场景预期网络错误与断连后 401 刷新日志 |
| `git diff --check` | PASS | — |

## 浏览器验收记录

产物位于 `output/playwright/wp7/`（gitignored）：
- 离线新增/刷新/恢复同步/冲突处理/退出清理截图与快照；
- 宽度矩阵溢出检查结果（transactions/sync-conflicts/trips/home 各 5 宽度）。

## 未验证/已知限制

- 浏览器 QA 依赖 `playwright-cli` 与本地 preview 服务，尚未固化为仓库内一键
  脚本（OPEN-009）；离线刷新验证使用生产构建 + `vite preview`（dev 模式无
  Service Worker 预缓存）。
- 附件二进制不进入离线同步队列：V1 仅同步附件元数据/引用，上传仍走在线接口
  （`[待确认]`，见 `docs/23`）。
- 草稿离线创建（解析/OCR）不在离线队列范围；DRAFT_RECORD 支持同步变更流与
  更新/丢弃 mutation。
- 多实例部署前需数据库租约（与 WP5 调度器一致），V1 按单实例实现。
- 远端 CI 仍未运行（WP1–WP6 分支未推送；需用户授权）。

## 提交记录

- `6ed79da` feat(contracts): WP7 sync cursor, mutations and conflict contracts
- `3ddf4e7` feat(db): WP7 sync mutations table, idempotency keys and cursor indexes
- `c9fee8c` feat(api): WP7 sync change stream, idempotent mutations and conflict handling
- `479b0a9` feat(web): WP7 IndexedDB offline queue, sync engine, badge and conflict page
- `c7a4fa1` fix(web): WP7 reconnect token refresh, tombstone pull and logout cache cleanup
