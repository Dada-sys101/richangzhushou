# UI 更新发布候选 — 2026-10-27

状态：DONE_COMMITTED / DONE_PUSHED / PR_DRAFT / IMPLEMENTATION_CI_PASS / NOT_DEPLOYED。用户已认可当前页面方向并要求推进下一环节，最终目标上线；本记录准备现有 alifei.xyz 私有预览的更新候选，不代表公开注册、main/tag 生产发布或已部署。

## Git 交付检查点

- 用户随后明确授权本候选 commit、push、更新 Draft PR #83。实施提交 `f50d20cb519c827759e011999b46103c499e08ab` 已推送；PR 标题/说明已同步且仍为 Draft。下方 UNCOMMITTED 为交付前检查点，不覆盖本节。
- 本候选 40 个文件的提交前清单位于忽略的 `candidate-files.json`，清单 SHA-256 为 `e32466932de7535b1e3e05d7ed1862111ab32aaa9fb7108b5a68d983845caacc`；此前 17 个 Web 文件与恢复时哈希一致，未覆盖已确认 UI。
- 实施 SHA f50d20c 的 PR CI [40458997179](https://github.com/Dada-sys101/richangzhushou/actions/runs/40458997179)、Push CI [40458991356](https://github.com/Dada-sys101/richangzhushou/actions/runs/40458991356) 均 SUCCESS，quality、db-validation、browser-qa 三项通过。MySQL 8.4.13：18 文件 / 162 项；Chromium desktop/mobile：86/86；Linux Bootstrap：18/18。已下载数据库证据；浏览器报告仅失败时上传，本次 SKIPPED。
- 该 CI 仅覆盖实施提交 f50d20c；本交付记录的后续文档提交须独立核验最终 HEAD 的检查，不能复用父提交 CI。尚未 Ready、合并或部署；本地 Windows 失败与数据库 skipped 仍是原检查点事实，不再是已通过 Linux 候选 CI 的阻塞。

## 候选与兼容性

- 准备基点：`C:/Users/hebia/.codex/worktrees/preview-readiness-20261022/daily-assistant`；分支 `codex/preview-readiness-20261022`，基点 HEAD `fbb993342fe1def0f87853a1496e85c14f2bbd89`。实施与交付状态见上节。
- 纳入已确认的手机内页导航 A 与同类记录页面 UI，见 [导航记录](56-mobile-navigation-a-20261023.md)、[统一 UI 记录](59-record-ui-system-20261027.md)。原始 `D:/daily-assistant` 的四项未提交文件未修改。
- 根 overrides 固定 `body-parser@2.4.0`、`multer@2.5.0`、`undici@8.12.2`，API 直接 Multer 同步；锁文件保留必要的 content-type/qs 配套解析及移除 Multer 不再使用的 concat-stream/typedarray。NestJS 仍为 11.2.3，未升级框架大版本。
- 三项修复版本满足官方公告：[body-parser](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)、[Multer](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m)、[Undici](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm)。变化依赖为 MIT/BSD-3-Clause，无新增安装脚本，符合项目 Node 24 运行范围。
- `navigation-shell.spec.ts`、`trips.spec.ts` 经共用 `record-ui.ts` 操作真实 disclosure 入口；先展开更多菜单/新增表单再点击，不强制点击隐藏按钮。保留请求计数、删除恢复、失败重试、未保存保护与字体放大断言；不存在跳过或放宽超时。
- 与已部署 d3db83b 比较，候选还包含此前已合入 Integration、尚未部署的 #78～#82 改动。未发现 schema、migration、DTO/OpenAPI、运行环境变量、CORS 或部署配置变化；本轮不执行迁移，不启用新的真实服务。
- DeepSeek direct worker（`deepseek-v4-flash`）完成只读调查与两个 manifest 的受限修改；其锁文件操作因 EACCES 停止。主代理检查部分 diff 后完成锁文件、测试入口适配及独立验证，没有使用 worker 执行 Git 或外部写操作。

## 验证证据

- npm 11.18.0 `install:locked` 干净安装、安装脚本策略与 rebuild PASS；Prisma client 生成及共享包构建 PASS，不连接数据库。
- 正式 `audit:dependencies` PASS：0 High/Critical；安装报告仍有 6 Moderate、1 Low。未修改审计器、阈值或空豁免配置。
- `npm ls body-parser multer undici --all` PASS，实际安装版本与锁文件一致。
- 许可证清单 PASS：1174 packages、8 missing/unresolved、25 manual review required；这些是既有待审核项，不自动关闭。SBOM 验证 PASS：1056 components。
- 本地 Playwright desktop/mobile 86 项收集及修改的三个 E2E 文件 TypeScript 检查 PASS；本地收集不等于执行，后续真实执行证据见顶部 CI 交付节。
- 完整 `npm run quality` PASS：context、格式、Lint、类型、1157 项业务测试、全部工作区构建、Prisma、OpenAPI、离线 migration diff、正式依赖审计通过。Web 502 项通过；API 140 项数据库测试因未配置测试数据库 skipped。治理测试 30/30 PASS。
- 额外 Cloud Bootstrap 在 Windows 为 3 passed / 15 failed，出现 `RUNTIME_DIRECTORY_NOT_PRIVATE` 及符号链接 `EPERM`；后续 Linux CI 18/18 通过，保留本机失败事实，未修改或绕过 POSIX 0700 目录等保护。
- 既有 UI 五档宽度及错误状态证据见 docs/59；本轮未改变 UI。CI 数据库/浏览器证据见顶部；真机、真正离线恢复仍未验收。
- 本机没有 Docker/MySQL，未运行数据库测试，不使用生产数据库补测。候选 Linux CI 已按顶部记录通过，旧 HEAD 的成功不能复用于文档后续提交。
- 日志位于 Git 忽略的 `output/browser-qa/release-prep-20261027/`；旧 UI 截图在 `output/browser-qa/record-family/`。

## 交付前远端与环境只读核验

- Draft [PR #83](https://github.com/Dada-sys101/richangzhushou/pull/83) OPEN，目标 `codex/v15-integration-foundation`；远端 HEAD 仍为 fbb9933，与本地提交基点一致，未包含本轮未提交修改。
- 该旧 HEAD 的 PR CI `39917149441` 与 Push CI `39917145964` 三项 SUCCESS，仅为旧版本证据。
- Integration 为 `6cab22f580f3345696258dea9983ea09c6def7ab`，main 为 `9421d819a44a47728e6d7f6e93bfd4f98f681f24`；未改写这些分支。
- 当前 release 为 `/opt/daily-assistant-preview/releases/d3db83b1-20260924T133437Z`，API/Nginx/MySQL active；`https://alifei.xyz/api/v1/health` HTTP 200；磁盘使用约 32%。本轮只读核验，不代表新候选部署验收。

## 交付与回滚顺序

1. 本地检查、diff 审阅、commit/push/更新 Draft PR #83 已按用户后续明确授权完成，详见顶部交付节；授权边界按 [PLANS 第 13 节](../PLANS.md#13-人工授权点)。
2. 实施 SHA CI 已通过；交付记录后续提交仍须核对最终 HEAD、三项检查与人工审阅。Ready、merge 各自按有效授权执行，不能复用父提交 CI。
3. 固定获批的 Integration SHA，按 [私有预览运行手册](50-rel-03-private-preview-runbook.md) 在现有主机隔离 release 中锁定安装、构建、审计，核验产物；切换前制作受保护数据库备份并确认旧 release 可回退。候选 Linux 构建和本次备份均未执行。
4. 获得对应 SHA/环境的部署批准后，原子切换 current、重启 API，核验健康、静态资源、PWA 更新与核心业务；覆盖五档宽度、Back、错误与离线状态。真机由用户现有一种设备验收，不能写成 iPhone/Android 双端通过。
5. 健康、资源或核心业务失败，按运行手册恢复旧 current 和服务；本候选没有 migration，不需要新增 schema 回滚。失败证据脱敏记录，不能以服务 active 代替业务验收。

canonical 保持 `PRIVATE_PREVIEW_OPERATION / FEEDBACK_FIXES_ONLY`；不自动推进公开上线、REL-05 扩量、main/tag 或新功能任务。
