# ADR-026：V1.5 首发范围、发布目标与任务后移策略

- Date: 2026-08-10
- Status: Proposed
- Related plan: `PLANS.md` v1.2
- Related task: `tasks/V15-CTRL-001.md`

## Context

V1 核心已存在。原路线要求全部最终能力、完整迁移和 Shrink 在生产前完成，
不适合约 10 人首发和 AI 必须首发的目标。

## Decision

1. 保留 V15-CTRL-001、PR1～23、REL-01～06、H1～H9。
2. 新增 releaseTarget、blocksR1Release、featureGate。
3. R1：V15-CTRL-001、PR6a、PR2、PR5、PR6、PR9、PR18～20、REL-01～06。
4. R1.1：PR3、PR16、PR17；Push 可关闭。
5. R2：PR4、PR7/8/13、PR14/15、PR21。
6. R3：PR10/11/12、PR22/23。
7. PR4 整体后移，R1 不预建其专属字段。
8. PR5 负责共享 Flag 和 AI contracts。
9. PR16 负责 Push contracts；PR4/PR14 负责 Import contracts。
10. REL-06 不依赖 PR23。
11. H1/H2/H7 阻塞 R1；H6/H8 只阻塞 Push。
12. R1 使用现有提醒路径；新 RRULE 在 R2。
13. v1 本地数据继续保留；完整迁移和 Shrink 在 R3。
14. AI-DECISION-001 阻塞 PR2，可与 PR6a 并行。
15. 首发 6 周，第 7 周只处理阻断风险。

## AI Targets

PR20 前草案：

- Schema 成功率目标 ≥99%；
- 无需完全重录目标 ≥85%。

不可降低：

- 失败保留原输入；
- 正式写入经用户确认；
- Provider 输出不得直写业务表。

## Consequences

首发关键路径缩短，最终能力不取消；Push、Import、迁移和 Shrink 独立交付；
计划必须区分代码、启用和发布。

## Human Review

- [ ] 发布映射
- [ ] AI/Push 门禁区分
- [ ] PR5/PR16/PR4/PR14 职责
- [ ] REL-06 依赖变化
- [ ] execution state
- [ ] PLANS v1.2

完成审阅前保持 Proposed。
