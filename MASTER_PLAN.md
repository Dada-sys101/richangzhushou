# Master Plan

版本：0.9  
更新：2026-08-10  
状态：V1 稳定基线完成；V1.5 正式集成进行中

## 目标

在不重建 V1 的前提下，为约 10 名首批用户完成 AI 首发、可回滚部署和封闭试用，
并保留 Push、Import、新 RRULE、完整加密迁移和 Shrink 的扩展路线。

## 里程碑

| 阶段 | 目标 | 任务 | 状态 |
|---|---|---|---|
| Governance | 单一状态和发布分层 | V15-CTRL-001 | DONE_PUSHED / REVIEW |
| Foundation | DB 验证、AI Expand、契约、CI | PR6a、PR2、PR5、PR6 | PENDING/BLOCKED |
| Core | Repository 和 AI 安全链 | PR9、PR18～20 | PENDING/BLOCKED |
| Push | 可选 Push | PR3、PR16、PR17 | R1.1 |
| Release | Staging、恢复、真机、试用和灰度 | REL-01～06 | BLOCKED/PENDING |
| R2 | Import、新 RRULE、完整观测 | PR4、PR7/8/13、PR14/15、PR21 | DEFERRED |
| R3 | 加密迁移、dual-read/write、Shrink | PR10～12、PR22/23 | DEFERRED |

## 周期

- 首发目标：6 周；
- 风险缓冲：最多第 7 周；
- 试用：3→5→约 10 人，至少 7 个日历日；
- R2/R3 不阻塞首次上线。

## 当前控制点

- Active task: V15-CTRL-001
- Active branch: `codex/v15-ctrl-001-rebaseline`
- Base HEAD: `bc747b7ba4232adf888d68243f30573f1ca7866f`
- Next after merge: PR6a
- PR2 gate: PR6a + AI-DECISION-001

## 约束

AI 是 R1 硬门禁；Push 是 R1.1 门禁；REL-06 不依赖 PR23；
生产、云资源、真实服务和清理均需独立批准。
