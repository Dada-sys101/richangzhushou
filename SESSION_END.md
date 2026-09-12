# Session End

## 2026-09-12 — MOBILE-C3 实机验收通过

- 用户确认 iPhone/Android 日期、月份和日期时间控件实机验收通过。
- MOBILE-C3 状态更新为 `ACCEPTED / READY_TO_MERGE`；PR #33 尚未合并。
- 用户随后授权合并；PR #33 已合并为 Integration `5a0dc52`，合并 CI run `34683019629` 最终全绿。当前无活动实施任务，下一步为冻结 MOBILE-C4 独立任务契约。
- MOBILE-C4 独立任务契约已在本地冻结；下一步只执行 C4.1 TransactionFormView，尚未创建实施分支或修改业务代码。

## 2026-09-12 — MOBILE-C3 日期时间控件（PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PENDING）

- 应用内日期、月份和日期时间组件已替换用户端原生时间字段；PR #33 当前 HEAD `b18b91d`，两组 CI 的 quality、db-validation、browser-qa 全绿。
- 备份 `daily_assistant_preview_20260912T074830Z.sql.gz` 后部署至 `/opt/daily-assistant-preview/releases/b18b91d0-20260912T0735Z`；既有 Web Push migration 补齐成功。
- 用户端、深链接、API、管理端、Manifest、Service Worker、新构建资源和启动日志检查通过；用户随后确认 iPhone/Android 实机验收通过，PR 尚未合并。

## 2026-09-11 — MOBILE-B PWA 生命周期（PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PENDING）

- 完成 Manifest、四套应用图标、Android 原生安装入口、iPhone 中文添加到主屏幕说明和 standalone 识别。
- Service Worker 更新改为中文提示和用户确认；未保存内容或同步活动会安全暂缓刷新。
- 完整质量通过；提交 `4d86f90` 已推送至 PR #30，两组 CI 矩阵全绿，现有私有预览已部署 release `4d86f900-20260911T0846Z` 并通过部署后检查。
- 等待 iPhone/Android 安装版生命周期验收；PR #30 尚未合并。

## 2026-09-11 — MOBILE-A 导航与移动端壳（ACCEPTED / READY_TO_MERGE）

- Navigation Policy、根 Tab replace、直接父级 `returnTo` 与详情深链接 fallback 已本地实现。
- Web lint/typecheck、121 项单元测试以及 375/390/430/768/1440 与 WebKit mobile 导航 E2E 通过。
- 已完成任务提交、推送、PR #29 和现有环境部署；认证数据库就绪与全中文错误修复 `77718a0`、未登录缓存隔离修复 `fa0ee53` 的本地质量及两组 CI 全绿，当前 release 为 `fa0ee530-20260911T0738Z`。用户确认 iPhone 边缘返回、Android 系统返回及未登录缓存验收通过；PR 尚未合并。

## 2026-09-09 — R1.1 Web Push 本地候选（IN_PROGRESS）

- 完成加密订阅、逐设备幂等送达、用户隔离 API、PWA Service Worker、提醒页权限开关和真实 Web Push 适配器；功能默认关闭。
- 临时 MySQL 8.4.9 完成 13 migrations、schema zero-diff 和 18 files/161 tests；Chromium 受控 Push API 完成订阅、刷新、退订、拒绝及五档宽度验证。
- 最终完整 `npm run quality` 通过；当前未提交、未推送、未运行 CI、未部署、未启用，真实 Push Service/系统通知/实机送达仍待验证。

## 2026-09-08 — Prisma override 正式兼容性验证（FORMAL_COMPATIBILITY_VERIFIED_LOCAL）

- 候选保留 Prisma 7.9.1，精确 override `deepmerge-ts@8.0.2`、`mariadb@3.4.7`、`mysql2@3.24.3`，固定 npm 11.18.0，并移除活动安全例外。
- clean install、npm ls、audit 0、lock/tree SBOM、治理 30/30、license inventory、quality、一次性 MySQL 8.4.11 18 files/160 tests 和真实数据库 smoke 44/44 PASS。
- license 的 8 项 missing/unresolved 与 24 项 manual review 尚未人工批准；远程 TLS/网络故障路径、新候选 CI、提交/推送/PR/部署均未开展。R1 不解除。
- 审阅证据：`D:\daily-assistant-prisma-override-compat-20260908-093516`。

> 本文件是按日期保存的历史结束记录。旧条目中的 `BLOCKED`、旧 commit 和未部署状态只表示当时事实；当前状态以 `PLANS.md`、`.project/v15-execution-state.md` 和 `.project/session.md` 为准。

## 2026-09-03 — R1-STABLE-PRISMA-MATCH-RECHECK（BLOCKED / NOT_READY）

- 重新核对 npm registry：稳定匹配三件套为 `prisma@7.10.0`、`@prisma/client@7.10.0`、`@prisma/adapter-mariadb@7.10.0`，但仍精确依赖 `deepmerge-ts@7.1.5`、`mariadb@3.4.5`、`mysql2@3.15.3`；可修复稳定版本（`deepmerge-ts@8.0.2`、`mariadb@3.4.7`、`mysql2@3.24.3`）无法自然解析进入上游链。
- `npm ci`、`npm ls`、SBOM（1044）、license inventory（1163）和治理 14/14 通过；`npm audit` 为 `1 moderate / 5 high`，`npm run audit:dependencies` 和 `npm run quality` fail-closed；`npm run audit` 脚本不存在。
- Prisma `latest` 为预发布 `8.0.0-rc.12`，且配套客户端/适配器/配置包没有完整匹配版本；本轮未采用预发布、override 或临时例外，未修改依赖、未运行 CI、未部署候选。R1 和私有预览正式门禁继续 `BLOCKED / NOT_READY`。
- 当前实际 HEAD 为既有锁文件补丁提交 `1b835457...`；本轮未创建新提交，状态/证据文档保留为未提交修改。

## 2026-09-03 — PRIVATE-PREVIEW-FORMAL-STANDARD-RECONFIRMATION（BLOCKED / NOT_READY）

- Dada 明确要求私有预览版按照正式版标准验收；现有 Alibaba Integration `299b1f71` 服务继续运行，但只作为旧版本运行基线，不视为已通过正式发布门禁。
- 复核 npm registry 后确认：稳定 Prisma `7.10.0` 仍精确锁定未通过审计的 `deepmerge-ts`、`mariadb`、`mysql2` 版本；Prisma 8 当前仍为 RC，且配套客户端/适配器不完整。本轮没有可安全交付的兼容依赖修复，没有修改业务代码，也没有部署候选。
- `npm run audit:dependencies` 仍 fail-closed；PR #25 的 `db-validation`、`browser-qa` 通过，`quality` 仍失败。真实 iPhone 仍按用户决定跳过，但不放宽其他正式发布门禁。
- 下一步：等待或取得依赖负责人确认的稳定兼容修复，重新通过 audit/SBOM/license/quality，再部署候选并按正式标准复验；未满足前不发布预览新版本。

## 2026-09-03 — R1 依赖门禁增量修复（DONE_PUSHED / QUALITY_STILL_BLOCKED）

- 在不改变业务代码、架构、Prisma/schema/migration 或部署配置的前提下，仅更新 `package-lock.json`：`fast-uri` `3.1.5 -> 3.1.7`、`qs` `6.15.3 -> 6.16.0`。
- `npm ci`、`npm ls`、治理测试 `14/14`、SBOM（1044 components）和 license inventory（1163 packages）通过；完整 `npm run quality` 通过审计前所有阶段，仅在依赖审计处 fail-closed，当前为 `1 moderate / 5 high`。
- 本次修复将独立提交并推送到 PR #25；核心 Prisma 依赖链仍未解除，因此未合并、未部署，Alibaba 私有预览继续运行 Integration `299b1f71`。
- 下一步等待 Prisma 上游兼容修复或正式批准的完整方案，重新通过 audit/SBOM/license/quality 后再合并部署；域名审批、公网 HTTPS 和后续新功能仍按原独立门禁处理。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-CANDIDATE-01（DONE_PUSHED / PR_OPEN / QUALITY_BLOCKED）

- 按用户要求，将当前可发布且已验证的 Web/V2 导航、离线同步、AI 提示词与评估、契约/测试和发布运营文档拆分为 3 个逻辑提交：`f7fb90a`、`1545e21`、`d649ad4`。
- 已将候选与 Integration `299b1f71` 对齐，收口 12 个前端冲突并修复合并后重复的 `/records`、`/plan` 路由；合并提交为 `b7734d0`，分支已推送。
- GitHub PR #25 已创建，后续新功能未混入候选分支；状态同步提交为 `837e9cd`，本地工作区 clean。最终 PR-event CI run `33615692992` 的 `db-validation`、`browser-qa` 通过，`quality` 仍在依赖审计处 fail-closed。
- 由于正式质量门禁仍为红色，本轮没有将候选代码部署到 Alibaba；现有私有预览继续运行 Integration `299b1f71`。每日备份、7 天保留和清理定时器保持 active，live AI 按用户决定保持开启。
- 下一步只需处理兼容依赖修复并重新通过 audit/SBOM/license/quality；通过后再合并、部署候选并复验预览。域名审批后另行切公网，后续新功能另开分支/PR。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-01（OPERATIONAL / PUBLIC_NOT_READY）

- 按用户决定跳过真实 iPhone 验证，状态记录为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`，不把 WebKit 模拟结果写成真机通过。
- 复核已有 Alibaba 私有预览 Integration `299b1f71`：发布包完整性、API/用户端/管理端/Nginx、数据库迁移和服务状态通过。
- 已生成受保护的数据库备份，并在临时恢复库中校验 25 张表、14 条迁移记录；服务器已配置每日备份、7 天保留和过期自动清理，手动执行与清理逻辑复验通过；跨位置备份、周期性隔离恢复和公网域名切换仍未完成。
- 用户已明确允许当前私有预览开启 live AI；服务器环境与数据库开关均已确认开启并与当前决定一致。该决定不自动扩大公网 Provider 使用范围。依赖审计仍 fail-closed，Prisma 兼容修复候选因 SBOM invalid 已撤回；未发布本地混合未提交工作区。详见 `docs/49-private-preview-release-assessment.md`。

## 2026-09-02 — REL-01-DECISION-RECORD-01（APPROVED / REL-02_AUTHORIZATION_PENDING）

- 用户已确认 D1-D8 按 `docs/47-rel-01-staging-architecture-decision.md` 的推荐值批准；批准记录已固化到 `docs/48-r1-approval-decision-pack.md`。
- REL-01 已更新为 `APPROVED / REL-02_AUTHORIZATION_PENDING`；本轮没有获得明确的 staging 资源创建授权，因此未创建资源、域名、数据库、Bucket、凭据、部署或真实记录。
- `docs/48` 同时记录 REL-02 执行前清单，覆盖资源、权限、环境变量、Secret、费用、备份/RPO-RTO、readiness、回滚和合成数据验收条件。
- R1 Quality Gate 继续为 `BLOCKED / NOT_READY`；H1/H2 继续 `PARTIAL`，WebKit 模拟仍为辅助证据，依赖审计正式修复仍未通过。
- 本轮仅运行 `npm run check:context`、`npm run format:check` 和 `git diff --check`；未重复业务测试，未提交、推送、创建 PR 或部署。

## 2026-09-02 — R1-APPROVAL-PACKAGE-01（DONE_LOCAL / APPROVAL_PENDING）

- 复核 R1 阻塞：H1/H2 正式物理 iPhone 证据仍为 `PARTIAL`；WebKit iPhone 13 只能作为辅助证据，H2 离线重开资源错误仍需真机确认。
- 确认依赖审计候选已因 SBOM 精确依赖声明 invalid 撤回；当前没有通过兼容性、SBOM、license 和发布检查的正式依赖修复。
- 审查 `docs/47-rel-01-staging-architecture-decision.md` 的 D1-D8，并新增 `docs/48-r1-approval-decision-pack.md`；
  REL-01 仍为 `DESIGN_REVIEWED / APPROVAL_PENDING`，REL-02 资源创建仍未授权。
- 本轮限定检查 `npm run check:context`、`npm run format:check`、`git diff --check` 均 PASS；未重复业务测试。
- 本轮未补充真实记录、未使用真实用户数据、未创建云资源/域名/数据库/Bucket/凭据/部署，未修改业务代码或配置，未提交、推送或创建 PR。

## 2026-09-02 — REL-01 Staging 架构与发布边界设计稿（DESIGN_REVIEWED / APPROVAL_PENDING）

- 在暂不补充真实记录、R1 仍被阻塞的前提下，按 PLANS.md 允许的提前路径新增 `docs/47-rel-01-staging-architecture-decision.md`。
- 设计稿给出单实例 API、私网 MySQL 8.4、私有 OSS、HTTPS、最小权限、合成数据、费用控制、备份/RPO-RTO、监控、发布和回滚方案。
- 已完成与现有架构、发布清单、部署样例和健康检查实现的跨文档自检；该稿不代表人工批准、资源创建或部署授权；云厂商/地域、域名/TLS、基础设施预算、RPO/RTO 和 readiness 方案仍待确认。未创建资源、未修改部署配置、未提交/推送/创建 PR/部署。

## 2026-09-02 — R1 H1/H2 WebKit 本机模拟验收（DONE_LOCAL / NON_FORMAL_EVIDENCE / R1 BLOCKED）

- 在 `D:\daily-assistant-runtime` 一次性 MySQL/API/Web 环境中，使用 Playwright WebKit `iPhone 13` 模拟直接验收真实页面。H1 登录、首页、待办/日程/提醒列表与详情、返回、浏览器 Back、刷新通过。
- H2 manifest/Service Worker、缓存离线重开、离线新增、恢复联网自动同步和服务端去重通过；离线重开期间出现 WebKit `internal resource error`，因此 H2 仍不能视为真机通过。
- 证据已记录于 `docs/46-r1-webkit-emulation-validation.md`；H1/H2 保持 `PARTIAL`，仍需物理 iPhone Safari/PWA 记录。测试服务、临时数据库和浏览器会话已清理，未创建提交、推送、PR 或部署。

## 2026-09-02 — R1 依赖审计兼容性复核（DONE_LOCAL / CANDIDATE_REJECTED / R1 BLOCKED）

- 评估了 Prisma 7.10.0 与修复版传递依赖候选；候选虽可使 npm audit 暂时显示无漏洞，但 npm SBOM 将 Prisma 的精确传递依赖声明判定为 invalid，因此已撤回。
- 使用 `D:\daily-assistant-runtime\npm-cache` 完成 `npm ci`；最终 `npm ls` 有效，治理测试 14/14、CycloneDX SBOM 生成/校验（1044 components）和 license inventory（1163 packages）通过。
- 当前 `npm run audit:dependencies` 仍按规则 fail-closed；R1 依赖门禁未关闭。没有留下 package/lockfile 依赖变更，未创建提交、推送、PR、部署或外部资源。
- H1/H2 真机记录和依赖负责人批准的兼容修复方案仍是 R1 后续必要条件。详见 `docs/44-r1-dependency-audit-review.md`。
- H1/H2 记录模板已补齐于 `docs/45-r1-manual-device-evidence-template.md`；桌面浏览器检查不能替代 iPhone 真机门禁。

## 2026-09-01 — WEB-SMOKE-01 真实数据库 Web 冒烟收口（DONE_LOCAL / UNCOMMITTED）

- 在 `D:\daily-assistant-runtime` 的一次性 MySQL 8.4.11 环境上重新启动 E2E 服务，修复并验证此前完整 Web smoke 的 4 类失败：本地 AI fake gate、草稿返回 query、账号关闭后的未保存导航守卫，以及删除确认/严格状态选择器。
- Web lint、typecheck、unit `21 files / 116 tests`、build、Prettier 和 `git diff --check` 通过；真实数据库 Chromium desktop/mobile 完整 smoke `44/44 PASS`。
- 删除确认由 E2E 显式接受；本轮未修改 API、Prisma、数据库 schema、同步后端或部署配置；MySQL/API/Web/admin 服务已停止，未创建提交、推送、PR 或部署。
- 当前 R1 Quality Gate 仍为 `BLOCKED / NOT_READY`：完整 Web smoke 已不再是阻塞项，仍受现有依赖审计以及 H1/H2、Provider enablement、REL-04 等独立门禁约束。

## 2026-09-01 — H7 人工门禁关闭（PR20 DONE_LOCAL / H7_CLOSED）

- Dada 已明确关闭 H7；关闭依据为已归档的 DeepSeek 脱敏评估证据、提示词补强回归、`case-146` 3/3 复测、正式写入隔离和当前阶段决策确认。
- PR20 Live Provider Validation 更新为 `DONE_LOCAL / H7_CLOSED`；当前转入 `R1 Quality Gate BLOCKED / NOT_READY`。
- H7 关闭不授权生产 Provider、真实用户/生产数据评测、REL-04、R1 advancement、提交、推送、PR 或部署；暂不设金额上限仍不提供金额超支保护。

## 2026-09-01 — PR20 H7 当前阶段决策确认（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- Dada 已确认当前阶段暂定使用 DeepSeek `deepseek-v4-flash`，接受本轮已复核的 Provider 条款和本机评估结果，
  包括 `case-146` 的随机失败样本与当前 provisional schema/effect 判断。
- 已接受 ADR-029：AI 用量按 `Asia/Shanghai` 自然月观察，暂不设置固定金额 warning/hard ceiling；当前不做费用换算、
  金额拦截或新的账本/价格配置，因此不能宣称生产预算 enforcement 已完成。
- H7 仍保持 `OPEN / EVIDENCE_READY`，仅剩 owner 显式 closure；Provider enablement、REL-04 和 R1 advancement
  仍按独立发布门禁执行。未启用 Provider、未使用真实用户数据、未提交/推送/创建 PR/部署。

## 2026-09-01 — PR20 H7 提示词补强后全量复跑与证据收口（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 在 `D:\daily-assistant-runtime` 的一次性 MySQL 8.4.11 环境中，使用可重复数据集 `h7-adr027-fixed-v1` 完成
  提示词补强后的完整 200 条合成评估；DeepSeek `deepseek-v4-flash` 结果为 199/200 schema-valid（99.5%），
  effect proxy 199/200（99.5%），正向 184/185、不确定处理 15/15，服务端/客户端 p95 为 1589/1644 ms。
- 唯一异常为 `case-146` 的一次 HTTP 502 / `SCHEMA_INVALID`；失败输入保留，随后同一 case 定向复测 3/3 成功。
  评估用户正式业务表均为 0，最终确认仍被 403 `AI_DISABLED` 拦截，未发生正式写入。
- 新增可重复评估器 `apps/api/src/cli/h7-live-provider-evaluation.ts`，只输出脱敏汇总；报告已更新 Provider 官方条款复核
  状态和数据集可重复性限制。API lint/typecheck/unit/build、adapter 定向测试通过。
- H7 仍为 `OPEN / EVIDENCE_READY`；预算 enforcement、Provider 隐私/数据处理批准、最终阈值与 Provider/model 选择、
  人工 H7 closure 仍未完成；未启用 Provider、未使用真实用户数据、未提交/推送/创建 PR/部署。

## 2026-09-01 — PR20 H7 本机受控 Provider 验证（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 用户已明确授权本机测试；使用 `D:\daily-assistant-runtime` 一次性 MySQL 8.4.11、合成数据和
  `v15.ai.businessWrite=false` 完成 DeepSeek `deepseek-v4-flash` canary、pilot 及 200 条完整评估。
- 结果：199/200 schema-valid（99.5%），p95 1449 ms；1 条 `DOMAIN_INVALID` 失败保留输入，复测同类请求成功；
  15 条歧义样例中 13 条进入不确定处理。正式业务表基线不变，最终确认被 403 `AI_DISABLED` 拦截。
- 修正文件为 `apps/api/src/ai/deepseek-provider/deepseek-ai-provider.adapter.ts` 及其测试；新增脱敏证据
  `docs/43-pr20-h7-live-provider-validation.md`。API lint/typecheck/unit/build 和 adapter 定向测试通过。
- 当前任务为 `VERIFYING / DONE_LOCAL`；H7 为 `OPEN / EVIDENCE_READY`，生产预算 enforcement、最终阈值、Provider
  选择、条款复核和人工 H7 closure 仍未完成；未启用 Provider、未使用真实用户数据、未提交/推送/创建 PR/部署。

## 2026-09-01 — PR20 H7 歧义输入定向回归（DONE_LOCAL）

- 在提示词中增加关键事实缺失/模糊/占位值必须返回不确定结果的约束，禁止生成“待定任务”等占位字段。
- 使用本机真实 Provider 复测 3 条合成样例：两条模糊任务为 `confidence=0.0000` 且无字段，一条具体任务正常生成字段；
  完整 200 条评估未重跑，服务和 MySQL 已清理。
- H7 仍为 `OPEN / EVIDENCE_READY`；后续授权后重跑全量，完成预算、阈值和人工门禁决策；未提交、推送、创建 PR 或部署。

## 2026-09-01 — QUALITY-R1 Governance post-write review（PASS / EXISTING COMMITTED ARTIFACT）

- 按 `tasks/QUALITY-R1-GOVERNANCE-RECONCILIATION.md` 完成只读复核：既有 commit `6adc111492dcbeb35e79475a3d69f6a63007e5bb` 的父提交为契约要求的
  `d53f84a4ff99208f69d209e98a1d3f07c588d760`，提交只修改 21 个授权 Markdown 文件。
- 专用治理 worktree `D:\daily-assistant-worktrees\quality-r1-governance-draft-write` 为 clean；`npm run check:context`、治理提交 `git diff --check`、stash 完整性和远端 ancestry 均通过。
- GitHub 实际状态：治理提交已在 `origin/codex/v15-integration-foundation` ancestry 中；run `33048729907` 和最新 Integration run `33147816383` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS，Playwright 报告上传步骤跳过；当前无开放 PR。
- ADR-028 仍为 `Accepted`，两项 deviation 仍为 `KEEP_AND_RECONCILE`，H7 仍 `OPEN`，R1 Quality Gate 仍 `BLOCKED / NOT_READY`；未执行真实 Provider、凭据或真实数据评测。
- Git worktree registry 未发现独立 `pr20-03a` 路径，因此历史旧路径无法从当前文件系统独立复核；当前 `D:\daily-assistant` 的 75 项修改属于后续 UI/同步任务，已原样保留。
- 本轮未创建新的提交、推送、PR、合并、部署或外部资源；下一 canonical task 为 `PR20 Live Provider Validation`，但当前仍受 H7 阻塞。

## 2026-09-01 — SYNC-E2E-01 真实同步验收收口（DONE_LOCAL / UNCOMMITTED）

- 使用 C: 盘之外的 `D:\daily-assistant-runtime` 一次性 MySQL 8.4.11 环境启动 API、Web 和 admin；真实 API 集成结果为
  `17 files / 155 tests PASS`。本轮未使用 API mock 代替后端验收，服务和浏览器会话已在完成后清理。
- 两个独立真实浏览器使用同一账号完成待办创建、编辑、删除/恢复传播：A 创建后 B 可见，B 编辑后 A 可见，A 删除后 B 可见墓碑，B 恢复后 A 可见恢复对象；相关请求返回 200。
- 离线恢复通过：A 离线创建先显示本地 pending ID，直接查询服务端无对应对象；联网后队列收敛为真实服务端 ID，B 可见，待同步状态清零。
- 冲突与隔离通过：A/B 同时离线编辑同一待办，先提交的一方成为服务端版本，后提交方进入真实 `VERSION_CONFLICT` 页面；选择保留服务端后冲突清零。第二用户看不到第一用户数据。
- 375/390/430/768/1440 五种 viewport 均无横向溢出；清理浏览器日志后无 console error/warning，过滤后的 sync/task 请求均为 200。
- 现有完整 Web smoke 仍为 `22 passed / 22 failed`，失败集中在 AI Proposal、草稿确认、账号删除和 navigation-shell 选择器，不并入本次同步验收。下一项建议遵循
  `PLANS.md` 的 `QUALITY-R1-GOVERNANCE-RECONCILIATION` post-write review gate；未 commit、push、PR、merge 或部署。

## 2026-08-31 — SYNC-01 429 限流与失败退避修复（DONE_LOCAL / UNCOMMITTED）

- 将同步状态通知与本地变更通知分开，避免失败状态更新被误判为本地写入而再次强制同步；429 错误保留 HTTP 状态并触发 60 秒自动冷却，普通失败采用指数退避，手动重试仍可立即执行。
- 补充同步请求错误、协调器退避、手动重试和通知原因测试；Web lint、typecheck、build 通过，Web 全量单元测试为 `21 files / 116 tests PASS`，同步定向测试为 `2 files / 15 tests PASS`。
- 使用 D: 盘一次性环境在真实浏览器中注入受控 429 响应完成客户端复测：页面显示已暂停自动重试，点击重试后连续观察 10 秒无新增同步请求；该检查不替代真实后端传播验收。浏览器和 API/Web/admin 服务已清理，MySQL runtime 仍保留在 D: 盘。
- 当前仍未完成真实双浏览器创建/编辑/删除恢复传播、离线恢复、冲突/墓碑和五个 viewport 验收；下一步恢复 `SYNC-E2E-01` 真实后端验收。未 commit、push、PR、merge 或部署。

## 2026-08-31 — SYNC-E2E-01 真实验收检查点（PAUSED / BLOCKED_429）

- 本轮继续使用 C: 盘之外的 `D:\daily-assistant-runtime` 一次性 MySQL 8.4.11 环境；真实 API 集成通过，结果为
  `17 files / 155 tests PASS`。验收服务和 Playwright 会话已在用户中断后清理，未部署、未提交任何项目代码。
- 既有完整 Web smoke 已实际运行并得到 `22 passed / 22 failed`；失败集中在 AI Proposal、草稿确认、账号删除和
  navigation-shell 选择器，暂不作为 SYNC-E2E-01 的同步修复范围。
- 两个真实浏览器已进入 `/tasks`，但 `/sync/changes` 与 `/sync/status` 返回 `429 Too Many Requests`，页面显示
  `同步失败 / Too many requests`，随后产生高频 429；用户在跨设备创建/传播前中断，因此跨浏览器同步仍为
  `UNVERIFIED / BLOCKED_429`。
- 新 blocker：客户端同步失败后仍保持轮询，当前未见 429 专用冷却/退避；下一步需要单独建立
  `SYNC-01-429-BACKOFF-REMEDIATION` 范围，完成后再重跑真实双浏览器传播和五宽度网络/控制台验收。
- 项目分支仍为 `codex/v15-v2-ui-visual-freeze`，HEAD 仍为 `a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8`，工作区 75 项未提交修改完整保留；
  未 commit、push、PR、merge 或部署。

## 2026-08-31 — SYNC-E2E-01 Daily Assistant 同步真实环境验收（BLOCKED / NOT_RUN）

- 完成项目状态恢复与环境核对：分支 `codex/v15-v2-ui-visual-freeze`、本地 HEAD
  `a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8`、工作区 75 项未提交修改均保留；`SYNC-API-01` 仍为
  `DONE_LOCAL`。
- `TEST_DATABASE_URL`、`E2E_DATABASE_URL`、`DATABASE_URL` 均未设置；`.env.example` 是唯一 `.env*` 文件；
  3306、3000、5173、5174 无监听。已有 E2E 启动脚本会在没有专用测试数据库时退出。
- 真实 MySQL API 集成、两个真实浏览器同步、离线恢复、冲突/墓碑、用户隔离和 375/390/430/768/1440
  真实浏览器检查均为 `BLOCKED / NOT_RUN`；没有用 API mock 代替真实验收。
- 未修改业务代码、同步协议、依赖或部署配置；未 commit、push、PR 或部署。待提供 disposable MySQL URL
  后继续运行真实验收。

## 2026-08-31 — SYNC-API-01 增量同步游标契约修正（DONE_LOCAL / E2E_DATABASE_UNVERIFIED）

- 修正 API `/sync/changes`：非空页（含非空末页）返回最后一条 `(updatedAt,id)` 对应的非空不透明游标，空页返回 `null`；
  共享类型、OpenAPI、API 文档和 WP7 测试已同步，前端 fail-closed 保护未放宽。
- API lint/typecheck/build、API unit 32 files / 277 tests、OpenAPI/contract 151/151、Web sync 2 files / 12 tests、
  `npm run check:context`、format 和 `git diff --check` PASS；WP7 数据库集成 22 passed / 133 skipped。
- 根 `npm run quality` 在既有 dependency audit 拒绝 `@prisma/adapter-mariadb`、`mariadb` 处失败；
  `TEST_DATABASE_URL`/`E2E_DATABASE_URL` 缺失，真实数据库和双浏览器同步未运行。
- 保留 WEB-UX-02/03/03.1 与 SYNC-01 未提交修改；未 commit、push、PR 或部署。

## 2026-08-29 — SYNC-01 实时同步整改（BLOCKED / API_CONTRACT_GAP）

- 保留 WEB-UX-02/03/03.1 全部未提交修改；本次在 `apps/web` 增加统一同步协调器、登录/路由/focus/visibility/online
  触发、7 秒可见页面轮询、请求与游标并发保护、planner/finance/drafts/trips 刷新、同步状态展示，并保留既有离线队列。
- Web lint、typecheck、unit（21 files / 112 tests）、build、Prettier、`npm run check:context` 和
  `git diff --check` PASS；真实浏览器仅完成本地登录页加载/刷新/390px/控制台冒烟 PASS。
- 根目录 `npm run quality` 未通过：前置 workspace 检查完成，最终既有 dependency audit 拒绝未批准的高/严重包
  `@prisma/adapter-mariadb`、`mariadb`；本次未修改依赖文件。
- 契约复核确认现有 `/sync/changes` 在非空末页返回 `nextCursor: null`，前端无法在不依赖内部编码的情况下保存可靠终止游标；
  按要求未修改 API、未设计伪游标，SYNC-01 保持 BLOCKED。
- `E2E_DATABASE_URL` 缺失，真实数据库 E2E 未运行；两个真实浏览器跨设备同步未运行；未 commit、push、PR 或部署。
- 当前远端 Integration HEAD 通过只读 `git ls-remote` 为 `299b1f71debbd5a3140d1ee19f9781372e67134b`；本地 HEAD 未改变。

## 2026-08-29 — WEB-UX-03.1 验收收口（DONE_LOCAL / E2E_DATABASE_UNVERIFIED）

- 保留 WEB-UX-02/03 全部未提交修改；本次仅补充 Web 删除确认、DELETE 后服务端对象重读、共享
  Planner store 替换，以及日程/提醒编辑、删除、恢复、失败重试和列表确认测试。
- Web lint、typecheck、unit（20 files / 100 tests）、build、Prettier、`npm run check:context`、
  `git diff --check` 均 PASS；mocked browser 验证了日程/提醒编辑、删除确认、恢复、返回来源、刷新、
  Back、非法 returnTo 和 375/390/430/768/1440 宽度。
- `origin/codex/v15-integration-foundation` 通过只读 `git ls-remote` 重核为
  `299b1f71debbd5a3140d1ee19f9781372e67134b`；未改变本地 HEAD。
- `E2E_DATABASE_URL` 缺失，真实数据库 E2E 未运行；跨浏览器同步验证未运行；未 commit、push、PR 或部署。

## 2026-08-29 — WEB-UX-03 核心功能闭环整改（DONE_LOCAL / E2E_DATABASE_UNVERIFIED）

- 在 `D:\daily-assistant` 的 `codex/v15-v2-ui-visual-freeze` 分支完成 Web 核心闭环：PlannerDetailView
  对待办/日程/提醒执行编辑、完成/取消、重新安排、删除/恢复，错误可重试，成功即时同步共享 planner store。
- 编辑 dirty 改为初始快照比较；来源筛选/query、动态返回文案、非法 `returnTo` 安全回退、刷新和浏览器
  Back 已覆盖；统计入口改为“账单明细”，真实 CSV 导出入口保留。
- Web lint、typecheck、unit（18 files / 90 tests）、build、Prettier、`npm run check:context`、
  `git diff --check` 全部 PASS；本地 Vite + API mock 浏览器检查覆盖 375/390/430/768/1440。
- `E2E_DATABASE_URL` 缺失，真实数据库 E2E 未运行，不能宣称真实后端写入流程通过；未 commit、push、PR 或部署。
- 保留 WEB-UX-02 全部未提交修改；当前 HEAD 为 `a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8`。

## 2026-08-27 — QUALITY-R1 Governance Approval / Normative Freeze Write（NORMATIVE FREEZE POST-WRITE REVIEW GATE）

- Dada 已明确批准 ADR-028、Deviation A / PR20-03A 与 Deviation B / PR20-03B 的
  `KEEP_AND_RECONCILE` disposition，以及规范冻结写入。
- 从 `origin/codex/v15-integration-foundation` 重新只读核验 Integration HEAD 为
  `299b1f71debbd5a3140d1ee19f9781372e67134b`；PR20 adapter integration 为
  `DONE_INTEGRATION`，live Provider validation 为 `BLOCKED / H7`。
- H7 保持 `OPEN`，blockingScope 为真实 Provider calls、真实 credential/secret use、真实数据/
  Provider 评测、Provider enablement、REL-04 和 R1 advancement；R1 Quality Gate 保持
  `BLOCKED / NOT_READY`；REL-02/03/04 保持 `BLOCKED / NOT_STARTED`，不表示已授权或已完成。
- Integration CI run `33043413216` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  `supply-chain-governance`、`pr6a-mysql84-evidence` 存在，但 Playwright report upload 被跳过，
  不宣称存在完整浏览器报告。
- docs/40 已升为 V1.2；ADR-026/027 normative content、PR19 V10 normative scope、实现/数据库/
  CI/环境文件未改；未 commit、push、PR、merge、部署、真实 Provider/凭据调用或 H7 closure，
  未触碰 stash。
- 当前本地状态为 `DONE_LOCAL / UNCOMMITTED / POST_WRITE_REVIEW_PENDING`，停在
  `NORMATIVE FREEZE POST-WRITE REVIEW GATE`。

## 2026-08-27 — QUALITY-R1 Governance Reconciliation Gate 1（历史前置记录，COMMIT AUTHORIZATION GATE）

- 从 `origin/codex/v15-integration-foundation` 只读核验 Integration HEAD 为
  `56ffd3dc0c9c46bae7a9b47d80e6ba8bcd0f2172`，并在独立 worktree
  `D:\daily-assistant-worktrees\quality-r1-governance-draft-write` 执行；旧 PR20-03A worktree 未修改。
- PR19（GitHub PR #18）已是 `DONE / DONE_INTEGRATION`；PR20 adapter integration 已通过
  #20/#21/#22/#23 进入 Integration；PR20 live Provider validation 仍为 `BLOCKED / H7`。
- 新增 ADR-028（`PROPOSED / AWAITING_DADA_APPROVAL`）及
  `QUALITY-R1-GOVERNANCE-RECONCILIATION`（`DRAFT / AWAITING_APPROVAL`），同步项目状态与派生镜像。
- PR20-03A/#22、PR20-03B/#23 deviation 保持 `PENDING_DADA_DISPOSITION`；canonical R3 PR22/PR23
  未修改；H7 `OPEN`；R1 Quality Gate `BLOCKED / NOT_READY`。
- Integration CI run `33035100661` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  `supply-chain-governance`、`pr6a-mysql84-evidence` 存在，但 browser report upload 被跳过。
- docs/40 保持 V1.1，ADR-026/027 与实现/数据库/CI/环境文件未改；未 commit、push、PR、merge、部署，
  未使用真实 Provider/凭据，未触碰 stash。
- 下一步仅为完整 diff 审查与 `npm run check:context`、`git diff --check`，随后保持在提交授权门前。

## 2026-08-12 — PR2 AI DB Expand 最终本地验收

- 分支：`codex/v15-pr2-ai-db-expand`，基于已核验 integration HEAD
  `c4cca65bcd2ba71d93f948bf1c8731179fbb7fad`（PR #12 merge，AI-DECISION-001
  `DONE_INTEGRATION`，CI 218 SUCCESS）。
- 本地完成：schema 五枚举 + 冻结四表、单一 additive migration
  `20260812120000_v15_expand_ai`、`v15-ai-expand.integration.test.ts`、account-deletion
  service/test 最小适配、`tasks/PR2.md`（DEC-PR2-01..04）与必要文档/状态同步。
- 验证：Oracle MySQL 8.4.9 fresh empty DB 10 migrations PASS；focused AI 12/12、
  account deletion 11/11、full DB integration 15 files / 117 tests PASS，0 skipped；
  `quality`、`check:context`、`git diff --check` 与最终 diff review PASS，临时资源 residual 0。
- 验证中仅最小修复 focused schema test 对三个 `created_at DEFAULT CURRENT_TIMESTAMP(3)` 的漏断言；
  当前 `DONE / DONE_LOCAL / UNCOMMITTED`，下一建议任务 PR5 未启动。
- 未 add/commit/push/创建 PR/merge/访问 credential/真实 AI/部署。

## 2026-08-11 — AI-DECISION-001 本地断点

- 分支：`codex/v15-ai-decision-001`，基于已核验 integration HEAD
  `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`；PR6a 已通过 PR #11 达到
  `DONE / DONE_INTEGRATION`；
- ADR-027 v1.0 Final 已人工批准并本地落地，冻结 Provider/模型候选、服务端网络和 credential
  边界、唯一 whitelist、日志/保留、预算、timeout/retry/breaker、200 条非真实数据规范、
  provisional thresholds 和四项 immutable safety thresholds；
- 当前不冻结唯一 Provider；本任务不执行真实评测/实现，PR20 后 final provider/model/effect
  thresholds 仍需再次人工批准且不得降低安全阈值；
- 当前状态：AI-DECISION-001 `DONE / DONE_LOCAL`，PR2 `BLOCKED / NOT_STARTED`；达到
  `DONE_INTEGRATION` 前唯一 next 指针仍为 AI-DECISION-001，之后下一 canonical task 为 PR2；
- 主代理已独立审查完整 diff，`npm run check:context`、`npm run quality`、`git diff --check` 均 PASS；
  本轮未 add、commit、push、创建 PR、merge、访问 credential、调用真实 AI、
  创建云资源或部署。

## 2026-08-10 — PR6a 本地断点

- 分支：`codex/v15-pr6a-mysql84-validation`，基于已核验 integration HEAD `371a43d...`；
- V15-CTRL-001 已通过 PR #10 达到 `DONE_INTEGRATION`；
- PR6a Round 1 已关闭 loopback、凭据隔离、child env、脱敏、测试/evidence、进程树和 partial-create
  cleanup 七项缺口；focused tests 1 file / 26 tests PASS；
- MySQL 8.4.9 两次 fresh DB/user 均通过 9 migrations、14 files / 105 DB tests 和权限隔离；
  注入失败 exit 41、真实 SIGINT exit 60，四次均 DB/user residual 0，evidence SHA256 4/4 匹配；
- `npm run quality`、`npm run check:context`、`git diff --check` 均通过；临时 MySQL 进程已停止，
  临时数据目录已移入回收站；
- 交付边界：停在 `DONE / DONE_LOCAL`，未 add、commit、push、创建 PR、合并或部署；下一任务
  `TBD_AFTER_PR6A_REVALIDATION`。

日期：2026-08-06<br>
状态：WP0–WP8、WP9 与首页界面优化本地验收完成；正式 `main` 已建立并推送、GitHub 默认分支已切换为 main，远端 CI 通过；未部署

## 当前断点

- 发布准备第二阶段（2026-08-06）：确认 wp8 完整包含 wp1（0/42）后，从 `codex/wp8-release-prep` @ `42bcef0`
  建立并推送正式 `main`；main CI run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）；
  无 force push、无额外 merge commit、旧分支未改动；GitHub 默认分支已切换为 main（用户网页操作）；状态文档收尾提交已推送。
- 发布准备第一阶段（2026-08-06）：推送 `codex/wp8-release-prep`（首推 `71b9f74`）；
  首轮 CI run `31084434078` 失败后修复 `.github/workflows/ci.yml`（quality 前生成 Prisma client
  并构建 api-contracts），提交 `3e88808` 并推送；run `31084755305` PASS（quality、空库 migrate
  deploy、WP2 集成测试全部通过）；未创建 PR、未部署、未修改远端默认分支。
- 首页界面优化（2026-08-06）：今日概览/友好认证状态/精简导航/移动端底部导航/
  本月财务/空状态/同步状态；`npm run quality` 通过；用户端测试 15/15；
  浏览器验证通过；`docs/29`；已提交 `68f3987` 并随 wp8/main 推送，未部署。
- WP9（2026-08-06）：身份与录入简化本地验收完成；本地库 `daily_assistant_wp9`；
  已提交 `71b9f74` 并随 wp8/main 推送，未部署。
- 本机运行验证（2026-08-06）：API/Web/Admin 已启动并通过浏览器验证；本地库 `daily_assistant_local`；状态文档已更新，未提交。
- WP8 验收通过：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器矩阵（Web 102/公开 30/管理端 42，含 200% 缩放）无横向溢出、主流程（注册/登录/记账/日程/行程）与离线排队→恢复→单条落库均通过；备份恢复 24/24 表一致；账号删除演练（DELETION_PENDING/会话撤销/容量释放/脱敏审计）通过，期满清理未实现（缺口已记录，详见 `docs/26-wp8-acceptance-report.md`）。
- WP8 修复：审计枚举补全 `DRAFT_BATCH_DISCARD`；用户自助关号/申请删除/恢复码重开补写脱敏审计；生产强制 `CONFIRMATION_TOKEN_SECRET`；上传魔数校验；超大上传流 resume；文档一致性（`docs/05` RecoveryCode、`docs/06` DELETE /me/sessions）。
- 发布准备：`docs/27-wp8-staging-release-checklist.md`（staging 清单、监控告警、隐私/试用门禁、OPEN-001~011）。
- 分支：`main` = `codex/wp8-release-prep` = `42bcef0`（均已在 origin）；未部署、未创建生产资源。

- WP2 基线（2026-08-05 复核通过）：`npm run quality`、空库 migration、18/18 集成测试与 5 宽度浏览器矩阵均通过（详见 `docs/14-wp2-acceptance-report.md`）。
- WP3 验收通过：`npm run quality` 全部通过；空库 `prisma migrate deploy`（2 migrations）与 seed 通过；WP2+WP3 集成测试 29/29 通过；浏览器 5 宽度矩阵 30/30 无横向溢出；记账主流程（新增/编辑/删除/恢复、今日卡片、预算、CSV）与错误状态（校验失败、网络失败）通过；控制台 0 error / 0 warning（详见 `docs/16-wp3-acceptance-report.md`）。
- WP4 验收通过：`npm run quality`、空库 `prisma migrate deploy`（3 migrations）与 seed、WP2+WP3+WP4 集成测试 41/41、浏览器 5 宽度矩阵 25/25 与主流程（登录/文本解析/草稿确认/快捷指令创建撤销/OCR 失败降级）全部通过；控制台仅 OCR 失败场景的预期 503 日志（详见 `docs/18-wp4-acceptance-report.md`）。
- WP5 验收通过：`npm run quality`、空库 `prisma migrate deploy`（4 migrations）与 seed、WP2–WP5 集成测试 48/48、浏览器 5 宽度矩阵 20/20 与主流程（今日安排/建日程/校验错误/建待办并完成/建提醒/通知权限提示）全部通过；控制台仅预期 400 校验请求日志（详见 `docs/20-wp5-acceptance-report.md`）。
- WP6 验收通过：`npm run quality`、空库 `prisma migrate deploy`（5 migrations）与 seed、WP2–WP6 集成测试 55/55、浏览器 5 宽度矩阵 10/10 无横向溢出与主流程（行程列表/校验失败/新建/详情/超范围确认/行李勾选/日历跳转/关联账单）全部通过；控制台仅预期 400 校验请求日志（详见 `docs/22-wp6-acceptance-report.md`）。
- WP7 验收通过：`npm run quality`、空库 `prisma migrate deploy`（6 migrations）与 seed、WP2–WP7 集成测试 63/63、浏览器 QA-SYNC-001~004（断网新增/刷新保留/恢复单条落库/双设备冲突/退出清理/墓碑传播）与 5 宽度矩阵 20/20 无横向溢出全部通过；控制台 0 warning，仅离线场景预期网络错误与断连后 401 刷新日志（详见 `docs/24-wp7-acceptance-report.md`）。
- 本次会话执行 WP7：契约（`6ed79da`）、数据（`3ddf4e7`）、后端（`c9fee8c`）、前端（`479b0a9`、`c7a4fa1`）与文档提交（分支 `codex/wp7-pwa-sync`），均未推送。
- WP7 验收中修复：同步批次错误码由服务层返回、离线重连 401 自动刷新令牌、墓碑拉取时机与合并过滤、退出账号 IndexedDB 复合索引清理、冲突徽标状态覆盖。
- 本次会话执行 WP6：契约（`d039efc`）、数据（`c767ba5`）、后端（`8f70868`）、前端（`abbdeb7`）与文档提交（分支 `codex/wp6-trips`），均未推送。
- 验收中修复：wp2 行程路由管理员断言随 WP6 实现更新为 403；wp5 提醒测试固定日期改为相对未来时间；trip-item/packing-item 幂等查询改为经 `trip.userId` 关系过滤。
- 验收中修复：附件 DTO 编译元数据丢失（`import type` → 运行时导入）、批量丢弃确认令牌长度上限、/drafts 轻微横向溢出（`min-width: 0`）与附件类型错误码改由服务层返回（`c1cfc33`）。
- 下一步：等待用户决定是否推送 WP1–WP6 分支与确认远端 CI；WP7 未开始。
- 本次会话建立持久化项目状态恢复机制 v2：AGENTS.md 四章规则、`.project/session.md`、`.project/decisions.md`、`check:context` 校验脚本（并入 quality）与可选 `.githooks/pre-commit`。
- 本次会话执行 WP4：契约（`7cb7656`）、数据（`4be9524`）、后端（`4cd75e9`）与前端/文档提交，均未推送。
- 当前分支未推送；未创建生产资源或部署。

## 注意

- 不要修改 `D:\codex-worker` 的开封旅游助手仓库。
- 本次已获授权建立并推送正式 `main` 并完成状态文档收尾；仍禁止创建 PR、部署、修改远端默认分支或生产资源（默认分支已切换为 main，无需再操作）。

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

## 2026-09-08 — Private-preview smoke handoff

- Active release: `6515b8fd-2db6b6a2f199db4c`; service active and health 200.
- Post-deployment login/password-change/task/calendar/transaction/persistence smoke passed with zero blocking browser errors.
- Disposable account, cascaded data and temporary credentials were removed; next work is readiness and formal/public release review.
