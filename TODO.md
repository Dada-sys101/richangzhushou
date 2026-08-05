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
