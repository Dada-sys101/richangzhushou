# Vite 安全依赖补丁（2026-10-23）

> Git 交付授权（2026-10-23）：用户明确确认提交当前 21 个文件、推送 codex/preview-readiness-20261022、创建面向 codex/v15-integration-foundation 的 Draft PR 并跟进 CI。当前正在交付；下文未提交/未授权表述为交付前检查点，不撤销本授权。合并、部署及真实服务调用仍不在范围内。

状态：`DONE_LOCAL / QUALITY_PASS / UNCOMMITTED / NOT_DEPLOYED`。任务 `VITE-SECURITY-PATCH-20261023`，基于 Integration `6cab22f580f3345696258dea9983ea09c6def7ab` 的本地未提交改动，不代表新的 Integration SHA 或部署版本。

## 范围与兼容性

用户在更新准备后指示“继续”，本轮处理已提出的 Vite High 依赖修复。使用既有工作区 `codex/preview-readiness-20261022`，保留上一轮文档和原始目录修改。canonical 仍为 `PRIVATE_PREVIEW_OPERATION / FEEDBACK_FIXES_ONLY`。

- `apps/web/package.json`、`apps/admin/package.json`：Vite 最低版本由 `^8.2.0` 提高为 `^8.2.4`。
- `package-lock.json`：统一锁定 Vite 8.2.4，用户端、管理端、Vitest/PWA 插件共用根依赖，清除旧 Vite 8.2.0。
- 必要间接依赖：PostCSS 8.5.25 → 8.5.31，Rolldown 1.2.2 → 1.2.15，`@oxc-project/types` 0.142.0 → 0.155.0，14 个现有 Rolldown 平台包同步升级并新增其 Android arm-eabi 可选包。共 19 项包记录改变；其他版本保持不变。
- Vite 要求 PostCSS `^8.5.26`、Rolldown `~1.2.4`；解析到该范围内的补丁版本。Node 要求未变，兼容项目 Node 24。上述变化包均声明 MIT，无新增安装脚本。
- 保留固定 npm 11.18.0、根 overrides、安装脚本 allowlist 和审计门禁。未改业务代码、UI 配置、数据字典、API/OpenAPI、Prisma schema/migrations、运行时环境变量、CORS 或部署配置；本补丁无需数据库迁移。

npm 首次定向更新产生两个 workspace 副本并保留旧根 Vite；复用 npm 解析出的包元数据合并至根后，再由隔离 npm 11.18.0 的 `install --package-lock-only --ignore-scripts --prefer-dedupe` 归一。最终以干净锁定安装、完整依赖树、SBOM 和质量门禁验证，不保留重复或过期 Vite。

## 安全依据

上游 [Vite 8.2.4 release](https://github.com/vitejs/vite/releases/tag/v8.2.4) 与 [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) 确认 8.2 分支的修复版本为 8.2.4；本轮没有跳转至 8.3 分支。

- 修复前：0 critical、1 high、8 moderate，Vite 导致正式门禁 FAIL_CLOSED。
- 修复后 `npm audit --json`：0 critical、0 high、0 low、8 moderate；Vite 已不在报告中。
- 8 项 Moderate 包：`@nestjs/platform-express`、`@prisma/adapter-mariadb`、`@vitest/mocker`、`fast-uri`、`mariadb`、`multer`、`postcss-selector-parser`、`vitest`。原始 npm audit 因这些 Moderate 仍退出 1，不等于仓库 High/Critical 门禁失败；最终正式命令结果另列。

## 验证

工具链为 Node 24.16.0、隔离 npm 11.18.0；仅继承工具/操作系统白名单环境，使用不可用于真实业务的数据库占位地址，AI/Push/调度关闭。

| 检查                                        | 结果                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `node scripts/codex-cloud-setup.mjs setup`  | PASS；干净 npm ci、安装脚本策略/rebuild、Prisma generate、共享包构建                                  |
| `node scripts/codex-cloud-setup.mjs verify` | PASS，exit 0；治理 30/30 与完整 quality                                                               |
| quality 阶段                                | context、format、Lint、typecheck、tests、build、Prisma、OpenAPI、离线 migration diff、audit 全部 PASS |
| 业务测试                                    | Admin 1、API 495、Web 493、contracts 151、config 8，共 1148 passed；140 项 API 数据库测试 skipped     |
| `npm ls --all --json`                       | PASS，problems 为空；Vite、PWA、Vitest 共用 8.2.4                                                     |
| SBOM generate / validate                    | PASS，1057 components                                                                                 |
| License inventory                           | 生成 PASS，1176 packages，17 license expressions，8 missing/unresolved，25 manual review required     |

许可证结果是元数据盘点，不代表全部许可证人工审核已完成；本补丁变化包均为 MIT，既有缺口不自动关闭。原始 audit exit 1 与正式 High/Critical 门禁 PASS 的区别已保留，未添加例外或改门禁。

未运行：真实数据库集成（140 项跳过）、浏览器五宽度/实机验收、真实 Provider、目标 Linux 构建与新远端 CI。离线 migration diff 未连接或修改数据库。新构建生成 PWA Service Worker 和资源通过，不等于浏览器/实机流程已验收。

最终收尾：18 个改动文档的 Markdown 解析与本地链接 PASS；新建/重写的 6 份文档显式 Prettier 检查 PASS；其余保留历史排版。`check:context` 与 `git diff --check` PASS。累计本地工作为 18 个文档和 3 个依赖文件，包含前一轮状态对齐；未添加临时脚本或日志到提交范围。

原始 D:/daily-assistant 的四项未提交文件 SHA-256 与准备阶段完全一致。

## 证据、交付与后续

交付前复核（2026-10-23）：远端 Integration 仍为 6cab22f；远端尚无 `codex/preview-readiness-20261022` 分支。已复核差异，并修正 PLANS Task Selection Policy 与 execution-state Recovery Rules 两处遗漏的修复前 High 阻塞描述。拟交付范围为已验证的 3 个依赖文件及本轮累计 18 个状态/准备文档，目标为 `codex/v15-integration-foundation`。本地 PR 说明已准备，尚未创建远端 PR。Git 提交、推送和 PR 按 PLANS 第 13 节分别等待明确授权；本轮未授权合并或部署。

本地忽略目录 `output/pr6/vite-patch-20261023/` 保存依赖差异、安装、质量、审计和供应链日志；`output/pr6/sbom.cdx.json` 与 `output/pr6/license-inventory.json` 为本地生成产物，未上传 CI。

当前 HEAD 仍为 `6cab22f`，不存在本补丁提交或远端 CI。当前服务器仍是已核实的 `d3db83b1-20260924T133437Z`；未执行提交、推送、PR、合并、部署、迁移或真实 Provider 调用。精确提交与 CI、目标 Linux 构建、受保护备份及发布后五宽度/实机验收仍须按 [更新准备清单](54-private-preview-update-plan-20261023.md) 执行。
