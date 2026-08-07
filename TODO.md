# TODO

仅使用 `NOT_STARTED`、`IN_PROGRESS`、`BLOCKED`、`DONE`、`CANCELLED`。

| ID | 任务 | 状态 | 工作包 |
| --- | --- | --- | --- |
| DA-0001 | 完成产品与功能范围 | DONE | WP0 |
| DA-0002 | 完成页面、流程和业务规则 | DONE | WP0 |
| DA-0003 | 完成权限、数据模型和数据字典 | DONE | WP0 |
| DA-0004 | 完成 API、快捷指令和同步契约 | DONE | WP0 |
| DA-0005 | 完成架构、安全、测试和部署规划 | DONE | WP0 |
| DA-0006 | 完成开发工作包与一致性检查 | DONE | WP0 |
| DA-0101 | 初始化独立 Git 仓库和工程骨架 | DONE | WP1 |
| DA-0102 | 建立项目上下文与开发交接文档体系 | DONE | WP1 |
| DA-0103 | 建立跨任务自动恢复项目状态机制 | DONE | META |
| DA-0104 | 建立持久化项目状态恢复机制（session/decisions/校验脚本） | DONE | META |
| DA-0201 | 补全 OpenAPI、共享类型、错误码和账号状态机 | DONE | WP2 |
| DA-0202 | Prisma 实体、约束、索引、migration、seed 与回滚说明 | DONE | WP2 |
| DA-0203 | 注册、登录、刷新、退出、密码恢复和会话撤销 | DONE | WP2 |
| DA-0204 | 容量、邀请码、关闭、暂停、恢复和删除申请 | DONE | WP2 |
| DA-0205 | 管理端 API、角色守卫和脱敏审计 | DONE | WP2 |
| DA-0206 | 用户端注册/登录/账号页面与管理端页面 | DONE | WP2 |
| DA-0207 | API 集成、并发、安全、前端和 Playwright 验收 | DONE | WP2 |
| DA-0208 | 文档、状态与 WP2 验收报告同步 | DONE | WP2 |
| DA-0301 | 补全 Finance OpenAPI、共享类型、错误码与契约测试 | DONE | WP3 |
| DA-0302 | Finance Prisma 实体、约束、索引、migration、seed 与回滚说明 | DONE | WP3 |
| DA-0303 | 账单 CRUD、软删除/恢复与疑似重复提示 | DONE | WP3 |
| DA-0304 | 分类、账户 CRUD（归档而非物理删除） | DONE | WP3 |
| DA-0305 | 预算 CRUD 与自然月校验 | DONE | WP3 |
| DA-0306 | 统计与今日财务卡片 | DONE | WP3 |
| DA-0307 | CSV 导出（仅当前用户、安全文件名、UTF-8/Excel 兼容） | DONE | WP3 |
| DA-0308 | 用户端页面、文档、状态与 WP3 验收报告同步 | DONE | WP3 |
| DA-0401 | 补全 Shortcuts/Drafts/Attachments OpenAPI、共享类型、ShortcutScope 与错误码 | DONE | WP4 |
| DA-0402 | WP4 Prisma 实体、约束、索引、migration、seed 与回滚说明 | DONE | WP4 |
| DA-0403 | 设备凭证创建/列表/撤销、Bearer 守卫、作用域与限流 | DONE | WP4 |
| DA-0404 | 快捷指令幂等草稿与今日支出 API | DONE | WP4 |
| DA-0405 | 草稿中心：文本解析、OCR、CRUD、确认/丢弃与批量二次确认 | DONE | WP4 |
| DA-0406 | 附件上传意图/内容上传/完成/删除与 OCR 适配器 | DONE | WP4 |
| DA-0407 | 用户端快捷记录、草稿中心、DraftReviewCard 与快捷指令配置页 | DONE | WP4 |
| DA-0408 | 集成、并发、安全、前端验收、文档与 WP4 验收报告同步 | DONE | WP4 |
| DA-0501 | 补全 Calendar/Tasks/Reminders OpenAPI、共享类型、CalendarEventStatus 等枚举与契约测试 | DONE | WP5 |
| DA-0502 | WP5 Prisma 实体、约束、索引、migration、seed 与回滚说明 | DONE | WP5 |
| DA-0503 | 日程 CRUD：时间校验、重叠提示、软删除/恢复、幂等与版本并发 | DONE | WP5 |
| DA-0504 | 待办 CRUD 与状态机：OPEN/COMPLETED/CANCELLED、完成/取消时间与过期计算 | DONE | WP5 |
| DA-0505 | 提醒 CRUD 与重复展开：一次性/日/周/月、Asia/Shanghai 边界与抑制规则 | DONE | WP5 |
| DA-0506 | 提醒调度器：原子领取、防重、失败重试上限与 FAILED/SUPPRESSED 可诊断状态 | DONE | WP5 |
| DA-0507 | 通知适配器与用户端：今日安排卡片、日程/待办/提醒页与通知权限降级 | DONE | WP5 |
| DA-0508 | 集成、并发、安全、前端与浏览器矩阵验收、文档与 WP5 验收报告同步 | DONE | WP5 |
| DA-0601 | 补全 Trips/TripItems/PackingItems OpenAPI、共享类型、TripItemType 枚举与契约测试 | DONE | WP6 |
| DA-0602 | WP6 Prisma 实体、约束、索引、migration、seed 与回滚说明 | DONE | WP6 |
| DA-0603 | 行程 CRUD：日期校验、预算字段、软删除/恢复、幂等与版本并发 | DONE | WP6 |
| DA-0604 | 节点 CRUD：范围校验与超范围确认、position 排序、软删除/恢复 | DONE | WP6 |
| DA-0605 | 行李清单 CRUD：文本/勾选/顺序、切换勾选与软删除/恢复 | DONE | WP6 |
| DA-0606 | 账单关联与费用汇总：Transaction.tripId 校验、服务端定点实际支出/预算进度 | DONE | WP6 |
| DA-0607 | 日程关联入口与前端：行程列表/详情/节点/行李、关联账单、日历跳转与首页入口 | DONE | WP6 |
| DA-0608 | 集成、并发、安全、前端与浏览器矩阵验收、文档与 WP6 验收报告同步 | DONE | WP6 |
| DA-0701 | 补齐 Sync OpenAPI、共享类型、SyncEntityType/SyncAction 枚举与新错误码 | DONE | WP7 |
| DA-0702 | WP7 Prisma 实体（sync_mutations）、clientMutationId 扩展、游标索引与 migration | DONE | WP7 |
| DA-0703 | 后端变更流：键集游标、墓碑、分页、用户隔离与 sync/status | DONE | WP7 |
| DA-0704 | 幂等批量与冲突：requestHash/resultRef、VERSION_CONFLICT、批次上限与限流 | DONE | WP7 |
| DA-0705 | 分类/账户/预算创建幂等与 DraftRecord 同步（变更流+更新/丢弃） | DONE | WP7 |
| DA-0706 | 客户端 IndexedDB 层：用户隔离缓存、游标、待发送队列、本地 ID 映射与离线会话 | DONE | WP7 |
| DA-0707 | 同步器与 UI：拉取/推送/指数退避/401 刷新、SyncBadge、离线横幅与冲突页 | DONE | WP7 |
| DA-0708 | 退出/关闭清理、集成 63/63、浏览器 QA-SYNC-001~004、矩阵与 WP7 验收报告 | DONE | WP7 |
| DA-0801 | 全量契约/安全/上传复查与修复（枚举、审计、确认令牌、魔数、文档一致性） | DONE | WP8 |
| DA-0802 | 可访问性与响应式矩阵（键盘、焦点、语义、触控、5 宽度 + 200% 缩放） | DONE | WP8 |
| DA-0803 | 全量回归：quality、空库 6 migrations+seed、集成 63/63、浏览器主流程与离线同步 | DONE | WP8 |
| DA-0804 | 备份恢复演练与账号删除演练（清理缺口如实记录） | DONE | WP8 |
| DA-0805 | staging 发布清单、隐私/监控清单、WP8 验收报告与状态同步 | DONE | WP8 |
| DA-0901 | 本机启动与访问验证（V1.0 本地运行：API/Web/Admin + 本地 MySQL + 登录 + 核心数据 + 重启持久化） | DONE | META |
| DA-0902 | WP9 身份与录入简化（账号密码登录、管理员建号/重置、首登强制改密、邮箱/邀请码/截图 OCR 下线） | DONE | WP9 |
| DA-1001 | 首页界面优化（今日概览/友好认证状态/精简导航/移动端底部导航/本月财务/空状态/同步状态；仅前端） | DONE | UI |
| DA-1002 | 发布准备第一阶段：推送 `codex/wp8-release-prep` 并完成远端 CI 验证（含 CI 纯净环境修复） | DONE | RELEASE |
| DA-1003 | 发布准备第二阶段：建立并推送正式 `main` 分支（wp8 完整包含 wp1，main CI 通过） | DONE | RELEASE |
| DA-1004 | 发布准备第三阶段：staging 创建/部署（需用户授权） | NOT_STARTED | RELEASE |
| DA-1005 | GitHub 默认分支切换为 `main`（用户网页操作完成） | DONE | RELEASE |
| DA-1101 | OPEN-007 账户期满删除清理（保留期/调度/附件删除/取消/重试上限/匿名墓碑） | DONE | RELEASE |
| DA-1102 | 修正 staging 发布清单过期内容（docs/27 + 状态文档同步） | DONE | RELEASE |
| DA-1103 | OPEN-007 PR #1 squash 合并到 main（`6d9c888`，任务分支已删除） | DONE | RELEASE |
| DA-1104 | 合并后状态文档同步（`codex/post-open-007-merge-status`，PR 待用户确认合并） | IN_PROGRESS | RELEASE |
