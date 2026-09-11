# TODO

仅使用 `NOT_STARTED`、`IN_PROGRESS`、`BLOCKED`、`DONE`、`CANCELLED`。

## 当前执行记录（2026-09-11）

当前执行 MOBILE-A；统一导航策略与自动化矩阵已完成，等待真实 iPhone/Android 返回操作验收。Web Push 候选已合并但仍保持关闭，真实送达门禁独立保留。

| ID | 任务 | 状态 | 工作包 |
| --- | --- | --- | --- |
| DA-1201 | PWA 导航策略、根 Tab 历史与深链接返回 | IN_PROGRESS | MOBILE-A |
| DA-1101 | Web Push 订阅、送达、Service Worker 与权限 UI | DONE | R1.1 PR3/PR16/PR17（真实送达为独立门禁） |
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
| DA-1004 | 发布准备第三阶段：独立 Staging 创建/部署 | CANCELLED | RELEASE（独立 Staging 已豁免） |
| DA-1005 | GitHub 默认分支切换为 `main`（用户网页操作完成） | DONE | RELEASE |
| DA-1101 | OPEN-007 账户期满删除清理（保留期/调度/附件删除/取消/重试上限/匿名墓碑） | DONE | RELEASE |
| DA-1102 | 修正 staging 发布清单过期内容（docs/27 + 状态文档同步） | DONE | RELEASE |
| DA-1103 | OPEN-007 PR #1 squash 合并到 main（`6d9c888`，任务分支已删除） | DONE | RELEASE |
| DA-1104 | 合并后状态文档同步（`codex/post-open-007-merge-status`，已随 PR #5 合并到 main `6927d93`） | DONE | RELEASE |
| DA-1201 | V1 发布决策固化（OPEN-001 产品名、OPEN-005 仅应用内提醒、OPEN-011 命名分离） | DONE | RELEASE |
| DA-1202 | OPEN-009 Playwright 浏览器 QA 自动化（smoke/matrix/CI browser-qa/失败产物） | DONE | RELEASE |
| DA-1203 | V1 决策 + 浏览器 QA 分支 PR（#3）squash 合并到 main（`4fcc613`） | DONE | RELEASE |
| DA-1204 | main browser-qa 修复（E2E 时间助手 24 小时制，PR #4 已合并 `47c40c9`） | DONE | RELEASE |
| DA-1205 | PR #3 合并后状态文档 PR（`codex/post-pr3-merge-status`，已随 PR #5 合并到 main `6927d93`） | DONE | RELEASE |
| DA-1301 | OPEN-006 对象存储接入代码（OSS 适配器/STORAGE_PROVIDER 切换/键服务/测试/示例） | DONE（已随 PR #6 squash 合并到 main，`db5c5d3`） | RELEASE |
| DA-1302 | 真实私有 OSS Bucket + 最小权限 RAM + 真实连通/备份上传验证 | CANCELLED | RELEASE（当前范围不新建 OSS） |
| DA-1303 | 状态文档记录 PR #6 合并与 OSS 适配器状态 | DONE | RELEASE |
| DA-1501 | V15-CTRL-001 治理重基线经 PR #10 合入并核验 integration HEAD | DONE | V1.5 |
| DA-1502 | PR6a 临时 MySQL 8.4 安全入口、scoped user、失败/信号 cleanup、重复执行与 evidence | DONE | V1.5 |
| DA-1503 | AI-DECISION-001：ADR-027 v1.0 Final 接入、安全、预算、韧性与评测策略本地落地 | DONE | V1.5 |
| DA-1504 | PR2 AI DB Expand：schema 五枚举+四表、additive migration、MySQL 8.4.9 专项测试、account deletion 适配 | DONE | V1.5 |
| DA-1505 | PR19 AI Router/Stub/安全降级合入 Integration（GitHub PR #18） | DONE | V1.5 |
| DA-1506 | PR20 adapter integration：foundation/configuration/DeepSeek/OpenAI（GitHub PR #20/#21/#22/#23） | DONE | V1.5 |
| DA-1507 | QUALITY-R1-GOVERNANCE-RECONCILIATION Gate 1：事实、ADR-028 草案、状态/镜像同步 | DONE | V1.5 |
| DA-1508 | PR20 Live Provider Validation（H7） | DONE_LOCAL / H7_CLOSED | V1.5 |
| DA-1509 | R1 Quality Gate | DONE | V1.5 |
| DA-1510 | R1 依赖审计兼容性复核（候选因 SBOM 无效撤回，依赖树恢复） | DONE_LOCAL / CANDIDATE_REJECTED | V1.5 |
| DA-1511 | REL-01 Staging 架构、资源、权限、成本、RPO/RTO 与发布边界设计（D1-D8 已批准；资源创建另行授权） | DONE | V1.5 |
| R1-APPROVAL-PACKAGE-01 | R1 剩余阻塞复核与 REL-01 审批决策汇总（不创建资源） | DONE | V1.5 |
| REL-01-DECISION-RECORD-01 | 固化 D1-D8 批准并生成 REL-02 执行前检查（不创建资源） | DONE | V1.5 |
| DA-1512 | 现有 Alibaba 私有预览正式基线核验、备份与恢复校验 | DONE | V1.5 |
| DA-1513 | 依赖审计兼容修复并重新通过供应链门禁 | DONE | V1.5 |
| DA-1514 | 私有预览每日备份、7 天保留与过期清理 | DONE | RELEASE |
| DA-1515 | 域名审批后的公网 HTTPS 入口切换与复验 | NOT_STARTED | RELEASE |
| DA-1516 | 保留私有预览 live AI，并对齐环境/数据库开关与当前用户决定 | DONE | RELEASE |
| DA-1517 | 现有私有预览轻量 readiness 与发布/回滚流程收口 | NOT_STARTED | REL-03 |
| RELEASE-CANDIDATE-01 | 整理已验证修改并形成私有预览发布候选（Web/同步、AI、契约/测试、状态与备份运营） | DONE | RELEASE |
| PR-25 | GitHub PR #25：Integration 对齐、远端 CI 与候选发布门禁 | DONE | RELEASE |
| WEB-UX-03 | 核心功能闭环整改（Web；数据库 E2E 未验证） | DONE | UI |
| WEB-UX-03.1 | 验收收口（删除确认/服务端删除数据/日程提醒测试） | DONE | UI |
| SYNC-01 | 实时同步整改（前端协调器；真实数据库/双浏览器验收已补齐，完整 Web smoke 已由 WEB-SMOKE-01 收口） | DONE | UI |
| SYNC-01-429-BACKOFF-REMEDIATION | 修复同步 429 请求风暴、状态事件误触发和失败退避 | DONE_LOCAL / UNCOMMITTED | UI/QA |
| SYNC-API-01 | 修正 `/sync/changes` 非空页终止游标契约（无 schema 变更） | DONE_LOCAL | API |
| SYNC-E2E-01 | Daily Assistant 同步真实 MySQL/API 与双浏览器验收 | DONE | QA |
| WEB-SMOKE-01 | 修复真实数据库 Web smoke 的 4 类失败并完成桌面/移动回归 | DONE | UI/QA |

## V1.5 Governance Approval / Normative Freeze note

- 当前远端 Integration HEAD：`6515b8fd0f13969a0e434d3d8223f60a82cb0310`；历史 PR20 记录仍保留旧 ref；H7：`CLOSED`；R1 Quality Gate：`APPROVED / DONE`；H1/H2：`WAIVED_FOR_R1 / UNVERIFIED`。
- ADR-028：`Accepted`；PR20-03A/#22、PR20-03B/#23 deviation：
  `KEEP_AND_RECONCILE`（Dada 已批准）。
- GitHub PR #22/#23 是 PR20 实现切片；canonical R3 PR22/PR23 仍未开始且未修改。
- PR20 Adapter Integration：`DONE_INTEGRATION`；PR20 Live Provider Validation：`DONE_LOCAL / H7_CLOSED`；DeepSeek 本机
  `h7-adr027-fixed-v1` 200 条合成评估已形成脱敏证据，199/200 schema-valid、effect proxy 199/200，提示词补强后的
  3 条定向回归和 `case-146` 三次复测通过；Dada 已确认暂定 DeepSeek、接受条款/结果，并批准 ADR-029 的自然月/暂不设金额上限策略；H7 已由 owner 明确关闭。
- REL-02：`CANCELLED / SEPARATE_STAGING_WAIVED`；REL-03：`READY / EXISTING_ENVIRONMENT`；REL-04：`BLOCKED / NOT_STARTED`。
- CI run `33043413216` 的 `quality`、`db-validation`、`browser-qa` SUCCESS；Playwright report upload skipped。
- 规范冻结提交 `6adc111...` 已完成 post-write review 并进入 Integration；本轮已按用户明确授权创建并推送 release candidate：
  `f7fb90a`、`1545e21`、`d649ad4`，并以 `b7734d0` 完成 Integration 冲突收口。PR20 H7 证据已就绪，
  `case-146`/不确定样例、Provider 条款和当前评估结果已获确认；H7 已关闭；暂不设金额上限不等于生产预算 enforcement，后续仍受 R1/REL-04 独立门禁约束。
- 2026-09-02 已完成 WebKit `iPhone 13` 本机模拟验收：H1 核心页面流程通过，H2 离线新增/联网同步收敛通过；离线重开出现 WebKit 资源错误。记录见 `docs/46-r1-webkit-emulation-validation.md`，不替代 H1/H2 真机门禁。
- 2026-09-02 已通过 `REL-01-DECISION-RECORD-01` 按推荐值批准 D1-D8；`docs/47`/`docs/48` 已同步决策与 REL-02 执行前清单。仍不创建资源、不补充真实记录、不修改部署配置；具体执行参数、R1 通过和独立资源/费用授权仍是 REL-02 前置条件。
- PR #25 当前 `db-validation`、`browser-qa` 通过，`quality` 在依赖审计处 fail-closed；候选未部署，现有 Alibaba 私有预览仍运行 `299b1f71`。通过依赖门禁后再合并部署，后续新功能另开分支/PR。

## 历史交付快照

以下日期记录保留当时的提交、CI、部署准备和门禁事实，已由文件顶部当前执行记录及后续日期覆盖，不作为当前任务状态。

## 2026-09-08 — Prisma candidate delivery authorization

- 用户明确授权继续候选提交、推送及 CI；不包含 merge、部署或 R1 门禁关闭。
- 本次交付仅包含 15 个已审阅的依赖、工具链、安装治理、CI、测试及 README 文件；原有 15 个混合 Markdown 修改保留本地，不混入候选提交。
- 提交前治理测试 30/30、git diff --check 与 staged diff 检查通过。许可证人工结论和发布环境证据仍待完成。
- Delivery: DONE_COMMITTED / DONE_PUSHED / CI_PASS；commit 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，parent 1b8354575cc195584af5ee3b1fe8882eda8c3bdd；PR #25 已自动更新；PR CI 34181552275、push CI 34181550054 均 SUCCESS；各自 quality、db-validation、browser-qa 全部 PASS。此条覆盖前文候选 UNCOMMITTED / CI_NOT_RUN 的历史快照；R1 仍 BLOCKED / NOT_READY。

## 2026-09-08 — PR25 merge and scoped license decision

- 用户明确接受本次许可证处理方案：保留第三方许可证和版权声明，不修改第三方库源码，按实际交付内容核对工具链组件；对外分发后端包/容器或修改库时重新评审。此为当前范围的人工决定，不是对任意未来分发的法律批准。
- 用户独立授权合并 PR #25；已匹配 candidate HEAD 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，并核验 PR/push 两轮 quality、db-validation、browser-qa 全绿。
- PR #25 于 2026-09-08T03:00:13Z MERGED；merge commit 6515b8fd0f13969a0e434d3d8223f60a82cb0310，远端 codex/v15-integration-foundation HEAD 已一致核验。Candidate delivery: DONE_INTEGRATION。合并后 CI 34181985716 SUCCESS，quality、db-validation、browser-qa 全部 PASS：https://github.com/Dada-sys101/richangzhushou/actions/runs/34181985716 。
- 本记录覆盖前文 PR_OPEN、候选 UNCOMMITTED/CI_NOT_RUN 和 LICENSE_APPROVAL_PENDING 的历史快照；本地原有 15 个混合 Markdown 修改保留，当前工作分支不切换，不额外提交记录。
- R1 仍 BLOCKED / NOT_READY：实际发布包许可证声明、目标环境差异与部署验收尚未完成。本次未授权或执行部署、真实数据库迁移、公网切换或发布门禁关闭。

## 2026-09-08 — Release bundle preparation

- 基于已合并且 CI 全绿的 6515b8fd0f13969a0e434d3d8223f60a82cb0310，在 D:/daily-assistant-release-6515b8f 导出精确源码并完成独立 npm 11.18.0 安装（audit 0）、Prisma generate、全部 workspace build/PWA、SBOM 1043 components 校验和许可证清单。
- 准备包：D:/daily-assistant-release-6515b8f/daily-assistant-6515b8f-preparation.tar.gz；说明与逐文件校验：bundle/RELEASE-README.md、bundle/SHA256SUMS.txt。LOCAL_BUNDLE_PREPARED / TARGET_ENVIRONMENT_UNVERIFIED / NOT_DEPLOYED。
- 许可证原文收集覆盖 Windows 已安装包中的 1051/1083；32 包无顶层许可证文件，不能推定无许可或替换通用文本。Linux 原生依赖未打包，最终 Linux 包须按锁文件重建并核对实际交付 notices。
- 相比原服务器基线 299b1f71，Prisma schema/migrations 无变化。未操作服务器、读取真实凭据、执行数据库迁移或部署。下一步只读核对目标路径、Node/npm、数据库实际 transport、代理和备份；不要为未使用的 TLS/代理构造额外门禁。
- 原有 15 个 Markdown 修改保留，当前源码包不含它们；本次无新提交或推送。R1 保持 BLOCKED / NOT_READY。
