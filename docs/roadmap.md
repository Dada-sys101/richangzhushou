# 路线图（Roadmap）

文档版本：1.0
状态：已与代码、Git 历史交叉核对
更新：2026-08-05
说明：优先级依据 `docs/11`、`docs/12` 与当前代码状态整理。P0 = 必须优先完成；P1 = 核心体验提升；P2 = 后续增强；暂缓 = 不在 V1.0。

## 前置动作（需要授权，非开发功能）

- 推送 `codex/wp1-foundation` 分支并首次运行远端 CI（需用户单独授权；origin 已配置但未推送）。
- 确认正式产品名、远端仓库策略、邮件/OCR/AI/对象存储/通知供应商、部署地域与合规、数据保留期（`docs/decisions.md` OPEN-001~008）。

## P0 必须优先完成

### R-P0-1 WP2：身份、容量、邀请码与管理端

- 任务目标：注册登录、会话与密码恢复骨架、容量事务、邀请码、账号状态、管理员仪表盘/用户/邀请码/设置/审计。
- 涉及模块：`apps/api`（auth/users/capacity/invites/admin/audit）、`packages/api-contracts`、`apps/web`（注册登录）、`apps/admin`。
- 前置依赖：WP1（已完成）；邮箱验证策略（OPEN-008）需在 WP2 前确认。
- 验收标准：`QA-CAP-001~006`、`QA-SEC-001/002/003` 通过；并发抢最后名额不超限；管理员默认不能访问用户正文。
- 风险：容量并发（事务+锁+集成测试）、凭证与审计安全、数据隔离。
- 状态：已完成本地验收（`docs/14-wp2-acceptance-report.md`）。

### R-P0-2 真实 MySQL 迁移验证

- 任务目标：在空 MySQL 8 库执行 `prisma migrate deploy`（本地或远端 CI），并记录实际结果。
- 涉及模块：`apps/api/prisma`、CI。
- 前置依赖：可用 MySQL/Docker，或推送授权后由 CI 执行。
- 验收标准：空库部署成功；schema/migration/回滚策略记录完整。
- 风险：本机无 MySQL/Docker；远端 CI 未运行。
- 状态：已通过本机便携 MySQL 8.4 空库执行 `prisma migrate deploy`；远端 CI 未运行。

### R-P0-3 固化浏览器 QA 脚本

- 任务目标：将 375/390/430/768/1440、404、Back、离线等检查固化为仓库内可运行脚本。
- 涉及模块：`apps/web`、`apps/admin`、根 `package.json`、CI。
- 前置依赖：无；可与 WP2 并行。
- 验收标准：一条 npm 命令可复现矩阵并断言控制台错误；现有 favicon 404 问题被覆盖。
- 风险：`docs/13` 现有结论与原始记录不一致，需要先复核。

## P1 核心体验提升

| ID | 任务目标 | 涉及模块 | 前置依赖 | 验收标准 | 风险 |
| --- | --- | --- | --- | --- | --- |
| R-P1-1 WP3 基础记账与今日财务 | 账单/分类/账户/预算/统计/CSV/今日卡片 | `apps/api` finance、`apps/web`、契约 | WP2 | 金额精度、退款冲减、软删除、重复提示、用户隔离 | 浮点金额误用 |
| R-P1-2 WP4 快捷指令、OCR 与统一录入 | 设备凭证、快捷指令 API、草稿中心、图片上传、OCR 适配、确认/丢弃 | `apps/api`（drafts/shortcuts/integrations/attachments）、`apps/web` | WP3 | 幂等、凭证撤销、OCR 失败降级、未确认草稿不计统计 | 第三方不可用、凭证泄露 |
| R-P1-3 WP5 日程、待办与提醒 | 日历/日程/待办/简单重复提醒/今日安排/通知适配 | `apps/api`（calendar/tasks/reminders）、`apps/web` | WP2；可与 WP4 部分并行 | 时间边界、冲突提示、状态转换、关闭/暂停抑制提醒 | 通知渠道不稳定 |
| R-P1-4 WP6 行程 | 行程/节点/行李清单/账单关联/实际支出 | `apps/api`（trips/finance）、`apps/web` | WP3、WP5 | 费用汇总正确、超范围节点提示 | 与记账/日程边界重复 |
| R-P1-5 WP7 PWA 与离线同步 | 安装、IndexedDB 缓存、离线写入队列、同步游标、幂等批处理、冲突页 | `apps/web`、`apps/api`（sync） | WP3–WP6 稳定契约 | `QA-SYNC-001~004`；断网不丢、恢复不重复、冲突不静默覆盖 | 离线同步复杂度 |

## P2 后续增强

- V1.1：深度日历集成、地点/出发提醒、周期账单识别、更多 OCR 模板、周报/月报、桌面/锁屏组件。
- 可访问性与响应式补强、管理端审计/运行面板增强、性能与指标完善。

## 暂缓项

- 家庭共享账本/日历/行程（V1.2）。
- 原生 iOS App、App Intents、Siri、Apple Watch（V1.2）。
- 复杂智能排程、银行/支付自动同步、多人协作、企业功能（明确排除或 V2.0）。

> 工作包详细定义见 `docs/12-development-handoff.md`；风险与未决决策见 `docs/decisions.md`。
