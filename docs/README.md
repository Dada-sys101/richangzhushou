# Documentation Index

版本：0.9
状态：已同步 Integration `77bedde…` 的私有预览事实和 UI 重构规划基线；UIR-02 为 `PLANNING_NOT_IN_INTEGRATION / NOT_STARTED`
更新：2026-09-15

## UI 重构后续基线（规划完成，业务实现尚未开始）

- [UI 重构视觉与产品基线（docs/50）](50-ui-reconstruction-baseline.md)：暖白/柔和紫方向、信息架构、天气与 AI 边界、响应式和迁移原则。
- [UI 组件、页面与验收规范（docs/51）](51-ui-component-and-page-spec.md)：Token、组件状态、二级页面模板、管理端和五档验收矩阵。
- [UI 当前状态全量审计（docs/52）](52-ui-current-state-audit.md)：实际路由、页面、组件、CSS、测试、风险和样板选择。
- [UI 未决产品与技术决策包（docs/53）](53-ui-open-decisions.md)：天气、AI、桌面导航、主题密度和小猫资产九项未批准建议。
- [UIR-00 总契约](../tasks/UIR-00.md)：UIR-00～UIR-12 的范围、依赖、禁区和验收。
- [UIR-02 Luna 契约](../tasks/UIR-02.md)：首个代码任务的精确白名单、保留行为、测试和主代理复核门禁；当前不得执行。

## V1.5 接手与状态恢复导航

1. `../AGENTS.md`：强制约束、恢复顺序和授权边界。
2. `../PLANS.md`：V1.5 唯一执行总路线。
3. `../.project/v15-execution-state.md`：唯一仓库内执行状态快照，不是 GitHub/CI 实时镜像。
4. `../tasks/UIR-02.md`：下一 UI 代码任务契约；当前受规划提交交付门禁阻塞。
5. `../tasks/PR19.md`：PR19 V10 冻结契约及非规范事实附录。
6. `adr/ADR-028-v15-pr20-adapter-integration-h7-boundary.md`：PR20/H7 边界（Accepted）。
7. `adr/ADR-027-ai-provider-evaluation-policy.md`：AI Stage 1 接入、安全与评测策略（Accepted）。
8. `41-pr6a-mysql84-validation.md`：临时 MySQL 8.4 入口、边界与已集成验收。
9. `40-v15-final-development-baseline.md`：V1.2 冻结技术与开发基线（ADR-028 有限修订）。
10. `adr/ADR-026-v15-release-scope-r1.md`：发布范围与门禁增量修订（Accepted，规范未改）；`../tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md` 为历史 Gate 2 治理契约。
11. `../.project/context.md`：长期项目状态。
12. `../.project/session.md`：当前或暂停任务。
13. `project-overview.md`：项目概述。
14. `architecture.md`：当前实际架构与规划架构对照。
15. `progress.md`：完成度与已知问题。
16. `roadmap.md`：当前发布路线。
17. `decisions.md`：已确认与待批准决策。
18. `changelog.md`：变更历史。

优先级：

```text
GitHub / Git / CI / 实际部署环境
> docs/40 核心技术基线 + Accepted ADR-026 发布/门禁修订 + Accepted ADR-027 AI 策略 + Accepted ADR-028 PR20 历史边界
> PLANS.md canonical 任务定义
> execution-state 仓库内快照 / 当前任务契约
> 完整需求与系统设计
> 旧 V1 状态文档
> 历史草案与 PoC
```

以下编号文档继续作为详细规划和历史事实来源。旧文档若仍提及邮箱、邀请码、
截图 OCR 或 Playwright 未固化，必须结合 WP9 实现和当前仓库状态判断。

## 阅读顺序

1. `00-project-overview.md`
2. `01-prd-and-feature-scope.md`
3. `02-information-architecture-and-flows.md`
4. `03-business-rules.md`
5. `04-admin-and-permissions.md`
6. `05-data-model-and-dictionary.md`
7. `06-api-and-integrations.md`
8. `07-technical-architecture-and-security.md`
9. `08-ui-ux-and-wireframes.md`
10. `09-test-and-acceptance.md`
11. `10-deployment-and-operations.md`
12. `11-roadmap-risks-and-decisions.md`
13. `12-development-handoff.md`
14. `13-wp1-acceptance-report.md`
15. `14-wp2-acceptance-report.md`
16. `15-wp3-codex-execution-plan.md`
17. `16-wp3-acceptance-report.md`
18. `17-wp4-codex-execution-plan.md`
19. `18-wp4-acceptance-report.md`
20. `19-wp5-codex-execution-plan.md`
21. `20-wp5-acceptance-report.md`
22. `21-wp6-codex-execution-plan.md`
23. `22-wp6-acceptance-report.md`
24. `23-wp7-codex-execution-plan.md`
25. `24-wp7-acceptance-report.md`
26. `25-wp8-codex-execution-plan.md`
27. `26-wp8-acceptance-report.md`
28. `27-wp8-staging-release-checklist.md`
29. `28-wp9-identity-entry-simplification.md`
30. `29-home-ui-optimization.md`
31. `40-v15-final-development-baseline.md`
32. `41-pr6a-mysql84-validation.md`
33. `adr/ADR-026-v15-release-scope-r1.md`
34. `adr/ADR-027-ai-provider-evaluation-policy.md`
35. `43-pr20-h7-live-provider-validation.md`：H7 脱敏 Provider 验证证据。
36. `44-r1-dependency-audit-review.md`：R1 依赖审计兼容性复核与候选撤回记录。
37. `45-r1-manual-device-evidence-template.md`：H1/H2 iPhone Safari 与 PWA/离线验收记录模板。
38. `46-r1-webkit-emulation-validation.md`：H1/H2 WebKit iPhone 13 本机模拟验收记录（不替代真机）。
39. `47-rel-01-staging-architecture-decision.md`：REL-01 Staging 架构、资源、权限、成本、RPO/RTO 与发布边界设计稿（D1-D8 已批准；REL-02 独立授权待定）。
40. `48-r1-approval-decision-pack.md`：R1 剩余阻塞复核、H1/H2/依赖证据映射、REL-01 D1-D8 决策记录与 REL-02 执行前清单。
41. `49-private-preview-release-assessment.md`：当前私有预览正式基线、服务器复核、备份恢复证据与公网切换前剩余项。
42. `50-rel-03-private-preview-runbook.md`：现有私有预览的发布、验证、应用回滚与边界运行手册。

所有文档以稳定编号引用规则、功能、页面、数据、API 和验收项。未确认信息必须标记为 `[待确认]` 或 `[关键假设]`。
