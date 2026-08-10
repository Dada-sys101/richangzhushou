# ADR-026：V1.5 发布范围、门禁映射与晋级策略

- Date: 2026-08-10
- Status: Accepted
- Accepted by: Dada（人工审查结论，2026-08-10）
- Related plan: `PLANS.md` v2.1.1 Final
- Amends: `docs/40-v15-final-development-baseline.md` V1.1
- Related task: `V15-CTRL-001`

## Context

V1 核心已存在。docs/40 V1.0 将 H1～H8 全部关闭作为 main、Production、真实 AI/Push、
RRULE 切换和 IndexedDB v2 等所有能力的统一前置条件。这与 V1.5 约 10 人首发、AI 必须进入 R1、
Push 可后移及渐进交付目标冲突。需要在不改变冻结核心技术架构的前提下，对发布范围和门禁映射作增量修订。

## Decision

1. 保留 canonical ID：V15-CTRL-001、PR1～PR23、PR6a、AI-DECISION-001、REL-01～REL-06、H1～H9。
2. R1：V15-CTRL-001、PR6a、AI-DECISION-001、PR2、PR5、PR6、PR9、PR18～PR20、REL-01～REL-06。
3. R1.1：PR3、PR16、PR17；真实 Push 可关闭，不阻塞 R1。
4. R2：PR4、PR7、PR8、PR13、PR14、PR15、PR21；R1 使用现有提醒路径。
5. R3：PR10、PR11、PR12、PR22、PR23；v1 本地数据继续保留，完整迁移和 Shrink 后移。
6. H1/H2/H7 阻塞 R1；H6/H8 只阻塞 Push；H4 只阻塞 Android 支持声明；H3/H5 为记录性门禁。
7. PR5 负责共享 Flag 与 AI contracts；PR16 负责 Push contracts；PR4/PR14 负责 Import contracts。
8. PR18 包含完整 Proposal 展示、编辑、接受/拒绝、最终确认 UI 和 Fake Provider；AI 不得自动确认或直接写业务表。
9. PR20 的 `developmentDependency` 为 PR19；H7 是 `humanValidationGate` 和 `mergeGate`，不得由 PR20 自动关闭。
10. AI-DECISION-001 在 PR2 前冻结接入、安全、预算、评测方法/样本和 provisional thresholds；PR20 真实评测后再人工冻结最终效果阈值。不可降低的安全阈值始终有效。
11. REL-01 可提前到基础阶段完成方案、资源选择、成本/权限、MySQL/OSS/域名、RPO/RTO 和拓扑冻结，但不得创建资源。
12. REL-02 必须等待 REL-01、R1 Quality Gate 和独立资源授权后才能创建 Staging 资源。
13. REL-05 采用 3→5→约 10 人且累计至少 7 个有效日历日；每阶段绑定版本，受影响变更重算窗口，P0/P1 修复回到对应阶段，RC 必须可追溯。
14. Production 晋级固定为：integration RC HEAD → integration→main 发布 PR → 全量 CI → 人工 Review → 独立 merge 授权 → merge main → 核验 main HEAD → release tag → 仅部署该 main/tag commit。
15. REL-06 不依赖 PR23；生产、云资源、真实调用、迁移、tag 和部署继续分别需要独立授权。
16. `PLANS.md` 是唯一任务定义，`.project/v15-execution-state.md` 是仓库内状态快照；GitHub/Git/CI/环境是实时事实源。快照差异在合法治理点同步，不得制造无限 CI 循环。

## AI Thresholds

PR2 前 provisional targets：

- Schema success ≥99%；
- 无需完全重录 ≥85%。

不可降低的安全阈值：

- 失败必须保留原输入；
- 正式业务写入 100% 经用户确认；
- Provider 输出不得直接写业务表；
- 敏感字段不得越过白名单。

PR20 受控真实评测后才能提出最终效果阈值，经人工批准写入 AI ADR；不得借校准降低安全阈值。

## Baseline Amendment

本 ADR 是对 docs/40 的发布范围、PR/Release 映射和 main/Production 门禁的正式增量修订，
不改变 docs/40 冻结的 RRULE 技术选型、AI Proposal 模型、Repository 架构、数据库渐进迁移原则
和 Feature Flag 安全边界。docs/40 已同步升级为 V1.1；两者不得保留相互冲突的有效规则。

## Consequences

- AI 进入 R1；Push、新 RRULE、完整本地迁移按 R1.1/R2/R3 独立交付；
- 人工门禁从“全部阻塞所有发布”改为按 blockingScope 生效；
- 延后能力仍保留 canonical 任务，不视为取消；
- 开发完成、启用、合入、试用和发布必须分别记录证据。

## Approval Record

- [x] v2.1.1 Final Candidate
- [x] R1/R1.1/R2/R3 映射
- [x] AI R1、Push R1.1
- [x] REL-01 提前但禁止创建资源
- [x] REL-02 等待 R1 Quality Gate
- [x] integration→main→tag→Production 门禁
- [x] PR18 确认 UI 范围
- [x] PR20/H7 状态机
- [x] AI provisional + immutable safety thresholds
- [x] Task Selection Policy
- [x] docs/40 V1.1 同步原则

本 ADR 已由人工明确批准并进入 `Accepted`；其代码、PR、merge 或部署动作仍需各自独立授权。
