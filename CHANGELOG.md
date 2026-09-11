# Changelog

## 2026-09-11 — MOBILE-B PWA 生命周期候选

- 完善 Apple touch、192、512 和 maskable 图标，以及 id/scope/start URL、standalone、zh-CN 等 Manifest 字段。
- 新增 Android 原生安装、iPhone 中文安装说明、安装模式识别与用户确认更新。
- 未保存表单或同步活动期间暂缓刷新；本地完整质量通过，等待交付及实机验收。
- 提交 `4d86f90` 已推送至 PR #30，两组 CI 矩阵全绿；已部署至私有预览 release `4d86f900-20260911T0846Z`，等待 iPhone/Android 安装版生命周期验收且尚未合并。

## 2026-09-11 — MOBILE-A PWA 导航策略

- 统一顶部/底部导航和页面返回逻辑，根 Tab 切换使用 replace，避免重复切换形成长返回链。
- `returnTo` 限制为直接父级；直接进入详情时提供浏览器历史 fallback。
- 五档宽度与 WebKit mobile 自动化通过；实机 iPhone/Android 返回操作待验收。
- 已获授权创建任务提交并推送，PR #29 已创建；未合并或部署。
- PR #29 首轮 browser-qa 发现 Browser Back 被附加反向 `returnTo`；现已识别历史遍历并跳过隐式来源注入，本地完整 smoke 52/52 通过。
- 修复后两组 CI 全绿；后续 `7103ad1` 修复退出登录和安装版更新，`77718a0` 修复认证数据库就绪并统一中文错误；`fa0ee53` 修复未登录时错误恢复上一账号缓存，并在退出时等待清除 IndexedDB 与最后用户标记。当前部署为 `/opt/daily-assistant-preview/releases/fa0ee530-20260911T0738Z`，备份、目标顺序构建、公开数据库健康、中文登录错误响应和日志检查通过，旧 release 保留用于回滚。
- 用户确认 iPhone 边缘返回、Android 系统返回及未登录缓存实机验收通过；MOBILE-A 状态更新为 `ACCEPTED / READY_TO_MERGE`，PR #29 尚未合并。

## 2026-09-09 — R1.1 Web Push 本地候选

- 完成最小应用外提醒链路；订阅密钥加密、按用户隔离、发送幂等并保留应用内降级。
- 临时 MySQL 8.4.9 的 13 migrations、18 files/161 tests，以及 Chromium 受控订阅/权限/五档宽度验证通过。
- 当前为 `FORMAL_COMPATIBILITY_VERIFIED_LOCAL / REAL_DELIVERY_NOT_VERIFIED`，未提交、未推送、未部署、未启用。

## 2026-09-09 — R1.1 Web Push 本地候选

- 完成最小应用外提醒链路；订阅密钥加密、按用户隔离、发送幂等并保留应用内降级。
- 临时 MySQL 8.4.9 的 13 migrations、18 files/161 tests，以及 Chromium 受控订阅/权限/五档宽度验证通过。
- 当前为 `FORMAL_COMPATIBILITY_VERIFIED_LOCAL / REAL_DELIVERY_NOT_VERIFIED`，未提交、未推送、未部署、未启用。

## 2026-09-08 — Prisma override 正式兼容性验证（FORMAL_COMPATIBILITY_VERIFIED_LOCAL）

- 本地形成 Prisma 7.9.1 + 精确 patched overrides + npm 11.18.0 候选，清空过期安全例外并补充 fail-closed audit/SBOM 回归测试。
- clean install、依赖树、audit 0、两类 SBOM、license、quality、MySQL 8.4.11 真实集成 18/160 和真实数据库 Chromium smoke 44/44 通过。
- 未提交、推送、修改 PR、运行新候选 CI 或部署；人工 license 与远程 TLS/网络路径仍待后续审批和验证，R1 保持 `BLOCKED / NOT_READY`。

## 2026-09-07 — 执行规则本地同步（DONE_LOCAL / UNCOMMITTED）

- 根据用户要求，将共享审阅对话中的规则澄清落实到本地 AGENTS.md、PLANS.md 与 tasks/PR19.md：常规本地任务无需独立契约，只读任务无需写状态，按影响范围验证，已有有效授权不重复申请，历史限制保持原适用范围。
- 保留提交、推送、PR、合并、迁移、真实服务与部署的独立授权及完整集成/发布门禁。R1 仍为 BLOCKED / NOT_READY；未修改依赖、业务、数据库或部署配置。
- 核查个人 deepseek-direct-worker 和 product-architecture-planner 的相关规则：已支持范围内自主执行，固定 Git 操作保护无需放宽；未修改个人技能或系统/插件技能，也未调用 DeepSeek。
- 原有 12 份未提交文档修改保留；本次只新增规则与进度记录，不创建提交、不推送。下一项建议仍是独立 override/SBOM 最小复现调查。
- 验证：Prettier、npm run check:context 与 git diff --check 均通过；没有重跑业务测试或完整 quality，现有 PR #25 quality 失败、db-validation/browser-qa 成功不因规则调整改变。

> 本文件按日期记录历史事实；旧条目的门禁、commit 和部署状态不代表当前状态，当前执行事实以 `PLANS.md` 与 `.project/v15-execution-state.md` 为准。

## 2026-09-03 — R1-STABLE-PRISMA-MATCH-RECHECK（BLOCKED / NOT_READY）

- 重新验证 npm registry 后确认，稳定 Prisma 匹配版本为 `7.10.0`，但其精确传递依赖仍为 `deepmerge-ts@7.1.5`、`mariadb@3.4.5`、`mysql2@3.15.3`；修复版本不能自然解析，Prisma `8.0.0-rc.12` 为预发布且没有完整配套稳定组合。
- `npm ci`、`npm ls`、SBOM、license、治理通过；`npm audit` 为 `1 moderate / 5 high`，`npm run audit:dependencies` 与 `npm run quality` fail-closed，`npm run audit` 脚本不存在。未改依赖、未运行 CI、未部署候选，R1 继续阻塞。

## 2026-09-03 — PRIVATE-PREVIEW-FORMAL-STANDARD-RECONFIRMATION（BLOCKED / NOT_READY）

- 根据用户最新要求，私有预览版与正式版使用同一发布标准；现有 Alibaba Integration `299b1f71` 仅保留为运行基线，不视为已通过正式预览门禁。
- 复核确认稳定 Prisma `7.10.0` 仍精确锁定未通过审计的 `deepmerge-ts`、`mariadb`、`mysql2` 版本；Prisma 8 仍为 RC，且配套客户端/适配器不完整。本轮未采用预发布版本、依赖覆盖或临时例外，也未部署候选。
- `npm run audit:dependencies` 继续 fail-closed，PR #25 的 `db-validation`、`browser-qa` 通过而 `quality` 失败；待取得稳定兼容修复并完成全量门禁后再发布预览版本。

## 2026-09-03 — R1 依赖门禁增量修复（DONE_PUSHED / QUALITY_STILL_BLOCKED）

- 在不改变业务代码、架构、Prisma/schema/migration 或部署配置的前提下，仅更新 `package-lock.json`：`fast-uri` `3.1.5 -> 3.1.7`、`qs` `6.15.3 -> 6.16.0`。
- `npm ci`、`npm ls`、治理测试 `14/14`、CycloneDX SBOM（1044 components）和 license inventory（1163 packages）通过；完整 `npm run quality` 仅在依赖审计处 fail-closed。
- `npm audit` 由 `2 moderate / 6 high` 降为 `1 moderate / 5 high`；Prisma 7.9.1 的精确传递依赖链和过期例外仍阻塞 R1，未绕过门禁部署候选。
- 本次锁文件修复已独立提交并推送到 PR #25；Alibaba 私有预览继续运行 Integration `299b1f71`，后续新功能仍另开分支/PR。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-CANDIDATE-01（DONE_PUSHED / PR_OPEN / QUALITY_BLOCKED）

- 按用户授权，将已验证的 Web/V2 导航、离线同步、AI 提示词与评估、契约/测试及发布运营文档拆分为 `f7fb90a`、`1545e21`、`d649ad4` 三个逻辑提交。
- 与 Integration `299b1f71` 对齐并收口 12 个前端冲突；修复合并后重复的 `/records`、`/plan` 路由，合并提交为 `b7734d0`，分支已推送并创建 GitHub PR #25。
- 本地和远端功能验证通过；PR #25 的 `db-validation`、`browser-qa` 通过，`quality` 仍在依赖审计处 fail-closed。未绕过门禁部署候选代码，现有 Alibaba 私有预览继续运行 `299b1f71`。
- 后续新功能不回写 PR #25；待兼容依赖修复并重新通过 audit/SBOM/license/quality 后，再合并、部署并复验私有预览。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-01（OPERATIONAL / PUBLIC_NOT_READY）

- 按用户决定跳过真实 iPhone 验证，标记为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`；不把 WebKit 模拟结果写成真机通过。
- 复核已有 Alibaba 私有预览：Integration `299b1f71` 发布包完整性、API/用户端/管理端/Nginx、数据库迁移和服务状态均通过。
- 生成受保护数据库备份，并在临时恢复库中校验 25 张表、14 条迁移记录；服务器已配置每日备份、7 天保留和过期自动清理，手动执行与清理逻辑复验通过；跨位置备份、周期性隔离恢复和公网域名切换仍未完成。
- 用户已明确允许当前私有预览开启 AI；服务器环境 `V15_AI_ALLOWED=true`、`V15_LIVE_AI_ALLOWED=true`，数据库 `v15.ai.liveProvider=true`，与当前决定一致。该决定不自动扩大公网 Provider 使用范围。
- `npm run audit:dependencies` 仍 fail-closed；Prisma 兼容修复候选因 SBOM invalid 已撤回，当前不发布本地混合未提交工作区。详见 `docs/49-private-preview-release-assessment.md`。

## 2026-09-02 — REL-01-DECISION-RECORD-01（APPROVED / REL-02_AUTHORIZATION_PENDING）

- 用户已确认 D1-D8 按 `docs/47` 推荐值批准；批准记录固化于 `docs/48-r1-approval-decision-pack.md`，并补充 REL-02 执行前检查清单。
- REL-01 设计决策已批准，但本轮未获得明确的 staging 资源创建授权；未创建资源、凭据、部署或真实记录。
- R1 Quality Gate 继续 `BLOCKED / NOT_READY`；H1/H2 继续 `PARTIAL`；依赖审计候选仍为 `CANDIDATE_REJECTED`，没有通过正式供应链门禁的依赖修复。
- 仅运行上下文、格式和差异检查，未重复业务测试，未提交、推送、创建 PR 或部署。

## 2026-09-02 — R1-APPROVAL-PACKAGE-01（DONE_LOCAL / APPROVAL_PENDING）

- 复核 R1 当前阻塞：H1/H2 仍缺物理 iPhone 正式证据，WebKit 模拟仅作辅助；H2 离线重开资源错误仍需真机确认。
- 确认依赖审计候选已因 SBOM 精确依赖声明 invalid 撤回，当前没有通过兼容性、SBOM、license 和发布检查的正式修复。
- 新增 `docs/48-r1-approval-decision-pack.md`，汇总 D1-D8 推荐值、状态、负责人、批准前置条件，并明确 REL-01 批准不等于 REL-02 资源创建授权。
- 本轮限定检查 `npm run check:context`、`npm run format:check`、`git diff --check` 均通过；未重复业务测试。
- 未补充真实记录、未使用真实用户数据、未创建资源、未修改业务代码或部署配置，未创建提交、推送、PR 或部署。

## 2026-09-02 — REL-01 Staging 架构与发布边界设计稿（DESIGN_REVIEWED / APPROVAL_PENDING）

- 在不补充真实记录、不创建云资源、不修改部署配置的前提下，新增 `docs/47-rel-01-staging-architecture-decision.md`。
- 设计稿收敛了单实例 API、私网 MySQL 8.4、私有 OSS、HTTPS、最小权限、费用控制、备份/RPO-RTO、监控、发布和回滚边界。
- 已完成与现有架构、发布清单、部署样例和健康检查实现的跨文档自检；云厂商/地域、域名/TLS、基础设施预算、RPO/RTO 和 readiness 方案仍待人工批准；R1、H1/H2、REL-02/03 状态不变。

## 2026-09-02 — R1 H1/H2 WebKit 本机模拟验收（DONE_LOCAL / NON_FORMAL_EVIDENCE）

- 在 `D:\daily-assistant-runtime` 一次性 MySQL/API/Web 环境中，使用 Playwright WebKit `iPhone 13` 模拟完成真实页面验收；H1 登录、首页、待办/日程/提醒列表与详情、返回、浏览器 Back、刷新通过。
- H2 的 manifest/Service Worker、缓存离线重开、离线新增、恢复联网自动同步和服务端去重通过；离线重开期间记录到 WebKit `internal resource error`，因此不将模拟结果视为 H2 真机通过。
- 新增 `docs/46-r1-webkit-emulation-validation.md`；H1/H2 仍为 `PARTIAL`，正式门禁仍需物理 iPhone Safari/PWA 记录。本轮测试服务、临时数据库和浏览器会话已清理，未创建提交、推送、PR 或部署。

## 2026-09-02 — R1 依赖审计兼容性复核（DONE_LOCAL / CANDIDATE_REJECTED）

- 评估 Prisma 7.10.0 与修复版传递依赖候选；由于 npm SBOM 将 Prisma 的精确传递依赖声明标为 invalid，候选已撤回。
- 回滚后依赖树无净变更；`npm ci`、`npm ls`、治理测试 14/14、CycloneDX SBOM 生成/校验（1044 components）和 license inventory（1163 packages）通过。
- `npm run audit:dependencies` 仍 fail-closed；R1 继续等待兼容的正式依赖修复、H1/H2 真机证据和后续门禁，不以 override 或自动延长例外关闭。
- 新增 `45-r1-manual-device-evidence-template.md`，用于归档 H1 iPhone Safari 与 H2 PWA/离线重开结果。
- 详见 `docs/44-r1-dependency-audit-review.md`。

## 2026-09-01 — WEB-SMOKE-01 真实数据库 Web 冒烟收口（DONE_LOCAL / UNCOMMITTED）

- 修复本地 E2E fake-AI 环境开关、草稿返回 URL 的 query 匹配、账号关闭后的未保存导航守卫，以及删除确认和状态选择器契约。
- Web lint、typecheck、unit `21 files / 116 tests`、build、Prettier、`git diff --check` 通过；真实数据库 Chromium desktop/mobile 完整 smoke `44/44 PASS`。
- 本轮未修改 API、Prisma、数据库 schema、同步后端或部署配置；D 盘一次性 MySQL/API/Web/admin 服务已在验收后停止，未创建提交、推送、PR 或部署。
- 该结果移除完整 Web smoke 阻塞，但 R1 Quality Gate 仍受现有依赖审计、H1/H2、Provider enablement 和 REL-04 等独立门禁约束。

## 2026-09-01 — H7 人工门禁关闭（PR20 DONE_LOCAL / H7_CLOSED）

- Dada 已明确关闭 H7；关闭依据为已归档的 DeepSeek 脱敏评估证据、提示词补强回归、`case-146` 3/3 复测、正式写入隔离和当前阶段决策确认。
- PR20 Live Provider Validation 更新为 `DONE_LOCAL / H7_CLOSED`，下一状态转入 `R1 Quality Gate BLOCKED / NOT_READY`。
- H7 关闭不授权生产 Provider、真实用户/生产数据评测、REL-04、R1 advancement、提交、推送、PR 或部署；暂不设金额上限仍不提供金额超支保护。

## 2026-09-01 — PR20 H7 当前阶段决策确认（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- Dada 已确认当前阶段暂定 DeepSeek `deepseek-v4-flash`，接受本轮 Provider 条款复核和评估结果，
  包括 `case-146` 随机失败样本与 provisional schema/effect 判断。
- ADR-029 已接受：用量按 `Asia/Shanghai` 自然月观察，暂不设置固定金额 warning/hard ceiling；保留规范化 token/provider/
  model/status/time 元数据，不进行费用换算或金额拦截。该临时策略不等于生产预算 enforcement。
- H7 仍为 `OPEN / EVIDENCE_READY`，当前仅剩 owner 显式关闭；Provider enablement、REL-04 和 R1 advancement
  仍受独立发布门禁约束。未创建提交、推送、PR、合并或部署。

## 2026-09-01 — PR20 H7 提示词补强后全量复跑与证据收口（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 使用可重复数据集 `h7-adr027-fixed-v1` 完成提示词补强后的完整 200 条本机合成评估：DeepSeek
  `deepseek-v4-flash` 199/200 schema-valid（99.5%），effect proxy 199/200（99.5%），正向 184/185，
  不确定处理 15/15，服务端/客户端 p95 为 1589/1644 ms。
- 唯一异常为 `case-146` 一次 HTTP 502 / `SCHEMA_INVALID`；失败输入保留，随后 3/3 定向复测成功；评估用户
  正式业务表均为 0，`businessWrite=false` 下最终确认仍返回 403 `AI_DISABLED`。
- 新增可重复评估器 `apps/api/src/cli/h7-live-provider-evaluation.ts`，更新脱敏 H7 报告并记录官方 Provider 条款
  复核限制。H7 仍 `OPEN / EVIDENCE_READY`；预算 enforcement、隐私批准、最终阈值/Provider 选择和人工关闭待定。

## 2026-09-01 — PR20 H7 本机受控 Provider 验证（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 在 `D:\daily-assistant-runtime` 的一次性 MySQL 8.4.11 环境中，以合成数据完成 DeepSeek
  `deepseek-v4-flash` canary、10 条 pilot 和 ADR-027 规定的 200 条评估；200 条中 199 条 schema-valid，
  schema success rate 为 99.5%，p95 延迟 1449 ms。
- 修正 DeepSeek adapter 的 JSON Proposal 输出约束并补充定向测试；一条域校验失败保留原始输入，未保留 raw
  Provider response；失败复测成功，但仍需人工处理该随机失败和两条歧义结果。
- `v15.ai.businessWrite=false` 全程保持；最终确认返回 403 `AI_DISABLED`，评估前后正式业务表基线不变，未发生正式写入。
- H7 仍为 `OPEN / EVIDENCE_READY`，R1 Quality Gate 仍为 `BLOCKED / NOT_READY`；生产预算 enforcement、Provider/model/
  effect thresholds、隐私条款复核和 H7 人工关闭待完成。未启用 Provider，未使用真实用户数据，未创建提交、推送、PR 或部署。
- 脱敏证据：`docs/43-pr20-h7-live-provider-validation.md`。

## 2026-09-01 — PR20 H7 歧义输入定向回归（DONE_LOCAL）

- 收紧 DeepSeek adapter 提示词：关键事实缺失、模糊或占位值必须返回 `UNCERTAIN`，禁止生成“待定任务”等占位字段。
- 本机真实 Provider 复测 3 条合成样例：两条模糊任务归一为 `confidence=0.0000` 且无字段，一条具体任务正常生成
  `title/dueAt/priority`；服务和 MySQL 已在复测后停止。
- 完整 200 条评估未因提示词变更而重跑；H7 仍 `OPEN / EVIDENCE_READY`，后续需在授权窗口重跑全量再决定最终阈值。

## 2026-09-01 — QUALITY-R1 Governance post-write review（PASS / EXISTING COMMITTED ARTIFACT）

- 只读复核既有治理提交 `6adc111492dcbeb35e79475a3d69f6a63007e5bb`：父提交为要求的 `d53f84a...`，只修改 21 个授权 Markdown 文件，专用治理 worktree clean。
- `npm run check:context`、提交差异 `git diff --check`、stash 完整性和远端 ancestry 通过；治理 CI `33048729907` 与最新 Integration CI `33147816383` 的三个 job 均 SUCCESS，Playwright 报告上传跳过。
- ADR-028 仍为 `Accepted`，两项 deviation 为 `KEEP_AND_RECONCILE`，H7 仍 `OPEN`，R1 Quality Gate 仍 `BLOCKED / NOT_READY`；未执行真实 Provider 或凭据评测。
- 当前活动 worktree 的后续 UI/同步修改保持不变；本轮未创建新的提交、推送、PR、合并或部署。PR20 Live Provider Validation 继续 `BLOCKED / H7`。

## 2026-09-01 — SYNC-E2E-01 真实同步验收收口（DONE_LOCAL / UNCOMMITTED）

- 在 `D:\daily-assistant-runtime`（C: 盘之外）使用一次性 MySQL 8.4.11 完成真实 API 集成和 Web 双浏览器验收；API 结果为
  `17 files / 155 tests PASS`，API/Web/admin 服务在验收后已清理。
- 两个真实浏览器完成待办创建、编辑、删除/恢复传播；离线创建在重连后收敛为真实服务端 ID；同时离线编辑触发真实
  `VERSION_CONFLICT` 并在冲突页选择保留服务端；第二用户隔离通过。
- 375/390/430/768/1440 五种 viewport 均无横向溢出；清理日志后无 console error/warning，相关 sync/task 请求均返回 200。
- 现有完整 Web smoke 仍为 `22 passed / 22 failed`，不作为本轮同步验收通过的替代；未创建提交、推送、PR 或部署。下一项建议为
  `QUALITY-R1-GOVERNANCE-RECONCILIATION` post-write review gate。

## 2026-08-31 — SYNC-01 429 限流与失败退避修复（DONE_LOCAL / UNCOMMITTED）

- 拆分同步状态事件与本地变更事件，避免失败状态更新被误判为本地写入并触发新的强制同步。
- 保留 HTTP 429 状态；限流后暂停自动同步 60 秒，普通失败采用指数退避，手动重试仍可立即执行，并将页面提示改为已暂停自动重试。
- 补充同步请求错误、事件原因和协调器退避测试；Web lint、typecheck、build 通过，Web 全量单元测试 `21 files / 116 tests PASS`。
- 真实浏览器中的受控 429 响应复测通过：点击重试后连续观察 10 秒无新增同步请求；该检查只验证客户端行为，真实双浏览器传播尚未重跑，不宣称实时同步已完成。

## 2026-08-31 — SYNC-E2E-01 真实验收检查点（PAUSED / BLOCKED_429）

- 在 `D:\daily-assistant-runtime`（C: 盘之外）使用一次性 MySQL 8.4.11 完成真实 API 集成验收：17 个测试文件、155 项全部通过。
- 既有完整 Web smoke 实际结果为 22/44 通过、22/44 失败；失败集中在 AI Proposal、草稿确认、账号删除和 navigation-shell 选择器，未在本轮扩展修复范围。
- 两个真实浏览器进入待办页后，`/sync/changes` 与 `/sync/status` 返回 429，页面显示 `同步失败 / Too many requests`，并产生高频 429；
  用户中断了跨设备对象创建/传播，因此不能宣称双浏览器同步通过。
- 发现同步失败后缺少 429 专用轮询冷却/退避；下一项应建立 `SYNC-01-429-BACKOFF-REMEDIATION`，完成后再补跑双浏览器、离线、冲突/墓碑和五宽度验收。
- 验收服务已清理；WEB-UX-02/03/03.1、SYNC-01、SYNC-API-01 既有未提交修改保留，未提交、推送、创建 PR 或部署。

## 2026-08-31 — SYNC-E2E-01 真实同步环境验收（BLOCKED / NOT_RUN）

- 完成状态恢复和运行条件核对：`TEST_DATABASE_URL`、`E2E_DATABASE_URL`、`DATABASE_URL` 均未设置，
  本机没有 MySQL/API/Web 监听服务；已有 E2E 启动脚本会拒绝在缺少专用测试库时启动。
- 真实 MySQL API 集成、双浏览器同步、离线恢复、冲突/墓碑、用户隔离和五个 viewport 的真实浏览器检查
  均未运行；没有以 API mock 结果替代真实数据库验收。
- 未修改业务代码或同步协议，未创建提交、推送、PR 或部署；等待专用测试数据库环境。

## 2026-08-31 — SYNC-API-01 增量同步游标契约修正（本地未提交）

- `/sync/changes` 现在对每个非空页（包括非空末页）返回基于最后一条 `(updatedAt,id)` 变更生成的非空不透明游标；
  只有空页返回 `nextCursor: null`。
- 同步共享 TypeScript 类型、OpenAPI 条件 schema、API 文档和 WP7 集成测试；未修改 Prisma、数据库 schema、WebSocket/SSE、
  消息队列或既有 Web 同步 fail-closed 保护。
- API/契约/Web 定向测试通过；`TEST_DATABASE_URL`/`E2E_DATABASE_URL` 缺失，真实数据库集成和双浏览器同步未验证。
- 根 `npm run quality` 在既有 dependency audit（`@prisma/adapter-mariadb`、`mariadb`）处失败；未创建提交、推送、PR 或部署。

## 2026-08-29 — SYNC-01 实时同步整改（本地未提交 / API 契约阻塞）

- `apps/web` 增加统一同步协调器：登录、路由进入、focus、visibility 恢复和联网触发主动拉取；在线可见页面每 7 秒轮询，
  对并发 pull/flush 去重并保护游标不倒退。
- 同步成功按实体类型刷新 planner、finance、drafts、trips store；同步徽标显示最近同步、待同步、失败和冲突，既有离线队列继续保留。
- 复核现有 `/sync/changes` 发现非空末页返回 `nextCursor: null`，缺少可由前端安全持久化的终止游标；未修改后端或伪造游标，任务保持 BLOCKED。
- Web lint/typecheck/unit（21 files / 112 tests）/build、context、diff-check PASS；真实数据库 E2E 与双浏览器同步 NOT_RUN。
- 根目录 `npm run quality` 未通过：既有 dependency audit 拒绝未批准的高/严重包
  `@prisma/adapter-mariadb`、`mariadb`；本次未修改依赖文件。

## 2026-08-29 — WEB-UX-03.1 验收收口（本地未提交）

- 详情页、待办、日程、提醒列表删除增加明确二次确认；删除后不再用客户端当前时间或本地 version
  推导墓碑，而是 DELETE 后读取服务端对象并同步详情与共享 Planner store；离线删除继续走既有本地队列。
- 补齐日程/提醒编辑、删除、恢复、失败重试和共享 store 测试；新增列表删除确认覆盖。Web unit 为
  20 files / 100 tests。
- mocked browser PASS（含日程/提醒编辑、删除确认、恢复、返回、刷新、Back、非法 returnTo 和五个宽度）；
  `E2E_DATABASE_URL` 缺失，真实数据库 E2E 与跨浏览器同步验证均未运行。
- 只读重核当前远端 Integration HEAD 为 `299b1f71debbd5a3140d1ee19f9781372e67134b`；未创建提交、
  推送、PR 或部署。

## 2026-08-29 — WEB-UX-03 核心功能闭环整改（本地未提交）

- 用户端 PlannerDetailView 支持待办、日程、提醒的编辑、完成/取消、重新安排、软删除/恢复；成功后
  更新当前详情和共享 Planner store，失败显示错误与重试入口。
- 编辑页面改用初始表单快照判断 dirty；列表/详情来源通过站内 `returnTo` 传递，返回按钮文案按实际
  目标动态显示，路由非法返回目标安全回退。
- 统计入口改为“账单明细”，保留真实 CSV 导出页面；补充页面/单元测试与 navigation-shell E2E。
- Web lint、typecheck、18 个单元测试文件共 90 项、build、Prettier、context/diff 检查通过；浏览器
  使用本地 API mock 验证了操作、刷新、Back、非法 returnTo 和 375/390/430/768/1440 宽度。
- `E2E_DATABASE_URL` 缺失，真实数据库 E2E 未运行；未创建提交、推送、PR 或部署。

## 2026-08-27 — QUALITY-R1 Governance Approval / Normative Freeze Write（本地未提交）

- Dada 明确批准 ADR-028、PR20-03A/#22 与 PR20-03B/#23 的 `KEEP_AND_RECONCILE` disposition，
  并授权规范 Markdown 冻结写入。
- 当前 Integration 为 `codex/v15-integration-foundation@d53f84a…`；PR20 Adapter Integration
  为 `DONE_INTEGRATION`，PR20 Live Provider Validation 为 `BLOCKED / H7`。
- H7 保持 `OPEN`，继续阻塞真实 Provider calls、real credential/secret use、real-data/provider
  evaluation、Provider enablement、REL-04 和 R1 advancement；R1 Quality Gate 仍为
  `BLOCKED / NOT_READY`；REL-02/03/04 仍为 `BLOCKED / NOT_STARTED`。
- Integration CI run `33043413216` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  `supply-chain-governance` 与 `pr6a-mysql84-evidence` 存在，但 Playwright report upload 被跳过。
- docs/40 升为 V1.2；ADR-026/027 normative content、PR19 V10 scope、实现/数据库/CI/环境、
  commit、push、PR、merge、部署和 stash 未改；当前停在 `NORMATIVE FREEZE POST-WRITE REVIEW GATE`。

## 2026-08-27 — QUALITY-R1 Governance Reconciliation Gate 1（历史前置记录，本地未提交）

- 从远端只读重新核验 `codex/v15-integration-foundation@56ffd3dc…`，在独立
  `D:\daily-assistant-worktrees\quality-r1-governance-draft-write` worktree 执行治理草案写入。
- 记录 PR19（GitHub PR #18）已达到 `DONE_INTEGRATION`，以及 PR20-01/#20、PR20-02/#21、
  PR20-03A/#22、PR20-03B/#23 已进入 Integration 的 adapter integration 事实。
- 新增 ADR-028（`PROPOSED / AWAITING_DADA_APPROVAL`）和
  `QUALITY-R1-GOVERNANCE-RECONCILIATION`（`DRAFT / AWAITING_APPROVAL`）；提出但未生效的
  两阶段语义为 adapter integration `DONE_INTEGRATION`、live Provider validation `BLOCKED / H7`。
- PR20-03A/#22 与 PR20-03B/#23 historical scope deviation 保持
  `PENDING_DADA_DISPOSITION`；`KEEP_AND_RECONCILE` 仅为建议值。canonical R3 PR22/PR23 未修改。
- Integration CI run `33035100661` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  artifacts 为 `supply-chain-governance` 与 `pr6a-mysql84-evidence`，browser report upload 被跳过。
- H7 保持 `OPEN`，R1 Quality Gate 保持 `BLOCKED / NOT_READY`；docs/40 V1.1、ADR-026/027、
  apps、packages、Prisma/migration、CI、环境、commit、push、PR、merge、部署和 stash 未改动。
- Gate 1 在 `COMMIT AUTHORIZATION GATE` 停止。

## 2026-08-12 — PR2 AI DB Expand 最终本地验收

- Oracle MySQL 8.4.9 fresh empty DB 完整应用 10 migrations；focused AI 12/12、account deletion 11/11、全量 DB integration 15 files / 117 tests 全部通过，无 skip。
- 永久删除后四张 AI 表 residual 均为 0，User `DELETED` tombstone 保持；`quality`、`check:context`、`git diff --check` 和最终 diff review 通过。
- 验证中最小修复 AI schema focused test 对三个 `created_at DEFAULT CURRENT_TIMESTAMP(3)` 的漏断言；状态为 `DONE / DONE_LOCAL / UNCOMMITTED`。

## 2026-08-11 — AI-DECISION-001 v1.0 Final 本地落地

- PR6a 已通过 PR #11 达到 `DONE / DONE_INTEGRATION`，integration HEAD 已核验为
  `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`；当前任务切换为 AI-DECISION-001。
- 新增 Accepted ADR-027 与任务契约，冻结 DeepSeek→阿里云百炼 / Qwen→OpenAI（仅对照）的
  候选顺序、五个模型候选、服务端 AiProviderAdapter 调用路径、credential/唯一 whitelist/
  logging/retention 边界、失败保留输入和 Proposal 最终确认链。
- 冻结 timeout 15 seconds、最多 retry 1 次、rolling 20 requests 熔断策略、每用户
  ¥3/¥5 monthly warning/hard 与总体 ¥30/¥50 monthly warning/hard，以及 200 条非真实评测数据规范。
- provisional thresholds 为 Schema success `>=99%`、无需完全重录 `>=85%`；四项 immutable
  safety thresholds 不得被 PR20 降低。当前不冻结唯一 Provider，PR20 后 final provider/model/
  effect thresholds 仍需再次人工批准。
- 本任务只落地策略，状态为 `DONE / DONE_LOCAL`；未修改代码、Prisma/migration、正式 CI、依赖或
  lockfile，未访问 credential、执行真实评测/调用、创建云资源、add、commit、push、PR、merge 或部署。

## 2026-08-10 — PR6a 临时 MySQL 8.4 验证入口（本地）

- 核验 PR #10 已合并，integration HEAD 为 `371a43d...`，同步 V15-CTRL-001
  `DONE_INTEGRATION` 与 PR6a 开工快照。
- Round 1 将 `npm run validate:mysql84:temporary` 收紧为 loopback-only；bootstrap 管理凭据与随机
  scoped DB user 完全分离，并加入 guard isolation、child env allowlist、全流脱敏、partial-create
  cleanup、Windows/POSIX 进程树终止、有界 readiness 和稳定退出码。
- focused tests 1 file / 26 tests PASS；MySQL 8.4.9 两次 fresh DB/user 均通过 9 migrations、
  14 files / 105 DB tests；failure exit 41、真实 SIGINT exit 60，四次 DB/user 残留均为 0。
- 四个本地 JSON evidence 与 `.sha256` sidecar 4/4 匹配；quality/context/diff 均通过，临时实例
  已停止且数据目录移入回收站。
- 未修改业务功能、Prisma schema/migrations、依赖或正式 CI；未 add、commit、push、创建 PR 或部署。

## 2026-08-10 — V15-CTRL-001 v2.1.1 Final 本地落地（未提交）

- 人工批准 V1.5 v2.1.1 Final、ADR-026 发布映射、REL-01/02 调整、PR18/20 范围、
  AI provisional/安全阈值、Task Selection Policy 和 main/tag 发布门禁。
- 本地将 PLANS 更新为自包含 v2.1.1，ADR-026 标为 Accepted，docs/40 升级 V1.1，
  execution-state 改为双维度状态与非实时快照语义，并同步必要派生文档。
- 本条记录不表示已 commit、push、更新 PR #10、merge、创建资源、部署、迁移或调用真实 AI。

## 2026-08-07 — PR #6 合并到 main
- PR #6（feat: add Aliyun OSS storage adapter）已 squash 合并到 main（merge commit `db5c5d3`），
  远程任务分支 `codex/aliyun-oss-storage-adapter` 已删除。
- main CI run `31158434661`：quality SUCCESS、browser-qa SUCCESS；本地 quality PASS、smoke 20/20。
- Aliyun OSS 适配器、`STORAGE_PROVIDER` 配置切换、`StorageKeyService` 与测试已进入 main；
  `LocalStorageAdapter` 仍仅用于本地与测试。
- 未创建真实 OSS Bucket/RAM/凭据；未执行真实上传/读取/删除与备份上传验证；staging 未创建、
  生产未部署；OPEN-006 仍为部分完成。

## 2026-08-07 — PR #6 创建与 CI 验证
- PR #6（feat: add Aliyun OSS storage adapter）已创建：base=main、head=codex/aliyun-oss-storage-adapter、
  head SHA `11614ba5d26fabc13595974471f0c13f642cb3a2`。
- quality 与 browser-qa 均 SUCCESS（run `31156557067`、`31155080018`）；mergeable=true、
  无冲突、未发现真实密钥或敏感配置；尚未合并到 main（当时状态；随后已 squash 合并，见下条）。
- 历史情况：最初因本地 `gh` 未登录无法创建 PR；后续状态：PR #6 已创建，CI 已通过。

## 2026-08-07 — OPEN-006 对象存储接入代码实现
- 新增 `AliyunOssStorageAdapter`（ali-oss 6.23.0）：实现 `StorageAdapter` 的 `put/get/delete`，
  缺失对象删除幂等，网络错误包装为不泄漏 AccessKey/正文的可诊断错误。
- 新增 `STORAGE_PROVIDER=local|oss` 切换与必填校验（Bucket/Region/Endpoint/AccessKey）；
  `NODE_ENV=production` 禁止 local，未显式配置也启动失败（staging 门禁）。
- 新增 `StorageKeyService`：新附件键 `users/{userId}/attachments/{fileId}`；
  旧 `attachments/` 键保留兼容读取与删除；上传仍由 API 服务端代理，无需 OSS CORS。
- 新增/更新单元测试 22 项；新增 `deploy/staging/.env.staging.example`（仅占位符）。
- 未创建真实 OSS Bucket/RAM、未完成真实连通测试；staging 未创建、生产未部署；OPEN-006 未关闭。

## 2026-08-07 — E2E 修复 PR #4 合并，main 全绿
- PR #4（fix: use 24-hour clock in e2e datetime helper）以 squash 方式合并到 main，
  merge commit `47c40c9`；E2E 时间助手强制 24 小时制，跨正午边界不再误报 endsAt<startsAt。
- main CI run `31144549537`：quality SUCCESS、browser-qa SUCCESS。
- 状态文档 PR #5 已合入最新 main，同步 PR #4 已合并与 main CI 全绿。

## 2026-08-07 — PR #3 合并与 main 验证
- PR #3（test: automate browser release smoke checks）以 squash 方式合并到 main，
  merge commit `4fcc613`；V1 发布决策（OPEN-001/005/011）与 OPEN-009 进入 main。
- main CI run `31143350121`：quality PASS；browser-qa 的 E2E 时间助手 12/24 小时制缺陷
  已由 PR #4（`47c40c9`）修复，后续 main run `31144549537` quality/browser-qa 均 SUCCESS。
- 合并后本地验证：`npm run quality` PASS、smoke 20/20、完整矩阵 70/70。
- OPEN-006（部署地域与对象存储）为唯一未决 Staging 外部决策；staging 未创建、生产未部署。

## 2026-08-07 — V1 发布决策固化 + OPEN-009 浏览器 QA 自动化
- 产品名：正式中文“日常助手”、英文“Daily Assistant”（`packages/config` PRODUCT 统一配置，
  用户端/管理端/登录页/PWA manifest/元数据一致；技术标识保持 daily-assistant）。
- 通知范围：V1 仅应用内提醒；提醒页文案明确“仅应用内查看”，不再展示浏览器推送状态；
  Web Push/系统通知列为 V1.1 候选（OPEN-005）。
- 仓库命名：品牌显示名与 `richangzhushou`/`daily-assistant` 技术标识分离（OPEN-011）。
- OPEN-009：`@playwright/test@1.62.1`、`playwright.config.ts`、`tests/e2e`（认证/管理端/首页业务/删除）、
  `scripts/start-e2e-services.mjs`（专用测试库、自动 generate/build/migrate/bootstrap/启动三服务）、
  根命令 `test:e2e`/`test:e2e:smoke`/`test:e2e:headed`/`test:e2e:matrix`；
  CI 新增独立 `browser-qa` job（MySQL 8.4、Chromium、失败产物上传）。
- 稳定性：web 客户端 401 自动单飞刷新重试（`api/session.ts`/`api/client.ts`/`stores/auth.ts`/`offline/sync.ts`）；
  登录限流上限可通过 `LOGIN_RATE_LIMIT_MAX` 配置（测试环境放大）。
- 验证：本地 smoke 20/20、完整矩阵 70/70（Chromium 桌面/移动、Firefox、WebKit、1440/375/430）。

## 2026-08-07 — OPEN-007 合并到 main（PR #1）
- PR #1（feat: implement expired account deletion cleanup）以 squash 方式合并到 main，
  merge commit `6d9c888`；任务分支 `codex/open-007-deletion-cleanup` 已删除。
- 合并后本地 `npm run quality` PASS；main 远程 CI run `31136793516` PASS
  （quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 账户删除调度器默认关闭（`ACCOUNT_DELETION_SCHEDULER_ENABLED=false`），
  staging 单实例验证前不得开启；staging 未创建、生产未部署。
- 合并后状态文档同步见 `codex/post-open-007-merge-status` 分支（PR 待用户确认）。

## 2026-08-06 — OPEN-007 账户期满删除清理实现完成
- 数据模型：`UserStatus` 新增 `DELETION_PROCESSING`；`users` 新增删除调度/开始/完成/
  尝试次数/失败原因/租约过期六列；migration `20260806092920_open007_account_deletion_cleanup`。
- 申请删除写入计划删除时间（默认 30 天可配置）；后台任务原子领取并清理全部业务行与
  附件文件，成功后写匿名墓碑（随机用户名、空显示名、随机密码散列、`DELETED`）。
- 失败不标记 `DELETED`，租约过期后可重试，达到最大尝试次数后保留可诊断状态；
  `AccountDeletionScheduler` 由 `ACCOUNT_DELETION_SCHEDULER_ENABLED` 控制，
  手工执行 `npm run account-deletion:run`。
- 管理员可取消 `DELETION_PENDING` 删除申请（容量复查 + `USER_DELETE_CANCEL` 审计）；
  契约/OpenAPI/管理端同步。
- 测试：API 111/111、空库 8 migrations、CLI 演练通过；`docs/27` 发布清单过期内容已修正。

## 2026-08-06 — 正式 main 分支建立与推送完成
- 确认 `codex/wp8-release-prep` 完整包含 `codex/wp1-foundation`（`rev-list --left-right --count` = `0 42`）。
- 从 `codex/wp8-release-prep` @ `42bcef0` 建立并推送正式 `main`；main = origin/main = origin/codex/wp8-release-prep = `42bcef0`。
- main CI run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 无 force push、无额外 merge commit、旧分支未改动；GitHub 默认分支随后已由用户切换为 main（`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留）；暂不执行 staging/生产部署。

## 2026-08-06 — 发布准备第一阶段完成（推送 + 远端 CI 验证）
- 推送 `codex/wp8-release-prep`（首推 `71b9f74`）；首轮 CI run `31084434078` 失败：纯净环境缺 Prisma
  生成客户端与 api-contracts dist（typecheck TS2307/TS2339）。
- 修复 `.github/workflows/ci.yml`（quality 前 `prisma:generate` + contracts `build`），提交 `3e88808`
  并推送；run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 未创建 PR、未部署；当时 origin 无 `main`、默认分支为 `codex/wp1-foundation`（后续已建立 main 并切换默认分支）。

## 2026-08-06 — 首页界面优化完成（docs/29）
- 首页改为“今日概览”（日期副标题）；未登录/登录失效/请求失败友好状态与按钮，
  不再展示后端技术错误文本。
- 顶部导航精简为首页/日程/待办/财务/行程/更多；移动端底部导航 5 项；
  快捷操作保留 4 项并统一图标；新增本月财务摘要、今日安排说明、空状态卡片。
- 同步状态支持已同步/同步中/同步失败并可重试；浅灰蓝背景 + 白色卡片 + 1280px 容器。
- 修复本地缓存日程未按日期过滤的既有缺陷（planner store 前端过滤）。
- 仅改前端；`npm run quality` PASS；用户端测试 15/15；浏览器 375–1440 无横向溢出；
  已提交 `68f3987` 并随 wp8/main 推送；未部署。

## 2026-08-06 — WP9 身份与录入简化本地验收通过（docs/28）
- 账号密码登录（管理员创建、首登强制改密、管理员重置密码），邮箱/邀请码/截图 OCR 下线；
  `npm run quality`、空库 7 migrations+seed、API 92/92、契约 125/125、浏览器验证与
  重启持久化全部通过；已提交 `71b9f74` 并随 wp8/main 推送；未部署。

## 2026-08-06 — 本机启动与访问验证完成（本地运行）
- API/Web/Admin 在本机运行并验证：健康检查 200、浏览器登录、待办/记账读写、API 重启后数据持久化均通过；本地库 `daily_assistant_local`；`.env` 已备份；未提交、未推送、未部署。

## 2026-08-06 — 输出 WP8 可执行规划（docs/25）

- 新增 `docs/25-wp8-codex-execution-plan.md`：全量质量与发布准备的可执行规划
  （安全/上传复审、可访问性、全量验证、备份恢复与删除演练、staging 发布清单）。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP8 全量质量与发布准备本地验收通过（docs/26/27）

- 契约/一致性：审计枚举补全 `DRAFT_BATCH_DISCARD`；数据字典补 `RecoveryCode`；端点清单补 `DELETE /me/sessions`；OpenAPI 72 路径与控制器一致，契约测试 132/132。
- 安全：生产强制 `CONFIRMATION_TOKEN_SECRET`；用户自助关号/申请删除/恢复码重开补写脱敏审计；`.env.example` 补齐适配器与调度变量。
- 上传：新增 JPEG/PNG/WEBP 魔数校验；超大上传流改为 resume；wp4 测试适配并新增不匹配用例；扫描门控与悬空清理缺口如实记录。
- 可访问性/响应式：键盘路径、焦点、语义标签、role=alert、文字+图标状态、触控目标；375/390/430/768/1440 + 200% 缩放矩阵全部无横向溢出。
- 回归：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器主流程与离线排队→恢复→单条落库通过。
- 演练：备份恢复（mysqldump→隔离库→24 表一致）；账号删除（DELETION_PENDING、会话撤销、容量释放、脱敏审计；期满清理未实现，缺口记录）。
- 发布准备：staging 发布清单、监控告警清单、隐私/试用门禁（docs/27）；OPEN-001~011 全部记录，未宣称生产可用。
- 分支 `codex/wp8-release-prep`；本地提交；未推送、未部署、未创建生产资源。

## 2026-08-06 — WP7 PWA 与离线同步本地验收通过

- 契约：Sync 变更流/幂等 mutations/状态端点、`SyncEntityType`/`SyncAction`
  枚举、`CURSOR_INVALID`/`MUTATION_BATCH_TOO_LARGE`/`MUTATION_UNSUPPORTED`
  错误码，分类/账户/预算创建增加 `clientMutationId`；契约测试 132/132。
- 数据：`sync_mutations` 表（`user_id + client_mutation_id` 唯一、
  `request_hash`/`result_ref`/`status`）与同步实体游标索引；空库 6 migrations
  部署与 seed 通过。
- 后端：`(updatedAt, id)` 键集游标变更流（含墓碑）、幂等批量
  `POST /sync/mutations`、版本冲突返回服务端当前实体、`GET /sync/status`、
  跨用户 404/管理员 403/限流；集成测试 63/63（WP2–WP7）。
- 前端：IndexedDB 用户隔离缓存、离线写入队列、同步器（指数退避/手动重试/
  401 自动刷新）、SyncBadge、离线横幅、`/sync/conflicts` 冲突页、离线会话
  与退出/关闭账号清理；Service Worker 仅缓存应用外壳。
- 验收：`npm run quality`、空库 migration+seed、集成 63/63、浏览器
  QA-SYNC-001~004 与 375/390/430/768/1440 矩阵 20/20 全部通过
  （报告见 `docs/24-wp7-acceptance-report.md`）。
- 分支 `codex/wp7-pwa-sync`；未推送、未部署、未创建生产资源、未进入 WP8。

## 2026-08-06 — 输出 WP7 可执行规划（docs/23）

- 新增 `docs/23-wp7-codex-execution-plan.md`：PWA 安装、本地缓存、离线写入队列、
  同步游标、幂等批处理、冲突页面与账号退出清理的可执行规划。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP6 行程本地验收通过

- 契约：Trips/TripItems/PackingItems OpenAPI、`TripItemType` 枚举、
  `TripExpenseSummary`、`TripDetailResponse`、`TripItemOutOfRangeWarning` 与
  `Transaction.tripId`；契约测试 127/127。
- 数据：`trips`/`trip_items`/`packing_items` 与 `transactions.trip_id`；
  migration `20260806011520_wp6_trips` 空库部署与 seed 通过。
- 后端：行程/节点/行李 CRUD、超范围节点确认、服务端费用汇总、日历入口与
  交易关联；集成测试 55/55（WP2–WP6）。
- 前端：行程列表/详情/节点/行李/关联账单/日历跳转/记账行程选择/首页入口。
- 验收：`npm run quality`、浏览器矩阵 10/10 无横向溢出，主流程与控制台仅预期
  400 校验日志（见 `docs/22-wp6-acceptance-report.md`）。
- 分支 `codex/wp6-trips`；未推送、未部署、未创建生产资源、未进入 WP7。

## 2026-08-06 — 输出 WP6 可执行规划（docs/21）

- 新增 `docs/21-wp6-codex-execution-plan.md`：行程、节点、行李清单、账单关联、
  预算与实际支出、日程关联入口的可执行规划。
- 同步 `docs/README.md`、`.project/context.md`、`.project/session.md` 与
  `docs/progress.md`、`docs/changelog.md`。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-05 — WP5 日程、待办与提醒本地验收通过

- 契约：Calendar/Tasks/Reminders OpenAPI、共享类型与枚举；契约测试 118/118。
- 数据：`calendar_events`/`tasks`/`reminders` 与 migration
  `20260805095154_wp5_calendar_tasks_reminders`；seed 演示数据。
- 后端：日程/待办/提醒 CRUD、状态机、重复展开、调度器与通知适配器。
- 前端：今日安排卡片、日程/待办/提醒页与通知权限降级。
- 验收：quality、空库 migration+seed、集成 48/48、浏览器矩阵 20/20；
  报告见 `docs/20-wp5-acceptance-report.md`。
- 未推送、未部署、未创建生产资源、未进入 WP6。

## 2026-08-05 — WP4 快捷指令、OCR 与统一录入本地验收通过

- 契约：Shortcuts/Drafts/Attachments OpenAPI、共享类型、`ShortcutScope` 与错误码
  （`7cb7656`）。
- 数据：`DeviceCredential`、`Attachment`、`DraftRecord` 与 WP4 migration
  （`4be9524`）。
- 后端：设备凭证生命周期、快捷指令幂等草稿、草稿中心、附件/OCR 适配器与集成
  测试（`4cd75e9`）。
- 前端：快捷记录、草稿中心、快捷指令配置页与错误降级状态。
- 验收：quality、空库 migration+seed、集成 41/41、浏览器矩阵 25/25；
  报告见 `docs/18-wp4-acceptance-report.md`。
- 未推送、未部署、未创建生产资源、未进入 WP5。
- 修复：附件非法类型错误码由服务层返回 `ATTACHMENT_TYPE_NOT_ALLOWED`
  （`c1cfc33`）。

## 2026-08-05 — 持久化项目状态恢复机制（v2）

- `AGENTS.md` 合并为 Project State Recovery / Required Workflow Before Every Task / Task Completion State Updates / Safety Rules 四章。
- 新增 `.project/session.md`、`.project/decisions.md` 与 `scripts/check-project-context.mjs`（`npm run check:context`，已并入 quality）；提供可选 `.githooks/pre-commit`。
- 更新 `.project/context.md`、README、docs/progress、docs/changelog 与根状态文件。
- 未修改业务代码；未推送。

## 2026-08-05 — WP3 基础记账与今日财务本地验收通过

- 契约先行：OpenAPI 3.1 补全 Finance 请求/响应/DTO/错误码（`DUPLICATE_RESOURCE`、`POSSIBLE_DUPLICATE` 警告），共享类型与契约测试同步（`c1c8f92`）。
- 数据：新增 `categories`、`financial_accounts`、`transactions`、`budgets` 与枚举 `CategoryKind`、`FinancialAccountKind`；migration `20260805080803_wp3_finance` 空库部署通过（`3fcf1df`）。
- 后端：账单 CRUD/软删除/恢复、退款校验、疑似重复提示、分类/账户归档、预算 CRUD 与自然月校验、统计/今日卡片、CSV 导出；用户内容路由增加 `UserOnlyGuard`（管理员 403）（`e7b971c`）。
- 前端：今日财务卡片、账单列表/表单、分类、账户、预算页面与 CSV 导出（`3fe6739`）。
- 修复：查询 DTO 编译元数据（控制器 `import type` → 运行时导入）与非 JSON 错误体处理（`3db5b40`）。
- 验收：`npm run quality`、空库 migration+seed、WP2+WP3 集成测试 29/29、浏览器 5 宽度矩阵 30/30 与主流程/错误状态全部通过（`docs/16-wp3-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源；WP4 未实现。

## 2026-08-05 — 跨任务自动恢复项目状态机制

- `AGENTS.md` 新增 Project State Recovery、Required workflow before every task、任务结束更新与任务优先级规则。
- `.project/context.md` 规范化为固定结构（含 Repository State、Current Task、Next Recommended Task、Handoff Instructions 等）。
- 同步更新 `docs/progress.md`、`docs/changelog.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`。
- 仅文档改动；保留未提交的 `apps/api/src/finance/finance.controller.ts` 修改；未推送。

## 2026-08-05 — WP2 真实验收复核通过（quality + 空库迁移 + 集成 + 浏览器矩阵）

- 在全新空库 MySQL 8.4.9 上重新执行 `prisma migrate deploy`、seed 与 `npm run test:integration`：18/18 通过。
- 复跑 `npm run quality`：格式、Lint、类型、单测、构建、Prisma、OpenAPI、migration diff、依赖审计全部通过。
- 复跑 Playwright 浏览器矩阵：用户端注册/登录/账号与管理端登录/概览/邀请码/用户/设置/审计在 375/390/430/768/1440 无横向溢出；控制台 0 error / 0 warning。
- 修正 OpenAPI info 中“WP1 未实现”的过时描述，同步为 WP2 已实现状态。
- 输出 WP3 可执行规划 `docs/15-wp3-codex-execution-plan.md`；未推送、未部署；WP3 未实现。

## 2026-08-05 — WP2 identity, capacity, and admin completed locally

- 在 `codex/wp2-identity-capacity` 完成 WP2：身份认证、邀请码、容量限制、账号生命周期和管理端。
- 契约先行：OpenAPI、共享类型、错误码与账号状态机先更新并通过契约测试。
- Prisma 增加 `SystemSetting`、`User`、`Session`、`RecoveryCode`、`InviteCode`、`InviteRedemption`、`AdminAudit` 与首个真实 migration。
- 密码 Argon2id；访问令牌仅存内存；刷新令牌 HttpOnly Cookie、数据库仅存哈希、支持轮换与单设备/全部撤销。
- 注册、恢复、关闭与容量设置变更锁定 SystemSetting 单例行；注册与邀请码兑换同事务；可重试冲突有上限。
- 管理端 API 要求原因并写入脱敏、不可由产品 API 删除的审计；管理员默认不能访问用户生活数据正文。
- 通过格式、Lint、类型、单元/契约/集成测试、构建、Prisma、OpenAPI、空库 migration 与依赖审计。
- 通过 `QA-CAP-001~006`、`QA-SEC-001~003` 与 375/390/430/768/1440 浏览器矩阵。
- 未推送、未部署、未创建生产资源；WP3 未实现。

## 2026-08-05 — WP1 branch pushed to origin

- 用户授权后推送 `codex/wp1-foundation`（提交 `518477e`）到 `https://github.com/Dada-sys101/richangzhushou.git`。
- GitHub Actions 首次运行结果待确认；未创建部署资源。
- 本机 Git 全局代理 7890 不可用，推送时临时使用系统代理 7897；未修改全局配置。

## 2026-08-05 — Project context and development handoff

- 完善 `AGENTS.md`：计划先行、范围控制、兼容性检查、验证、进度更新、独立提交与不确定标注。
- 新增 `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md` 与 `.project/context.md`。
- 更新 `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`docs/README.md`。
- 仅文档与上下文改动，未修改业务代码，未创建生产配置。

## 2026-08-04 — WP0 planning package started

- 创建独立项目规划目录 `D:\daily-assistant`。
- 固化已确认的 V1.0 产品边界、容量控制、云端同步和本地缓存方向。
- 新增根级计划、状态、任务、验收、架构和恢复文件。
- 未创建业务代码、Git 仓库、外部资源或部署环境。

## 2026-08-04 — WP0 planning package completed

- 完成产品范围、页面流程、业务规则、管理权限、数据模型、API、架构、安全、UI、测试、部署、风险和开发交接文档。
- 将 V1.0 拆分为 WP1–WP8，并提供第一批可直接创建的工程任务。
- 检查账号状态、人数计算、邀请注册、金额、同步、权限、枚举、版本范围和验收项的一致性。
- 保留产品名称、远端仓库、供应商、部署地域和数据保留政策为明确未决项。

## 2026-08-05 — WP1 engineering foundation completed locally

- 创建 npm workspaces、Vue PWA 用户端、Vue Element Plus 管理端和 NestJS 单体 API 空壳。
- 创建共享配置与 API 契约包，对齐数据字典枚举、字符串 ID、ISO 8601 时间和定点金额边界。
- 将规划端点转换为 OpenAPI 3.1 基线，并建立 101 项端点/枚举契约断言。
- 创建 Prisma 7 + MySQL schema 基线、安全环境变量示例、本地开发说明和 CI。
- 通过格式、Lint、类型、106 项单元/契约/HTTP 冒烟测试、全部 workspace 构建、Prisma/OpenAPI、离线 migration diff 和依赖审计。
- 在用户端和管理端完成 375/390/430/768/1440 检查；用户端额外验证 404、浏览器 Back、控制台和离线刷新。
- 本机缺少 MySQL/Docker，真实空库 migration deploy 记录为环境阻塞；未推送、未部署、未进入 WP2。

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

## 2026-09-08 — Private-preview post-deployment smoke

- Deployed Integration `6515b8f` passed target-host supply-chain/build checks and post-deployment business smoke.
- Login, forced password change, task, calendar, transaction and refresh persistence passed; disposable user cleanup reported zero residue.
- R1 remains `BLOCKED / NOT_READY` pending readiness and formal/public release review.

## 2026-09-08 — R1/readiness gate reconciliation

- Confirmed that REL-01 D7 assigns non-sensitive readiness or the controlled operational composite to REL-03; readiness implementation is not a REL-02 prerequisite.
- Removed completed dependency, scoped-license, CI, deployment and business-smoke work from the active blocker list. R1 remains blocked pending an explicit H1/H2 advancement decision; REL-02 resources, public entry and later release gates remain independently controlled.

## 2026-09-08 — R1 Quality Gate approved

- The user explicitly approved the H1/H2 waiver for this R1 advancement. H1/H2 remain `WAIVED_FOR_R1 / UNVERIFIED` and are not recorded as physical-device passes.
- R1 Quality Gate is `APPROVED / DONE`; the canonical task is now `REL-02 Authorization / BLOCKED / RESOURCE_FEE_AUTHORIZATION_PENDING`. No cloud resources, fees, Staging deployment, public switch or Provider expansion were authorized.

## 2026-09-08 — Separate Staging waived

- The user explicitly waived a separate Staging environment. REL-02 is `CANCELLED / SEPARATE_STAGING_WAIVED`, with no new cloud resources or related fees.
- The existing Alibaba private preview is the validation environment; the canonical task is `REL-03 Private Preview Readiness / READY`. Public entry, production, Provider expansion and future scale remain separate gates.
