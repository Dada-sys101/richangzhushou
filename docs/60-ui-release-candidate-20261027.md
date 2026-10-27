# UI 更新发布候选 — 2026-10-27

状态：DONE_LOCAL / UNCOMMITTED / CANDIDATE_CI_PENDING / NOT_DEPLOYED。用户已认可当前页面方向并要求推进下一环节，最终目标上线；本记录准备现有 alifei.xyz 私有预览的更新候选，不代表公开注册、main/tag 生产发布或已部署。

## 候选与兼容性

- 工作区：`C:/Users/hebia/.codex/worktrees/preview-readiness-20261022/daily-assistant`；分支 `codex/preview-readiness-20261022`，当前 HEAD `fbb993342fe1def0f87853a1496e85c14f2bbd89`。本次新增修改尚无提交 SHA。
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
- Playwright desktop/mobile 86 项测试收集及修改的三个 E2E 文件 TypeScript 检查 PASS；**收集不等于执行**。
- 完整 `npm run quality` PASS：context、格式、Lint、类型、1157 项业务测试、全部工作区构建、Prisma、OpenAPI、离线 migration diff、正式依赖审计通过。Web 502 项通过；API 140 项数据库测试因未配置测试数据库 skipped。治理测试 30/30 PASS。
- 额外 Cloud Bootstrap 测试在 Windows 为 3 passed / 15 failed，出现 `RUNTIME_DIRECTORY_NOT_PRIVATE` 及符号链接 `EPERM`；该脚本要求 POSIX 0700 目录等约束，本轮未修改或绕过保护。必须由既有 Linux CI 复验，不能将本机结果写成通过。
- 既有 UI 五档宽度及错误状态证据见 docs/59；本轮未改变 UI。真机、真正离线恢复以及真实数据库浏览器 E2E 尚未验证。
- 本机没有 Docker/MySQL，未运行数据库测试，不使用生产数据库补测。后续候选 CI 必须通过 quality、db-validation、browser-qa；旧 HEAD 的成功不能复用。
- 日志位于 Git 忽略的 `output/browser-qa/release-prep-20261027/`；旧 UI 截图在 `output/browser-qa/record-family/`。

## 远端与环境只读核验

- Draft [PR #83](https://github.com/Dada-sys101/richangzhushou/pull/83) OPEN，目标 `codex/v15-integration-foundation`；远端 HEAD 仍为 fbb9933，与本地提交基点一致，未包含本轮未提交修改。
- 该旧 HEAD 的 PR CI `39917149441` 与 Push CI `39917145964` 三项 SUCCESS，仅为旧版本证据。
- Integration 为 `6cab22f580f3345696258dea9983ea09c6def7ab`，main 为 `9421d819a44a47728e6d7f6e93bfd4f98f681f24`；未改写这些分支。
- 当前 release 为 `/opt/daily-assistant-preview/releases/d3db83b1-20260924T133437Z`，API/Nginx/MySQL active；`https://alifei.xyz/api/v1/health` HTTP 200；磁盘使用约 32%。本轮只读核验，不代表新候选部署验收。

## 交付与回滚顺序

1. 完成本地检查和 diff 审阅，记录准确范围；按 [PLANS 第 13 节](../PLANS.md#13-人工授权点) 获取本候选 commit、push、更新既有 Draft PR #83 的独立授权。
2. 对真实候选 SHA 运行 CI，解决失败；核对最终 HEAD、三项检查与人工审阅。Ready、merge 各自按有效授权执行，不能复用父提交 CI。
3. 固定获批的 Integration SHA，按 [私有预览运行手册](50-rel-03-private-preview-runbook.md) 在现有主机隔离 release 中锁定安装、构建、审计，核验产物；切换前制作受保护数据库备份并确认旧 release 可回退。候选 Linux 构建和本次备份均未执行。
4. 获得对应 SHA/环境的部署批准后，原子切换 current、重启 API，核验健康、静态资源、PWA 更新与核心业务；覆盖五档宽度、Back、错误与离线状态。真机由用户现有一种设备验收，不能写成 iPhone/Android 双端通过。
5. 健康、资源或核心业务失败，按运行手册恢复旧 current 和服务；本候选没有 migration，不需要新增 schema 回滚。失败证据脱敏记录，不能以服务 active 代替业务验收。

canonical 保持 `PRIVATE_PREVIEW_OPERATION / FEEDBACK_FIXES_ONLY`；不自动推进公开上线、REL-05 扩量、main/tag 或新功能任务。
