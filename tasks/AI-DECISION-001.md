# 任务执行契约：AI-DECISION-001

contractVersion: v1.0-final
approvedDate: 2026-08-11
ID: AI-DECISION-001
displayName: AI 接入与评测方法冻结
goal: 在 PR2 前冻结 AI Provider 接入、安全、预算、韧性、评测方法与 provisional thresholds，并保留 PR20 后再次人工批准 final provider/model/effect thresholds 的边界。
dependencies: 依 PLANS.md v2.1.1：V15-CTRL-001；本任务必须在 PR2 前完成首层决策。
verifiedInputs: PR6a = DONE / DONE_INTEGRATION；ADR-026 = Accepted。
approvedDecision: ADR-027 v1.0 Final `Accepted`；Stage 1 决策已由人工批准；数据保留期限矩阵已由人工批准并冻结（ADR-027 6.1/6.2），数值与分类不得自行调整。
executionStatus: DONE
deliveryStatus: DONE_LOCAL
nextTaskRule: 当前交付/执行门禁：本任务达到 `DONE_INTEGRATION` 前，`nextCanonicalTask` 仍为 AI-DECISION-001，PR2 必须保持 `BLOCKED / NOT_STARTED`；达到 `DONE_INTEGRATION` 并重新核验实时事实后，下一 canonical task 为 PR2。该门禁不改写 PLANS.md v2.1.1 冻结依赖图。

## allowedScope

- 创建 ADR-027 和本任务契约；
- 最小同步 `PLANS.md`、状态/恢复文档、ADR/文档索引、架构派生说明、进度、路线图和变更日志；
- 仅记录人工批准的 candidates、network、credential、whitelist、logging、retention、budget、
  timeout、retry、breaker、dataset、method、provisional thresholds 和 immutable safety thresholds；
- 运行只读/本地文档质量验证。

## forbiddenScope

- 业务代码、AI Adapter/Router、API、OpenAPI、Prisma、schema、migration、数据库或正式 CI；
- 依赖、lockfile、真实 AI Provider 调用、真实评测、API key/credential、secret manager 或云资源；
- 使用真实历史数据、持久化 raw Provider response、记录 request/response 正文；
- 启动 PR2 或 PR20，关闭 H7，冻结唯一 Provider/model/final effect thresholds；
- 未经独立授权执行 add、commit、push、创建/更新 PR、merge 或部署。

## validation

1. ADR-027 完整且数值不变地记录 v1.0 Final 人工批准策略；
2. Provider/模型候选、网络/credential、安全白名单、日志/保留、失败恢复、timeout/retry/breaker、
   budget、200 条数据规范、provisional thresholds、immutable safety 和 two-stage freeze 齐全；
3. `PLANS.md` 仍为 v2.1.1 唯一任务定义，不改变冻结依赖结构；
4. 状态文档统一记录 integration HEAD `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`、PR6a
   `DONE / DONE_INTEGRATION`、本任务 `DONE / DONE_LOCAL`、PR2 `BLOCKED / NOT_STARTED`；
5. ADR-027 已进入 `.project/decisions.md`、`docs/decisions.md` 和 `docs/README.md`；
6. 数据保留期限矩阵已人工批准并冻结，至少可验证：raw body 无 durable persistence、普通日志
   retention 0；unresolved/failed AiRequest 最长 30 days；AiProposal 最长 30 days；AiProviderAttempt
   仅 metadata、90 days；operational metadata logs 30 days；正式业务记录遵循 domain retention；
   Provider 侧 retention 必须在 PR20 真实调用前重新核验；
7. 运行 `npm run check:context`、`npm run quality` 和 `git diff --check`，结果由主代理独立复核；
8. 完整 diff 不含代码、依赖、secret、真实数据或其他超范围文件。

## authorizationBoundary

本任务只授权治理/文档本地落地。完成后必须停在 `DONE / DONE_LOCAL`。add、commit、push、PR、
merge、PR2 开工、真实 Provider/credential/评测、数据库、云资源、Staging 和 Production 均需各自
独立授权；本任务不能自动关闭 H7 或批准 PR20 的 final provider/model/effect thresholds。

## completionCriteria

- [x] ADR-027 v1.0 Final 已完整落地并标记 Accepted；
- [x] 两阶段冻结、provisional thresholds 和四项 immutable safety thresholds 已明确；
- [x] 数据保留期限矩阵已获得人工批准并冻结，未新增未经批准的分类或期限；
- [x] 任务契约和必要状态/恢复/索引/架构/进度/路线/变更文档已同步；
- [x] 未执行真实评测或实现，未创建 credential、数据库或云资源；
- [x] executionStatus 为 `DONE`，deliveryStatus 为 `DONE_LOCAL`；
- [ ] 本任务 commit；
- [ ] push / PR；
- [ ] 合入 integration 并晋级 `DONE_INTEGRATION`；
- [ ] PR2 开工。

未勾选项不属于本次本地完成事实。只有本任务达到 `DONE_INTEGRATION` 后，PR2 才能在独立授权下开始。
