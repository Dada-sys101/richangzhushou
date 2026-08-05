# 15 WP3 基础记账与今日财务 — Codex 可执行规划

文档版本：0.3<br>
状态：已完成（本地验收通过，见 `docs/16-wp3-acceptance-report.md`）<br>
更新：2026-08-05<br>
适用版本：V1.0

## 1. 任务目标

实现 WP3“基础记账与今日财务”：账单（Transaction）、分类（Category）、账户（FinancialAccount）、预算（Budget）、统计摘要、CSV 导出与今日财务卡片。手机与桌面主流程、错误状态可用。

## 2. 前置条件与授权边界

- 前置：WP1/WP2 已完成本地验收（`docs/13-wp1-acceptance-report.md`、`docs/14-wp2-acceptance-report.md` v2.0）。
- 开工前需用户另行授权。建议授权范围：
  - 创建 `codex/wp3-finance` 分支；
  - 修改本地代码、Prisma schema/migration、OpenAPI、测试与文档；
  - 安装 WP3 必需的正常开发依赖；
  - 完成本地 checkpoint 与提交；
  - 禁止推送、PR、部署、购买服务、创建云资源、写入真实凭据；
  - 禁止实现 WP4（快捷指令、OCR、统一录入草稿）及之后的业务功能。
- 未授权前不得进入实现。

## 3. 开始前阅读顺序（按 AGENTS.md）

1. `.project/context.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`
5. 当前工作包定义：`docs/12-development-handoff.md`（WP3 部分）与本文件
6. 实现与详细文档：`docs/03-business-rules.md`（BR-FIN-*、BR-BUD-*）、`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/08-ui-ux-and-wireframes.md`、`docs/09-test-and-acceptance.md`

## 4. 只读检查（任一不满足即停止并报告）

1. WP2 是否完成并有最终验收报告。
2. `npm run quality` 是否通过（或先复跑）。
3. 工作树是否干净、无其他任务修改同一目录。
4. 当前工作包是否已正式切换到 WP3（TODO/MASTER_PLAN/状态文档一致）。

## 5. 设计约束（契约与业务不变量）

- 契约先行：先补全 Finance 的 OpenAPI 请求、响应、DTO 与错误码，再实现。
- 金额一律使用 `DECIMAL(18,2)`（数据库）与两位小数字符串（API），禁止二进制浮点计算；V1 默认币种 `CNY`（BR-FIN-001）。
- 支出金额必须大于 0；类型决定统计方向，禁止用负数表达退款（BR-FIN-002）。
- 退款必须引用原账单或明确标记为无原单退款（BR-FIN-003）。
- 正式账单状态为 `CONFIRMED`；`DRAFT` 属 WP4 来源，本工作包不实现 OCR/快捷指令草稿，但不得破坏“未确认草稿不计入统计”的规则（BR-FIN-004）。
- 删除采用软删除并允许短期撤销；统计排除已删除记录（BR-FIN-005）。
- 疑似重复只提示不自动删除：同用户、同币种、同金额，时间相差不超过 10 分钟，且商户相同或来源指纹相同（BR-FIN-006）。
- 月预算按 `Asia/Shanghai` 自然月与已确认支出计算，退款冲减支出（BR-BUD-001）。
- 所有用户资源强制 `userId` 范围；跨用户访问返回 404（延续 QA-SEC-001）。
- API 时间为 ISO 8601；业务展示与自然月以 `Asia/Shanghai` 计算（BR-COMMON-001）。
- 写接口保留幂等键/`clientMutationId` 契约基础（同步落地属 WP7）。
- 管理员默认不能读取用户账单正文（延续 QA-SEC-002）；管理端不新增用户内容读取接口。

## 6. Checkpoints（逐个实现并验证）

1. OpenAPI、共享类型、错误码与 Finance 契约（账单、分类、账户、预算、统计、CSV）。
2. Prisma 实体、约束、索引、migration、seed 与回滚说明（Transaction、Category、FinancialAccount、Budget；软删除、唯一约束、用户索引）。
3. 账单 CRUD、软删除/恢复与疑似重复提示。
4. 分类、账户 CRUD（归档而非物理删除）。
5. 预算 CRUD 与自然月校验。
6. 统计与今日财务卡片（已确认支出、退款冲减、预算进度）。
7. CSV 导出（仅当前用户数据、安全文件名、UTF-8/Excel 兼容性）。
8. 用户端页面（手机/桌面主流程与错误状态）、文档、状态与 WP3 验收报告（`docs/16-wp3-acceptance-report.md`）同步。

## 7. 强制测试与停止条件

- QA-FIN-001：`0.1 + 0.2` 等金额累计无浮点误差。
- QA-FIN-002：退款正确冲减支出且不使用负数绕过类型。
- QA-FIN-003：软删除后统计排除、恢复后重新计入。
- QA-FIN-004：疑似重复提示且不自动删除。
- QA-SEC-001（延续）：用户 A 不能读取/修改用户 B 的账单、分类、账户与预算。
- 集成测试在真实 MySQL 空库通过；`prisma migrate deploy` 空库成功。
- `npm run quality` 与 `git diff --check` 通过。
- 浏览器矩阵 375/390/430/768/1440：记账主流程（新增支出、编辑、删除/恢复、今日卡片、预算、CSV）与错误状态（校验失败、网络失败）无横向溢出，控制台 0 error / 0 warning。
- 文档、状态与 WP3 验收报告与实际一致；WP3 本地提交完成；不进入 WP4。

## 8. 风险与未决（不阻塞实现，需记录）

- 对象存储、OCR/AI、通知渠道属 WP4+，WP3 不依赖外部供应商（OPEN-003/004/005 不阻塞本工作包）。
- CSV 编码与 Excel 兼容性需在验收中确认。
- 预算周期跨时区与闰年边界用 `Asia/Shanghai` 明确测试。
- 邮箱验证策略（OPEN-008）影响注册体验，不影响财务契约。
