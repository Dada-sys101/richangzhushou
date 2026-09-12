# 项目进度（派生摘要）

## 2026-09-11 — MOBILE-B PWA 生命周期（PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PENDING）

- 增加 180/192/512/maskable 图标和完整中文 standalone Manifest。
- 将安装入口从同步徽标移至“我的”：Android 调用原生安装提示，iPhone 展示中文添加到主屏幕步骤，并识别已安装模式。
- Service Worker 改为用户确认更新；检测到新版本时提供“稍后/更新”，存在未保存表单或同步活动时暂缓刷新。
- 完整 `npm run quality` 通过：Web 25 files/129 tests、API 34 files/281 tests，构建、Prisma、OpenAPI、migration diff 与依赖审计通过。
- 提交 `4d86f90` 已推送至 PR #30，两组 CI 矩阵全绿；私有预览已部署 `/opt/daily-assistant-preview/releases/4d86f900-20260911T0846Z` 并通过入口、健康、静态资源与日志检查，等待 iPhone/Android 安装版生命周期验收。
- 根据实机反馈增加页面恢复前台时的版本检查，并让退出后重新登录返回首页；提交 `aebc257` 的两组 CI 最终全绿，修复版已部署至 `/opt/daily-assistant-preview/releases/aebc2570-20260911T0946Z` 并通过部署后复检。
- 第二轮反馈修复 `927dea3` 为更新按钮增加“更新中”和中文失败反馈，重新获取 Service Worker registration，并在 iOS 未触发 controllerchange 时兜底刷新；计划中心默认明确选中当天。本地完整 quality 与两组 CI 全绿，已部署 release `927dea30-20260912T0129Z`，部署后检查通过。
- `d7860cd` 新增 MOBILE-C 草案，将二级页面整理、统一弹窗、日期时间控件和复杂页面迁移拆成四阶段；MOBILE-B 验收前不启动实施。

## 2026-09-11 — MOBILE-A 导航与移动端壳（ACCEPTED / READY_TO_MERGE）

- 建立统一 Navigation Policy，根 Tab 使用 replace，业务列表/详情保留 Browser History；`returnTo` 只表达直接父级并过滤外部或递归值。
- 直接打开详情时写入可预测的业务 fallback，使应用内返回与浏览器/系统返回采用同一浏览器历史来源。
- 20 轮根 Tab 互切硬性场景、深链接返回、未保存表单保护在 375/390/430/768/1440 与 WebKit mobile 自动化中通过；用户已确认真实 iPhone/Android 验收通过。
- 当前已推送并创建 PR #29；认证数据库就绪与全中文错误修复 `77718a0`、未登录缓存隔离修复 `fa0ee53` 的本地质量和两组 CI 全绿，已部署至 `/opt/daily-assistant-preview/releases/fa0ee530-20260911T0738Z`。发布前备份、目标顺序构建、公开数据库健康、中文登录错误响应与日志检查通过，等待实机验收。

## 2026-09-09 — R1.1 Web Push 本地候选

- `codex/web-push-reminders` 已完成订阅/送达模型、字段加密、用户隔离 API、PWA
  Service Worker、提醒页开关、真实 Web Push 适配器、重试与失效处理。
- 临时 MySQL 8.4.9 完成 13 migrations、schema zero-diff 和 18 files/161 tests；Chromium
  受控 Push API 的订阅、刷新恢复、退订、权限拒绝及五档宽度验证通过。
- 最终完整 `npm run quality` 与 audit 0 通过；真实 Push/系统通知/设备送达、远端 CI、部署和启用仍未执行。

## 2026-09-09 — R1.1 Web Push 本地候选

- `codex/web-push-reminders` 已完成订阅/送达模型、字段加密、用户隔离 API、PWA
  Service Worker、提醒页开关、真实 Web Push 适配器、重试与失效处理。
- 临时 MySQL 8.4.9 完成 13 migrations、schema zero-diff 和 18 files/161 tests；Chromium
  受控 Push API 的订阅、刷新恢复、退订、权限拒绝及五档宽度验证通过。
- 最终完整 `npm run quality` 与 audit 0 通过；真实 Push/系统通知/设备送达、远端 CI、部署和启用仍未执行。

## 2026-09-08 — Prisma override 正式兼容性验证（FORMAL_COMPATIBILITY_VERIFIED_LOCAL）

- 复核仓库外最小复现并验证哈希：旧 SBOM `invalid` 根因是 npm 11.13.0 未跨 workspace/file link 传播根 overrides，不是 patched 依赖天然不兼容。
- 本地候选保留 Prisma 7.9.1，精确 override `deepmerge-ts@8.0.2`、`mariadb@3.4.7`、`mysql2@3.24.3`，并以 packageManager、精确 engine、engine-strict 与 CI 断言固定 npm 11.18.0；过期 deepmerge 例外已清空。
- 外部 clean install、npm ls、audit 0、两类 SBOM、治理 30/30、license inventory、完整 quality、一次性 MySQL 8.4.11 18 files/160 tests 和真实数据库 Chromium smoke 44/44 均通过。license 仍有 8 项 missing/unresolved、24 项人工复核。
- 候选仅为本地未提交审阅材料；新候选 CI 未运行，未提交、推送、修改 PR 或部署，远端 PR #25 仍显示旧 quality 失败与旧 db/browser 成功。R1 继续 `BLOCKED / NOT_READY`。证据目录：`D:\daily-assistant-prisma-override-compat-20260908-093516`。

## 2026-09-07 — 执行规则本地同步（DONE_LOCAL / UNCOMMITTED）

- 根据用户要求，将共享审阅对话中的规则澄清落实到本地 AGENTS.md、PLANS.md 与 tasks/PR19.md：常规本地任务无需独立契约，只读任务无需写状态，按影响范围验证，已有有效授权不重复申请，历史限制保持原适用范围。
- 保留提交、推送、PR、合并、迁移、真实服务与部署的独立授权及完整集成/发布门禁。R1 仍为 BLOCKED / NOT_READY；未修改依赖、业务、数据库或部署配置。
- 核查个人 deepseek-direct-worker 和 product-architecture-planner 的相关规则：已支持范围内自主执行，固定 Git 操作保护无需放宽；未修改个人技能或系统/插件技能，也未调用 DeepSeek。
- 原有 12 份未提交文档修改保留；本次只新增规则与进度记录，不创建提交、不推送。下一项建议仍是独立 override/SBOM 最小复现调查。
- 验证：Prettier、npm run check:context 与 git diff --check 均通过；没有重跑业务测试或完整 quality，现有 PR #25 quality 失败、db-validation/browser-qa 成功不因规则调整改变。

> 当前发布候选代码：`b7734d0`（PR #25，已提交/已推送，尚未部署）；当前分支 HEAD 为 `1b83545`（既有 package-lock 安全补丁），本轮稳定矩阵复核没有新增依赖提交。Integration `299b1f71` 的私有预览继续作为运行基线，但按用户要求未视为达到正式预览标准。PR #25 及本轮质量复核的 `db-validation`、`browser-qa` 已通过，`quality` 仍在依赖审计处 fail-closed。后续新功能另开分支/PR。

updatedAt: 2026-09-03 10:32 +08:00

## Current

- 当前已有 Alibaba 私有预览服务器按 Integration `299b1f71debbd5a3140d1ee19f9781372e67134b` 运行；发布包、服务、健康检查、数据库迁移、备份和临时库恢复均已复核通过，但这些证据只证明现有版本可运行，不能替代正式发布门禁。真实 iPhone 按用户决定跳过，状态为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`；公网域名仍等待审批。每日备份定时器已配置为北京时间约 03:30 执行，保留 7 天并自动清理，手动执行和清理逻辑复验通过。用户已明确允许当前私有预览开启 live AI，服务器环境与数据库开关已与当前决定一致。
- `REL-01-DECISION-RECORD-01` 已将 D1-D8 按推荐值全部批准并固化到 `docs/48-r1-approval-decision-pack.md`；REL-01 为
  `APPROVED / REL-02_AUTHORIZATION_PENDING`。该决策不改变 `R1 Quality Gate = BLOCKED / NOT_READY` 或依赖候选的 `CANDIDATE_REJECTED` 状态。
- `SYNC-E2E-01` 已使用 C: 盘之外的 `D:\daily-assistant-runtime` 一次性 MySQL 8.4.11 环境完成真实 API 集成和双浏览器验收（API 17 个文件、155 项通过）。
  两个真实浏览器已完成待办创建、编辑、删除/恢复传播、离线恢复、版本冲突处理和第二用户隔离；五种 viewport 也已完成检查。
- `QUALITY-R1-GOVERNANCE-RECONCILIATION` 的 post-write review 已通过：既有 commit `6adc111492dcbeb35e79475a3d69f6a63007e5bb` 的父提交为 `d53f84a...`，只改 21 个授权 Markdown 文件，治理 worktree clean，Integration 已包含该提交。
- `SYNC-01` 在当前 Web 工作区已实现统一同步协调器：登录、路由进入、focus、visibility 恢复、联网恢复主动拉取，在线可见页面每 7 秒轮询，
  pull/flush 请求去重、游标并发保护、受影响 planner/finance/drafts/trips store 刷新，以及最近同步/待同步/失败/冲突状态展示。
- `SYNC-API-01` 已修正 `/sync/changes`：非空页（包括非空末页）返回最后一条 `(updatedAt,id)` 对应的非空不透明游标；空页返回 `null`。
  前端仍保持 fail-closed，不解码、拼接或伪造游标；未修改 Prisma、数据库 schema 或同步基础设施。
- 当前工作区为 `codex/v15-v2-ui-visual-freeze`；发布候选业务代码仍为 `b7734d0`，本轮仅新增独立 package-lock 安全补丁并已提交推送；后续新功能不混入 PR #25，另开分支/PR。
- `WEB-UX-03` 已完成 Web 核心功能闭环的本地实现：PlannerDetailView 操作、精确 dirty 快照、动态
  returnTo/返回文案、入口语义、错误重试和前端测试。
- `WEB-UX-03.1` 已完成删除确认、服务端删除后重读、Planner store 同步，以及日程/提醒编辑、删除、恢复、失败重试测试。
- `PR20 Live Provider Validation` 已完成本机受控 H7 验证并达到 `DONE_LOCAL / H7_CLOSED`：DeepSeek
  `deepseek-v4-flash` 对可重复数据集 `h7-adr027-fixed-v1` 的 200 条合成数据产生 199/200 schema-valid（99.5%），
  effect proxy 为 199/200（99.5%），服务端/客户端 p95 为 1589/1644 ms；仅使用 D: 盘一次性 MySQL，
  `v15.ai.businessWrite=false`，评估用户正式业务表无增长。
- H7 已为 `CLOSED`，脱敏报告为 `docs/43-pr20-h7-live-provider-validation.md`；Dada 已确认当前阶段暂定 DeepSeek、
  接受条款和评估结果；本轮未启用生产 Provider、未使用真实用户数据、未执行 Qwen/OpenAI 对照。
- 提示词补强后的 3 条真实 Provider 定向回归通过：两条模糊任务返回 `confidence=0.0000`/空字段，
  一条具体任务生成正常字段；完整 200 条评估已重跑，唯一异常 `case-146` 为一次 HTTP 502 / `SCHEMA_INVALID`，
  另行 3/3 复测成功；Dada 已确认接受该评估结果和当前阶段的暂定 DeepSeek。
- 当前远端 Integration HEAD 已通过只读 `git ls-remote` 重核为 `299b1f71debbd5a3140d1ee19f9781372e67134b`；候选分支已在 `b7734d093072c400ca9ae9d44b60abb95a45a725` 对齐该基线。
- `WEB-SMOKE-01` 已修复本地真实数据库 Web smoke 的 AI 提案开关、草稿返回 query、账号关闭后的导航守卫、删除确认及精确状态选择器问题；
  Chromium 桌面/移动项目完整 smoke `44/44 PASS`。
- R1 依赖审计复核已完成：Prisma 7.10.0 与修复版传递依赖候选因 SBOM 将 Prisma 精确依赖声明标为 invalid 而撤回；随后仅更新 `fast-uri` `3.1.5 -> 3.1.7` 和 `qs` `6.15.3 -> 6.16.0`，核心 Prisma 链仍阻塞，详见 `docs/44-r1-dependency-audit-review.md`。
- H1/H2 iPhone Safari、PWA 与离线验收记录模板已补齐：`docs/45-r1-manual-device-evidence-template.md`。
- 已直接运行 WebKit `iPhone 13` 本机模拟：真实 API 下 H1 登录、首页、待办/日程/提醒列表与详情、返回、Back、刷新通过；H2 PWA/Service Worker、缓存离线重开、离线新增、联网自动同步和服务端单条收敛通过，但离线重开期间出现 WebKit 资源错误。结果记录于 `docs/46-r1-webkit-emulation-validation.md`，不替代真机门禁。
- 在 R1 仍被阻塞且不补充真实记录的前提下，按 PLANS.md 允许的提前路径形成并批准 `REL-01` Staging 设计稿
  `docs/47-rel-01-staging-architecture-decision.md`：推荐单实例 API、私网 MySQL 8.4、私有 OSS、HTTPS 入口、最小权限、备份/RPO-RTO、发布与回滚边界；不创建资源、不修改部署配置。
- `REL-01-DECISION-RECORD-01` 同时在 `docs/48` 记录了 REL-02 执行前清单；没有补充真实业务记录、真实用户数据、云资源、凭据或部署动作。
- 本轮仅留下已审查的 package-lock 安全补丁，未改 package 声明、Prisma/migration 或生产部署配置；已按用户授权提交并推送，既有治理提交 `6adc111...` 不作历史改写；候选代码未部署。
- 本任务正式复验未找到完整稳定的 Prisma 兼容版本：稳定三件套 `7.10.0` 仍精确锁定 `deepmerge-ts@7.1.5`、`mariadb@3.4.5`、`mysql2@3.15.3`。`npm ci`、`npm ls`、SBOM、license、治理通过；`npm audit`（1 moderate/5 high）、`audit:dependencies` 和 `quality` fail-closed，`npm run audit` 脚本不存在；依赖、CI、部署均未变更。

## Evidence

- Web lint、typecheck、unit test（21 files / 116 tests）、build、Web sync 定向测试（2 files / 15 tests）、Prettier、
  `git diff --check` 与 `npm run check:context` 均 PASS。
- `REL-01-DECISION-RECORD-01` 本轮限定检查：`npm run check:context`、`npm run format:check`、`git diff --check` 均 PASS；未重复业务测试。
- API lint、typecheck、build、unit（32 files / 277 tests）与 OpenAPI lint、契约测试（151/151）PASS；真实 MySQL WP7 集成
  `17 files / 155 tests PASS`。
- 根 `npm run quality` 未全绿：格式、lint、typecheck、test、build、Prisma、OpenAPI 和 migration 均通过，dependency audit 仍 fail-closed；过期 `deepmerge-ts` 例外及 Prisma/MariaDB/MySQL2 相关高风险依赖尚未有兼容批准修复。
- 锁文件补丁后 `npm ci`、`npm ls`、治理测试 `14/14`、CycloneDX SBOM 生成/校验（1044 components）和 license inventory（1163 packages）PASS；`npm audit` 由 `2 moderate / 6 high` 降为 `1 moderate / 5 high`。
- SYNC-01 真实浏览器仅完成本地登录页加载/刷新/390px/控制台冒烟 PASS；不等同于真实同步验证。
- 本地 Vite + 浏览器内 API mock 的真实浏览器检查 PASS：详情操作、来源返回、刷新、浏览器 Back、非法
  returnTo、控制台和 375/390/430/768/1440 宽度无横向溢出。
- 真实数据库 API 集成已通过；`WEB-SMOKE-01` 真实数据库驱动完整 Web smoke 为 `44/44 PASS`，前述 AI Proposal、草稿确认、账号删除和 navigation-shell 失败均已收口。
- 两个真实浏览器此前在初始拉取阶段触发 429；状态/变更事件拆分与 Web 退避修复后，真实后端传播闭环已补跑通过；清理日志后无 console error/warning，相关 sync/task 请求均返回 200。
- 离线创建先产生本地 pending ID，重连后收敛为服务端 ID，另一浏览器可见；同时离线编辑触发真实 `VERSION_CONFLICT`，在冲突页选择保留服务端后完成收口。
- Playwright 1.62.1 可用；验收服务已在本轮清理，MySQL runtime、数据库和 `output/playwright/sync-e2e-01` 证据保留在 D: 盘。
- 治理复核：`npm run check:context`、`git diff --check` PASS；stash `36039201...` 未变化；没有注册的独立 `pr20-03a` worktree，历史旧路径无法从当前文件系统独立复核。
- H7 安全证据：200 条评估中 1 条 `SCHEMA_INVALID` 失败且原始输入保留；`case-146` 另行 3/3 复测成功；最终确认
  在 `businessWrite=false` 下返回 403 `AI_DISABLED`；评估用户正式业务表均为 0，raw Provider response 未持久化。
- H7 follow-up：提示词已禁止模糊输入生成“待定任务”等占位字段；本机 3 条代表性复测和 `case-146` 三次复测通过，
  服务已停止；评估器入口为 `apps/api/src/cli/h7-live-provider-evaluation.ts`。
- WebKit `iPhone 13` 模拟记录：H1 核心流程通过；H2 离线新增与恢复联网同步收敛到真实服务端对象且无重复，但离线重开出现
  `WebKit encountered an internal error`（页面、manifest 与离线 API 资源），需由物理 iPhone 进一步确认。
- 私有预览远端复核：Integration `299b1f71` 发布包完整性、API/用户端/管理端/Nginx、数据库迁移、受保护备份和临时库恢复校验均 `PASS`；每日备份定时器、7 天保留、过期清理和清理逻辑复验均 `PASS`。
- 私有预览配置复核：环境 `V15_AI_ALLOWED=true`、`V15_LIVE_AI_ALLOWED=true`，数据库 `v15.ai.liveProvider=true`；用户已明确允许当前私有预览开启，不等同于扩大公网 Provider 使用范围或完成生产 Provider 授权。
- 发布候选门禁：PR #25 的 `db-validation`、`browser-qa` `PASS`，`quality` `FAIL_CLOSED`（仅依赖审计）；本地 `npm run quality` 得到相同结果。
- 本轮 CI 与候选部署条件未满足，均为 `NOT_RUN / HELD`；现有 PR #25 的上次远端结果保持不变。

## Open Gates

- `SYNC-E2E-01`：`DONE_LOCAL / API_INTEGRATION_VERIFIED / CROSS_BROWSER_VERIFIED / OFFLINE_RECOVERY_VERIFIED / CONFLICT_VERIFIED / VIEWPORT_VERIFIED`。
- 真实后端双浏览器跨设备验证：创建、编辑、删除/恢复、离线恢复、冲突解决和第二用户隔离均通过；同步后端协议未在本任务中继续修改。
- 完整 Web smoke：`44 passed / 44 tests`（Chromium desktop/mobile），已达到当前本地 Web smoke 验收门禁。
- PR20 Live Provider Validation：`DONE_LOCAL / H7_CLOSED`；提示词变更后的完整评估已完成并达到 provisional schema/effect
  目标；Dada 已确认 DeepSeek、条款和结果，并批准 ADR-029 自然月/暂不设金额上限的临时策略。Provider enablement、REL-04
  和 R1 advancement 仍受独立门禁约束。
- R1 依赖门禁：`BLOCKED`；需要依赖负责人批准上游兼容版本或完整经过兼容性/SBOM/license/发布审查的正式修复，不能用不兼容 override 或自动延长过期例外代替。
- 本轮 commit/push/PR/Integration 冲突收口已获用户明确授权并完成；候选部署仍因 dependency audit fail-closed 暂缓，后续新功能另开分支/PR。
- H1/H2：按用户决定跳过真实 iPhone，状态为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`；WebKit `iPhone 13` 模拟仅为辅助证据，离线重开资源错误作为已知限制保留。
- 私有预览运营配置：live AI 已按用户决定保留开启；每日备份和 7 天清理已完成，跨位置备份与周期性隔离恢复演练尚未配置，属于公网正式运营增强项。
- REL-01：设计稿已完成跨文档自检，D1-D8 已按推荐值批准，状态为 `APPROVED / REL-02_AUTHORIZATION_PENDING`；具体执行参数、资源/费用授权和验收证据仍未具备，不得进入 REL-02。
- `REL-01-DECISION-RECORD-01`：审批记录和 REL-02 执行前清单已形成；REL-01 批准与 REL-02 资源创建授权仍是两个独立决策。

## Next

R1 Quality Gate 已更新为 `APPROVED / DONE`；H1/H2 对本次 R1 advancement 为 `WAIVED_FOR_R1 / UNVERIFIED`。独立 Staging 已豁免，当前 canonical task 为 `REL-03 Private Preview Readiness / READY`。当前私有预览运行 Integration `6515b8f`，评估记录见 `docs/49-private-preview-release-assessment.md`。
下一步在现有私有预览补充轻量 readiness 并固化发布/回滚流程。live AI 与每日备份/7 天清理保持现状；域名审批后再配置公网 HTTPS、精确 CORS 并复验。扩大公网 Provider 使用范围、REL-04 和生产发布仍按独立门禁执行。
ADR-029 的无金额上限策略不等于生产预算 enforcement。后续新功能另开分支/PR，不回写 PR #25。

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
## 2026-09-08 — 私有预览部署在切换前暂停

- 已获授权并完成服务器只读 preflight；上传 `6515b8f` 源码并创建隔离 preparing 目录，目录内 npm 11.18.0 安装成功。
- Linux 依赖安装期间 SSH banner 超时，无法确认构建完成，故在版本切换前暂停。公网首页与 API health 保持 200；未切换版本、重启服务或执行数据库变更。

## 2026-09-08 — 私有预览部署后业务 smoke

- 新 release 上登录、首次改密、待办、日程、账单和刷新持久化均通过，浏览器阻塞错误为 0。
- 一次性 `qa_release_*` 用户及其级联业务数据已定向删除，结果为 `deleted=1 / remaining=0`。
- API 服务保持 active/health 200，切换后 warning/error 日志为空；下一步转为 readiness 与正式/公网发布清单复核。

## 2026-09-08 — R1/readiness 门禁复核

- 依赖、当前范围许可证决定、合并 CI、目标 Linux audit/SBOM/build、私有预览部署和真实业务 smoke 均已完成，不再是当前阻塞项。
- `/api/v1/health` 仅为 liveness，认证后的 `/api/v1/admin/health` 检查数据库；REL-01 D7 已将非敏感 readiness/受控运维组合归入 REL-03，故不作为 REL-02 前置条件。当前私有预览已有启动前数据库检查、liveness 和真实业务 smoke 组合证据。
- 用户已明确批准 H1/H2 对本次 R1 advancement 豁免；H1/H2 保持 `WAIVED_FOR_R1 / UNVERIFIED`，不记为真机通过。R1 Quality Gate 更新为 `APPROVED / DONE`。
- 用户明确决定不建设独立 Staging；REL-02 为 `CANCELLED / SEPARATE_STAGING_WAIVED`，现有 Alibaba 私有预览作为验证环境。当前转入 `REL-03 Private Preview Readiness / READY`；公网 DNS/HTTPS/CORS、Provider 扩展、REL-04 和生产发布分别保留在其适用门禁。
