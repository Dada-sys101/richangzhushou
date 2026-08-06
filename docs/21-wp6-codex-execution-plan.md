# 21 WP6 行程 — Codex 可执行规划

文档版本：0.1<br>
状态：已完成本地实现与验收（见 `docs/22-wp6-acceptance-report.md`）<br>
更新：2026-08-06<br>
适用版本：V1.0

## 1. 任务目标

实现 WP6“行程”：行程（Trip）、行程节点（TripItem）、行李清单（PackingItem）、账单关联（`Transaction.tripId`）、预算与实际支出汇总、日程关联入口。完成定义：单/多日行程可管理，费用汇总正确，超范围节点有明确提示（`docs/12`）。

## 2. 前置条件与授权边界

- 前置：WP1–WP5 已完成本地验收（`docs/13`、`docs/14`、`docs/16`、`docs/18`、`docs/20`）；WP6 依赖 WP3（账单与统计）与 WP5（日程入口）。
- 开工前需用户另行授权。建议授权范围：
  - 创建 `codex/wp6-trips` 分支；
  - 修改本地代码、Prisma schema/migration、OpenAPI、测试与文档；
  - 安装 WP6 必需的正常开发依赖；
  - 完成本地 checkpoint 与提交；
  - 禁止推送、PR、部署、购买服务、创建云资源、写入真实凭据；
  - 禁止实现 WP7（PWA/离线同步）及之后的业务功能。
- 未授权前不得进入实现。

## 3. 开始前阅读顺序（按 AGENTS.md）

1. `.project/context.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`
5. 当前工作包定义：`docs/12-development-handoff.md`（WP6 部分）与本文件
6. 实现与详细文档：`docs/03-business-rules.md`（BR-TRIP-*）、`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/08-ui-ux-and-wireframes.md`、`docs/09-test-and-acceptance.md`；现有实现参考 `apps/api/src/{finance,calendar,tasks}`、`apps/web/src/views`、`packages/api-contracts`

## 4. 只读检查（任一不满足即停止并报告）

1. WP5 是否完成并有最终验收报告（`docs/20`）。
2. `npm run quality` 是否通过（或先复跑）。
3. 工作树是否干净、无其他任务修改同一目录。
4. 当前工作包是否已正式切换到 WP6（TODO/MASTER_PLAN/状态文档一致）。

## 5. 设计约束（契约与业务不变量）

- 契约先行：先补全 Trips 的 OpenAPI 请求、响应、DTO、错误码与共享类型（含 `TripItemType` 等新枚举），再实现；枚举与数据字典、Prisma、前端映射必须一致。
- 时间与日期（BR-COMMON-001、BR-TRIP-001）：API 时间 ISO 8601；行程 `startDate`/`endDate` 使用 `Asia/Shanghai` 本地日期（DATE 语义）；结束日期不得早于开始日期，违规拒绝。
- 节点（BR-TRIP-002）：节点时间原则上应位于行程日期范围内；超出时返回明确提示并允许用户确认后保存；节点顺序用 `position` 管理。
- 账单关联（BR-TRIP-003）：`Transaction` 增加可选 `tripId`（同一用户范围内）；行程实际支出 = 关联的已确认支出 − 关联的已确认退款；金额沿用 `DECIMAL(18,2)` 与两位小数字符串，禁止二进制浮点累计。
- 预算与实际支出：`Trip.budgetAmount` 使用定点金额（可为空）；实际支出/预算进度在服务端计算返回，前端不自行累计。
- 日程关联入口（`docs/12` 输出项）：行程详情提供日期范围内的日程查看/今日安排跳转入口；具体形态 `[待确认]`，不擅自新增跨实体外键。
- 用户隔离：行程、节点、行李与关联账单全部强制 `userId` 范围；跨用户访问返回 404（延续 QA-SEC-001）；管理员不能调用用户行程正文 API（延续 QA-SEC-002）；账单关联只允许当前用户自己的账单。
- 可同步资源遵循 `docs/05` 通用约定：`version` + `createdAt`/`updatedAt`/`deletedAt` 软删除；修改携带当前 `version`，过期返回 `VERSION_CONFLICT`；创建支持 `clientMutationId` 幂等（与 WP3–WP5 一致，供 WP7 同步落地）。
- 高风险操作（批量删除/清空节点或行李）必须二次确认并审计（BR-AI-004，沿用 WP4 `confirmationToken` 模式）。
- 日志禁止记录用户行程正文等敏感内容；所有写接口提供字段错误、权限错误、幂等冲突、版本冲突与服务不可用状态。

## 6. Checkpoints（逐个实现并验证）

1. OpenAPI、共享类型、错误码与契约测试：Trips/TripItems/PackingItems 端点、`TripItemType` 等枚举、行程费用汇总类型（`TripExpenseSummary`）；同步数据字典。
2. Prisma 实体、约束、索引、migration、seed 与回滚说明：`Trip`、`TripItem`、`PackingItem`，以及 `Transaction.tripId` 外键与索引；软删除、`version`、`clientMutationId`、`userId+startDate`、`tripId+position` 索引。
3. 行程 CRUD：日期校验（结束 ≥ 开始）、预算字段、软删除/恢复、幂等与版本并发。
4. 节点 CRUD：日期范围校验与超范围提示（确认后保存）、`position` 排序、软删除/恢复。
5. 行李清单 CRUD：文本/勾选状态/顺序，切换勾选与软删除/恢复。
6. 账单关联与费用汇总：`Transaction` 创建/更新支持可选 `tripId`（当前用户校验）；行程详情返回实际支出、预算与实际进度（服务端定点计算、退款冲减、只计已确认未删除）。
7. 日程关联入口与前端：行程列表/详情/节点/行李页面、关联账单入口、行程日期内日程展示或跳转；错误与网络失败状态。
8. 集成、并发、安全、前端与浏览器验收；文档、状态与 WP6 验收报告（`docs/22-wp6-acceptance-report.md`）同步。

## 7. 强制测试与停止条件

- QA-TRIP-001：关联账单正确汇总行程实际支出（如支出 100.00 + 退款 20.00 → 80.00；只计 `CONFIRMED` 且未删除；跨用户账单不可关联）。
- BR-TRIP-001：结束日期早于开始日期被拒绝。
- BR-TRIP-002：超范围节点返回明确提示；未确认不保存；确认后允许保存。
- 幂等与版本：相同 `clientMutationId` 重放返回原结果、不同内容返回冲突；PATCH 携带过期 `version` 返回 `VERSION_CONFLICT`。
- QA-SEC-001/002（延续）：跨用户行程/节点/行李/关联账单 404；管理员访问用户内容 API 403。
- 集成测试在真实 MySQL 空库通过（WP2–WP6 全量）；`prisma migrate deploy` 空库成功。
- `npm run quality` 与 `git diff --check` 通过。
- 浏览器矩阵 375/390/430/768/1440：行程列表/详情/节点/行李/关联账单/日程入口主流程与错误状态（校验失败、网络失败）无横向溢出，控制台 0 error / 0 warning。
- 文档、状态与 WP6 验收报告与实际一致；WP6 本地提交完成；不进入 WP7。

## 8. 风险与未决（不阻塞实现，需记录）

- `TripItemType` 等新枚举取值未在产品文档定义：实现时按 `[关键假设]` 补充（如 `TRANSPORT`/`STAY`/`ACTIVITY`/`FOOD`/`OTHER`）并记入 `docs/decisions.md`（延续 DEC-112/DEC-117 做法）。
- 日程关联入口形态未定义（`docs/12` 仅“关联入口”）：先实现日期范围内日程展示/跳转的最小方案，避免擅自新增跨实体关系；如需正式关联需先成文确认。
- 行程与记账/日程边界重复（roadmap R-P1-4）：账单归属行程只做关联与汇总，不复制统计逻辑；日程入口不替代 Calendar 功能。
- 浏览器 QA 未固化为仓库内一键脚本（OPEN-009）：继续使用 `playwright-cli` 产物并记录证据。
- WP6 的 `version`/`clientMutationId` 契约需与 WP7 同步语义保持一致。
