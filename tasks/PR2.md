# 任务执行契约：PR2

contractVersion: v1.0
approvedDate: 2026-08-12
ID: PR2
displayName: AI DB Expand（AiRequest / AiProposal / AiOperation / AiProviderAttempt）
goal: 在现有 V1 之上增量新增 AI 四表与五个枚举，不改动现有表结构、业务行为、依赖或正式 CI，并完成真实 MySQL 8.4 专项验证与账户删除级联适配。
dependencies: 依 `PLANS.md` v2.1.1 冻结依赖：`V15-CTRL-001`（PR #10 已合并）；`PR6a`（PR #11 已合并）；`AI-DECISION-001` 首层决策（PR #12 已合并，ADR-027 v1.0 Final `Accepted`）。
verifiedInputs: PR #12 merge commit `c4cca65bcd2ba71d93f948bf1c8731179fbb7fad`（integration HEAD）；CI 218 success；`AI-DECISION-001` 已达 `DONE_INTEGRATION`；ADR-027 策略数值不变。
executionStatus: DONE
deliveryStatus: DONE_LOCAL

## 已批准决策（HUMAN APPROVED，不再提出 HUMAN_DECISION_REQUIRED）

### DEC-PR2-01 AttemptStatus

`AiProviderAttemptStatus = RUNNING / SUCCEEDED / FAILED / CANCELLED`（不含 CLAIMED；AiRequest 状态保留 `CLAIMED/RUNNING/SUCCEEDED/FAILED/CANCELLED`）。

### DEC-PR2-02 fieldsJson + clarification 属 Proposal content

- `AiOperation.fieldsJson`（非空 JSON）与 `AiOperation.clarification` 属于 Proposal 内容；正文最长保留 30 天为应用层 retention 策略，operation row 本身无独立期限。
- 本任务不实现 scheduler。
- `fieldsJson` 为非空列；未来清理可规范化空 JSON，不改变本任务 schema。

### DEC-PR2-03 原始 userInput 由客户端保留

原始 userInput 由客户端保留；服务端不得新增任何 raw input / prompt / request / response body 字段。四表仅允许元数据、指纹、摘要与状态字段。

### DEC-PR2-04 账户删除显式删除 AiRequest roots

允许账户删除 transaction 在 DraftRecord 等删除前显式删除该用户 `AiRequest` roots，依赖级联清理四表；保持 User tombstone 与状态机/审计语义不变。

## Logical Invariant

- 仅新增五个枚举与 docs/40 §3.2 冻结四表；字段/长度/nullability/default 完全按附件，不改旧表任何列。
- `AiRequest.proposalId` 为 nullable 逻辑标量，无 FK，避免循环外键；`AiRequest` 只能引用 `users`。
- `AiProposal.aiRequestId` UNIQUE + FK Cascade；`sourceDraftId` FK DraftRecord SetNull；`AiProposal` 不依赖 Draft 即可存在。
- `AiOperation` `(proposalId, ordinal)` UNIQUE，FK Proposal Cascade；`resultDraftId` FK DraftRecord SetNull；不建 proposal+status 或 resultEntity 复合索引。
- `AiProviderAttempt` `(aiRequestId, attemptNo)` UNIQUE，FK Request Cascade；`startedAt` NOT NULL anchor；绝无正文/credential 字段。
- 索引最小化：`(userId,status,createdAt)`、`expiresAt`、`startedAt` 及四个 unique；避免重复 FK 索引。
- 用户数据按 userId 隔离；User 硬删除级联清理四表；账户删除仅新增 `tx.aiRequest.deleteMany({ where: { userId } })`，其余四表依赖级联。

## 允许修改（allowedScope）

- `apps/api/prisma/schema.prisma`：仅新增五枚举与四表、User/DraftRecord 反向关系。
- 唯一新增 migration：`20260812120000_v15_expand_ai/migration.sql`（仅 additive DDL：四 CREATE TABLE、约束、unique、最小索引/FK；可对旧表 ADD CONSTRAINT，不改旧列；无 DROP/RENAME/backfill/INSERT/UPDATE）。
- `apps/api/src/integration/v15-ai-expand.integration.test.ts`：真实 MySQL 8.4 专项。
- `apps/api/src/account-deletion/account-deletion.service.ts` 与 `open007-account-deletion.integration.test.ts`：DEC-PR2-04 最小适配。
- `tasks/PR2.md`、`docs/05-data-model-and-dictionary.md`、`docs/41-pr6a-mysql84-validation.md`、`apps/api/prisma/migrations/README.md` 与 AGENTS 要求的状态/进度/变更文件最小同步。

## 禁止修改（forbiddenScope）

- 真实 Provider/credential/shared/staging/prod DB/cloud/deploy；API/Router/Adapter/UI/正式业务写入。
- 新增 dependency/lockfile/正式 CI；破坏性 DDL；任何 raw input/prompt/request/response body/credential 字段。
- 修改 `PLANS.md` 冻结依赖图或 ADR-027 策略数值；删除或改造既有表/列/功能。
- 未经授权执行 add/commit/push/PR/merge/rebase/reset/checkout/stash/clean/Git config。

## 验证（validation）

1. `prisma format`（仅 schema）、`prisma validate`、`prisma generate`。
2. focused AI test + account deletion focused test（复用 `TEST_DATABASE_URL`/`DATABASE_URL` 安全入口；本机无 DB 时按 skip 如实报告）。
3. 本机存在明确 PR6a loopback 临时 MySQL 8.4 管理员入口时可运行完整迁移+DB 测试；否则不读取 `.env`、不猜凭据，报告由主代理处理。
4. `npm run check:context`、`npm run quality`、`git diff --check`。
5. 深度审查实际 diff：仅允许范围、单一 migration、无 destructive DDL、无 raw/credential 字段、无依赖/lockfile/CI 变化。

## 完成标准与真实状态

- [x] schema 五枚举 + 冻结四表 + User/DraftRecord 关系落地。
- [x] 单一 additive migration 落地且与 Prisma engine 输出逐行一致。
- [x] `v15-ai-expand.integration.test.ts` 落地（表/列类型/nullability/enum、四 unique、级联、两 Draft SetNull、Draft 独立、User hard delete 级联、事务回滚、并发重复、禁用字段/循环 FK、startedAt anchor、旧表结构未变）。
- [x] account-deletion service + open007 测试按 DEC-PR2-04 落地。
- [x] 本契约、数据字典、migrations README、docs/41 与状态文件最小同步。
- [x] `prisma format/validate/generate`、typecheck、`check:context`、`quality`、`git diff --check` 通过。
- [x] 真实 Oracle MySQL 8.4.9 loopback 全迁移通过：fresh empty DB 从 0 应用 10 migrations，重复 deploy 无 pending migration。
- [x] focused AI 12/12、account deletion 11/11、全量 DB integration 15 files / 117 tests 全部通过，无 skip；四表 residual 均为 0，User tombstone 仍为 `DELETED`。
- [x] 最终完整 diff 独立审查通过；验证发现并最小修复 focused schema test 对三个 `created_at DEFAULT CURRENT_TIMESTAMP(3)` 的漏断言。
- [x] 达到 `DONE / DONE_LOCAL`（UNCOMMITTED）。

未勾选项未完成；不得将未验证功能写成已完成或已验证。

## Authorization Boundary

本任务只授权仓库内本地实现与本地只读验证。commit、push、创建/更新 PR、merge、部署、真实数据库/凭据/云资源操作均需各自独立授权；完成后必须停在本地交付状态。
