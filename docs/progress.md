# 项目进度（派生摘要）

> 当前发布候选代码：`b7734d0`（PR #25，已提交/已推送，尚未部署）；本轮另有独立 package-lock 安全补丁已提交/已推送。Integration `299b1f71` 的私有预览继续运行。PR #25 及本轮质量复核的 `db-validation`、`browser-qa` 已通过，`quality` 仍在依赖审计处 fail-closed。后续新功能另开分支/PR。

updatedAt: 2026-09-03 09:27 +08:00

## Current

- 当前已有 Alibaba 私有预览服务器按 Integration `299b1f71debbd5a3140d1ee19f9781372e67134b` 作为正式预览基线运行；发布包、服务、健康检查、数据库迁移、备份和临时库恢复均已复核通过。真实 iPhone 按用户决定跳过，状态为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`；公网域名仍等待审批。每日备份定时器已配置为北京时间约 03:30 执行，保留 7 天并自动清理，手动执行和清理逻辑复验通过。用户已明确允许当前私有预览开启 live AI，服务器环境与数据库开关已与当前决定一致。
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

当前 canonical task 仍为 `R1 Quality Gate`，状态为 `BLOCKED / NOT_READY`；H7 已 `CLOSED`，`WEB-SMOKE-01` 已完成，独立锁文件补丁已提交推送但核心依赖审计仍未通过。已有私有预览可继续作为正式预览基线运行；PR #25 尚未部署，评估记录见 `docs/49-private-preview-release-assessment.md`。
下一步完成 Prisma 依赖链的兼容修复并重新通过 audit/SBOM/license/quality；门禁变绿后再合并、部署 PR #25 到私有预览并复验。当前私有预览 live AI 与每日备份/7 天清理已按决定配置，跨位置备份和周期性隔离恢复演练作为公网增强项；域名审批通过后再切换公网 HTTPS 并复验，扩大公网 Provider 使用范围需另行授权。真实 iPhone 按用户决定跳过，记录为未验证而非通过。Provider enablement、REL-04 和 R1 advancement 仍按独立发布门禁执行。
ADR-029 的无金额上限策略不等于生产预算 enforcement。后续新功能另开分支/PR，不回写 PR #25。
