# 私有预览更新准备与验收清单

> 2026-10-23 交付更新：补丁 fb50097 已提交推送，Draft PR #83 已创建；PR CI 39916174760 SUCCESS（数据库 162 项、浏览器 86 项通过），Push CI 39916145898 也为 SUCCESS。后续文档提交的最终 HEAD/CI 以 PR 为准。详见 [交付快照](55-vite-security-patch-20261023.md)；以下未提交状态为早期检查点，未合并或部署。

更新：2026-10-23（Asia/Shanghai）。最新状态：`DONE_LOCAL / VITE_PATCH_QUALITY_PASS / UNCOMMITTED / NOT_DEPLOYED`。

## 目标与授权边界

用户同意对齐最新代码和状态记录，并准备预览更新与验收，随后指示继续完成已提出的 Vite 安全修复。授权范围为本地准备、依赖补丁和验证及远端只读核验；没有 commit、push、PR、merge、部署、迁移、真实 AI/Push 调用或用户数据写入。canonical 保持 `PRIVATE_PREVIEW_OPERATION / FEEDBACK_FIXES_ONLY`，不改变架构、冻结范围及既有人工门禁。

## 最新本地修复结果

Vite 8.2.4 补丁已完成，完整 quality、正式依赖审计、锁定安装、依赖树和 SBOM 均 PASS；治理 30/30，业务测试 1148 passed / 140 skipped。审计 0 High/Critical、8 Moderate。补丁仅存在本地工作区，基于 6cab22f，尚无补丁提交或 CI；详细范围与证据见 [Vite 修复记录](55-vite-security-patch-20261023.md)。以下保留修复前失败证据，不再将 Vite High 作为本地当前阻塞，也不把本地通过视作部署批准。

## 精确版本与证据

| 对象                                  | 已核实事实                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库                                  | `Dada-sys101/richangzhushou`                                                                                                                                               |
| Integration / 补丁基线                | `6cab22f580f3345696258dea9983ea09c6def7ab`；2026-10-23 `git ls-remote` 重核未变                                                                                            |
| main                                  | `9421d819a44a47728e6d7f6e93bfd4f98f681f24`；未晋级                                                                                                                         |
| 最新合并 CI                           | [38364527083](https://github.com/Dada-sys101/richangzhushou/actions/runs/38364527083)，2026-10-13 完成；quality、db-validation、browser-qa SUCCESS，浏览器报告上传 SKIPPED |
| PR                                    | #77～#82 已合并；2026-10-22 查询无开放 PR                                                                                                                                  |
| 当前预览                              | `d3db83b19eb6a9f0b751bd13f2020d2519364fb7`                                                                                                                                 |
| 当前 release / 拟更新时的应用回滚目标 | `/opt/daily-assistant-preview/releases/d3db83b1-20260924T133437Z`；2026-10-23 SSH 只读核对 current 指向                                                                    |
| 服务                                  | API、Nginx、MySQL 均 active；本轮未进行已认证业务验收                                                                                                                      |
| 独立工作区                            | `C:/Users/hebia/.codex/worktrees/preview-readiness-20261022/daily-assistant`                                                                                               |
| 工作分支                              | `codex/preview-readiness-20261022`，HEAD 为上述基线；本地另含未提交的 Vite 依赖补丁及文档                                                                                  |

已核对 GitHub PR 元数据及合并 SHA；PR 正文中的“尚未提交/保持 Draft”等为历史描述，不覆盖实时 MERGED 状态。

## 相对当前预览的变化与兼容性

已合并基线与当前预览的差异为 17 个文件；本地补丁另改两个前端 package.json 与根锁文件及文档。`git diff d3db83b..6cab22f` 没有 Prisma schema、migration、DTO 定义、OpenAPI、共享 API contracts、部署模板、运行时环境变量声明或 CORS 改动。没有数据库迁移需要随本候选执行；应用回滚使用上一 release，不执行数据库恢复。

| 交付               | 内容                                        | 验收重点                                             |
| ------------------ | ------------------------------------------- | ---------------------------------------------------- |
| PR #78 / `c19df9e` | 已登录手机端详情/编辑等内页持续显示底部导航 | 首页可达、未保存保护、键盘与底部按钮/安全区不遮挡    |
| PR #79 / `cb7cd97` | 锁文件安全修复、预算测试月份固定            | 最新审计、可重复安装、全部构建、账单与预算基础回归   |
| PR #80 / `10847ee` | 受控 Cloud setup                            | 仅开发工具，不替代部署脚本                           |
| PR #81 / `20f8e70` | AI 澄清操作持久化前也校验已提供字段         | 合法澄清兼容；非法字段不持久化；最终业务写入仍需确认 |
| PR #82 / `6cab22f` | Integration Bootstrap 与 PR 基线检查        | 开发初始化/保护测试；不推定平台自动触发已验证        |

AI 修复的 DeepSeek/OpenAI 回归使用 mock transport；不能将其视作本候选真实 Provider 验收。依赖补丁与 Vue 等锁定版本变化需要新目标 Linux 构建和审计，不能复用 9 月产物。

## 更新准备阶段验证（Vite 修复前）

- 工具链：Node 24.16.0；通过仓库 setup 使用隔离 npm 11.18.0，不修改全局 npm。
- 锁定安装、安装脚本策略/rebuild、Prisma generate、共享包构建：PASS（2026-10-23）。
- 本地 verify：治理 30/30 PASS；quality 的上下文、格式、Lint、类型、测试、构建、Prisma/OpenAPI、离线 migration diff 均 PASS，仅最终 audit:dependencies FAIL_CLOSED。业务套件：Admin 1、API 495、Web 493、contracts 151、config 8，合计 1148 passed；140 项 API 数据库测试因无测试数据库而 skipped。离线 migration diff 未连接或修改数据库。
- 兼容性差异审查：已完成；没有新增数据库/接口/环境配置差异。
- 当前部署与服务：只读核对通过；当前候选未上传、未构建于目标 Linux、未部署。
- 文档验证：17 个改动文档的 Markdown 解析和本地链接 PASS；新建/重写的 5 份文档使用空 ignore 文件显式 Prettier 检查 PASS；其余文档保留历史排版并通过解析与差异检查。check:context 与 git diff --check PASS。仓库 format:check 默认忽略 Markdown，已在质量流程通过。
- 本地数据库集成、五档浏览器和实体设备：本轮未执行；候选合并 CI 有数据库与浏览器通过记录，不能替代本次部署后验收。

## 准备阶段安全阻塞（已本地修复）

- 正式命令 node scripts/codex-cloud-setup.mjs verify 在最终审计退出 1；错误为 unapproved high/critical package vite (high, moderate, low)。
- 锁定 Vite 为 8.2.0；npm audit --json 返回 0 critical、1 high、8 moderate。
- High 公告：[GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm)，launch-editor 在 Windows 上存在 fs.existsSync 检查绕过；npm 报告影响范围 >=8.2.0 <=8.2.3，fixAvailable=true。
- 另有 Vite Moderate/Low 公告；其余被报告的包包括 @nestjs/platform-express、@prisma/adapter-mariadb、@vitest/mocker、fast-uri、mariadb、multer、postcss-selector-parser、vitest。
- 这是锁文件当前被审计识别的风险，不等于已证明 Linux 静态预览存在同一路径的可利用问题。仓库门禁不允许以此推断放行；本轮未放宽门禁、未升级依赖。
- 准备阶段的建议是单独限定范围的 Vite 依赖补丁（现已本地完成，见上方最新结果）：核实正式修复版本、最小化锁文件变更、复跑安装/完整 quality/供应链/CI，再形成新 SHA；不自动扩大到框架大版本或所有 Moderate。
- 当时本地准备完成、基线候选因审计被阻塞；后续本地补丁已消除该 High，但仍须完成下面发布条件。

## 发布前必须满足的条件

1. 本地 Vite 补丁已排除本日 High 并通过正式审计，门禁未放宽；交付后须按最终精确 SHA 重新核验审计与 CI，不自动沿用未提交工作区证据。
2. 对最终候选重核 Integration、合并 CI、完整质量/供应链检查；本清单不得自动指向未经核验的新 HEAD。
3. 部署批准需明确目标为现有 Alibaba 私有预览及精确候选 SHA。依据 [PLANS 第 13 节](../PLANS.md#13-人工授权点)，当前准备授权不自动包含部署或 Git 交付动作。
4. 获准后，才在新的隔离 release 目录执行锁定安装、安装脚本策略、Prisma generate、API/Web/Admin 构建、审计、License/SBOM；禁止变更真实 Provider 开关和公网配置。
5. 切换前创建新的受保护数据库备份并验证完整性，复核 current 及回滚 release。9 月的历史备份不作为本次新备份；本轮未读取备份正文或创建备份。
6. 任何构建、审计、备份或兼容性检查失败都不切换 current。没有 migration 差异，不执行 migrate deploy 或数据库恢复。

## 切换、回滚与发布后检查

- 执行既有 [REL-03 运行手册](50-rel-03-private-preview-runbook.md)，仅在全部发布前条件满足后原子切换 current 并重启 API。
- 检查 API/Nginx/MySQL、非敏感 health、主要入口与深链接、Manifest、Service Worker、Push Worker、图标和新资源；日志只记录脱敏结论。
- 出现健康失败、阻塞错误或可复现业务回归时停止验收并回退至切换前核实的 release，重跑健康与业务检查。应用回滚不修改数据库。
- 当前拟回滚目标为 `d3db83b1-20260924T133437Z`；若切换前 current 已变化，必须重核并更新记录，不能沿用本快照盲目回滚。

## 待执行验收矩阵

| 流程                                                         | 375 / 390 / 430 / 768 / 1440 CSS 像素 | iPhone / Android |
| ------------------------------------------------------------ | ------------------------------------- | ---------------- |
| 登录、强制改密、退出后数据隔离                               | PENDING                               | PENDING          |
| 手机内页底部导航、返回首页、未保存拒绝/接受离开、浏览器 Back | PENDING                               | PENDING          |
| 长内容、200% 字号、软键盘、安全区、保存/确认按钮             | PENDING                               | PENDING          |
| 行程节点/行李删除后刷新与重进、恢复、无重复行、失败重试      | PENDING                               | PENDING          |
| 账单/预算基本流程及 AI 草稿审核后确认写入                    | PENDING                               | PENDING          |
| 离线写入、重连同步、冲突确认、用户隔离                       | PENDING                               | PENDING          |
| 加载/空/失败状态、控制台与网络失败                           | PENDING                               | PENDING          |

所有业务测试先明确合成账号/数据与清理边界。真实 AI/Push 测试需要对应独立授权；H6/H7/H8 的历史关闭不会自动授权本次新调用。当前生产发布、公开注册、扩容、R2/R3 和新基础设施均不在范围内。

## 原工作区保留情况

`D:/daily-assistant` 保持 `codex/trip-child-restore` / `3b5e982783b5bed796eeb62ada4535c9c124d10c`；两项修改、两项未跟踪内容不移植、不覆盖。2026-10-23 结束时复核以下文件内容 SHA-256 全部一致：

| 文件                                            | 开始时 SHA-256                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `docs/49-private-preview-release-assessment.md` | `29A36DD40A50688508934D7D9740193C80968D4C04EE79DFB2335A628EE55B35` |
| `docs/changelog.md`                             | `D57E25339EFF0DBE28520EF67FEA30DEBE55CA44DF8526C4DB841C84C5379CA8` |
| `docs/codex-cloud-environment.md`               | `B707069E86A3F28F69EFF8AA3E6D6E1C1F0183AFE461B970552DBB1D7A75343F` |
| `scripts/codex-cloud-setup.mjs`                 | `2EA391FB9DED5A79C0B6877211D7F9D044E6619154C3CF8DA850A02A06BC12D1` |

原工作区 9 月 27 日部署记录保留原样；本清单只采用本轮独立核实的 release/服务事实。历史业务/设备验收待完成的状态未被覆盖。

## 准备阶段本地证据与收尾（历史记录）

- setup、quality 与审计摘要保存在本工作区 output/pr6/preview-prep-20261023/ 下；属于被 Git 忽略的本地证据，不包含真实业务数据或凭据，不将日志当作已上传 CI 产物。
- 本轮 17 个文档变更（16 修改、1 新增）均为本地未提交状态。HEAD 保持 6cab22f；业务代码、锁文件、数据库、CI 和部署配置均未改。
- 准备阶段为 DONE_LOCAL，当时基线为 BLOCKED_DEPENDENCY_AUDIT；随后本地修复为 DONE_LOCAL / QUALITY_PASS / UNCOMMITTED。当前预览继续原版本运行，没有提交、推送、PR、部署或真实服务调用。
