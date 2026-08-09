# Documentation Index

版本：0.4
状态：已核对至 V15-CTRL-001
更新：2026-08-10

## V1.5 接手导航（实时/概要）

1. `../AGENTS.md`：强制约束、恢复顺序和授权边界。
2. `../PLANS.md`：V1.5 唯一执行总路线。
3. `../.project/v15-execution-state.md`：实时任务、HEAD、PR、CI、门禁和证据。
4. `../tasks/V15-CTRL-001.md`：当前任务执行契约。
5. `40-v15-final-development-baseline.md`：冻结技术与开发基线。
6. `adr/ADR-026-v15-release-scope-r1.md`：首发分层 ADR（Proposed）。
7. `../.project/context.md`：长期项目状态。
8. `../.project/session.md`：当前或暂停任务。
9. `project-overview.md`：项目概述。
10. `architecture.md`：当前实际架构与规划架构对照。
11. `progress.md`：完成度与已知问题。
12. `roadmap.md`：当前发布路线。
13. `decisions.md`：已确认与未决决策。
14. `changelog.md`：变更历史。

优先级：

```text
GitHub 实际代码 / PR / CI
> docs/40 冻结基线
> PLANS.md / execution state / 当前任务契约
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
32. `adr/ADR-026-v15-release-scope-r1.md`

所有文档以稳定编号引用规则、功能、页面、数据、API 和验收项。未确认信息必须标记为 `[待确认]` 或 `[关键假设]`。
