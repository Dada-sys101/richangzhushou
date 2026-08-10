# Documentation Index

版本：0.5
状态：已同步 PR6a Round 1 `DONE / DONE_LOCAL` / v2.1.1 Final / docs/40 V1.1 / Accepted ADR-026
更新：2026-08-10

## V1.5 接手与状态恢复导航

1. `../AGENTS.md`：强制约束、恢复顺序和授权边界。
2. `../PLANS.md`：V1.5 唯一执行总路线。
3. `../.project/v15-execution-state.md`：唯一仓库内执行状态快照，不是 GitHub/CI 实时镜像。
4. `../tasks/PR6a.md`：当前任务执行契约。
5. `41-pr6a-mysql84-validation.md`：临时 MySQL 8.4 入口、边界与本地验收。
6. `40-v15-final-development-baseline.md`：V1.1 冻结技术与开发基线。
7. `adr/ADR-026-v15-release-scope-r1.md`：发布范围与门禁增量修订（Accepted）。
8. `../.project/context.md`：长期项目状态。
9. `../.project/session.md`：当前或暂停任务。
10. `project-overview.md`：项目概述。
11. `architecture.md`：当前实际架构与规划架构对照。
12. `progress.md`：完成度与已知问题。
13. `roadmap.md`：当前发布路线。
14. `decisions.md`：已确认与未决决策。
15. `changelog.md`：变更历史。

优先级：

```text
GitHub / Git / CI / 实际部署环境
> docs/40 核心技术基线 + Accepted ADR-026 发布/门禁修订
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

所有文档以稳定编号引用规则、功能、页面、数据、API 和验收项。未确认信息必须标记为 `[待确认]` 或 `[关键假设]`。
