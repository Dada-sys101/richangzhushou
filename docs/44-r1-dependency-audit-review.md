# R1 依赖审计复核记录

复核日期：2026-09-02；增量复核：2026-09-03

状态：`DONE_INTEGRATION / CI_PASS / DEPLOYED_PRIVATE_PREVIEW / SUPERSEDES_2026-09-03_REJECTION`

> 当前结论：npm 11.18.0 下的 Prisma 7.9.1 精确 override 方案已经提交、合并、通过 CI 和目标 Linux audit/SBOM/build，并部署到私有预览。下文 2026-09-02/03 的拒绝和阻塞结论是调查历史，由 2026-09-08 的正式兼容性验证及交付记录覆盖。

## 结论

本轮完成了 R1 依赖审计阻塞的本地复核。尝试过的版本更新候选已因 SBOM 将其识别为不符合上游精确依赖声明而撤回；最终工作区没有留下 package、lockfile 或依赖覆盖变更。当前不能将 R1 依赖门禁写成通过。

## 当前基线

- Prisma 相关包为 `7.9.1`；其传递依赖为 `mariadb@3.4.5`、`mysql2@3.15.3` 和 `deepmerge-ts@7.1.5`。
- `npm run audit:dependencies` 仍 fail-closed：现有 `deepmerge-ts` 临时例外已于 `2026-09-01T23:59:00+08:00` 过期，并报告 Prisma/MariaDB/MySQL2 相关高风险依赖。
- `npm audit fix --dry-run` 提议的 Prisma 大版本回退不是本任务可接受的兼容修复。

## 候选评估与撤回原因

曾在 D: 盘一次性 npm 缓存中测试 Prisma `7.10.0` 与修复后的 `deepmerge-ts`、`mariadb`、`mysql2` 组合。候选阶段的 API、真实 MySQL 集成、Web smoke 和根质量检查曾通过，但 `npm sbom` 失败：Prisma 包声明的精确传递依赖仍分别要求旧版本，覆盖后的依赖树因此被标记为 invalid。该候选不具备可交付的供应链可复现性，已完整撤回。

## 回滚后验证

- `npm ci` 使用 `D:\daily-assistant-runtime\npm-cache` 完成。
- `npm ls` 通过，依赖树恢复为 Prisma `7.9.1` 及原有传递依赖，无 invalid 节点。
- `npm run test:governance`：14/14 通过。
- `npm run sbom:generate` 与 `npm run sbom:validate`：通过，CycloneDX 组件数 1044。
- `npm run inventory:licenses`：1163 packages；9 项 license metadata 缺失/未解析，25 项需人工复核，不能自动视为法律批准。
- `npm run audit:dependencies`：按现有审计规则 fail-closed，阻塞原因与基线一致。

## 2026-09-03 增量复核

- 在不改变 `package.json`、业务代码、Prisma/schema/migration、架构或部署配置的前提下，仅更新 `package-lock.json`：`fast-uri` `3.1.5 -> 3.1.7`、`qs` `6.15.3 -> 6.16.0`。
- 两个版本均落在现有父依赖范围内；重新执行 `npm ci` 和安装版本核对通过，依赖树保持有效。
- `npm audit` 结果由 `2 moderate / 6 high` 降为 `1 moderate / 5 high`；`fast-uri` 与 `qs` 的审计项已消除。
- `npm run test:governance`（14/14）、CycloneDX SBOM 生成/校验（1044 components）、license inventory（1163 packages）均通过；完整 `npm run quality` 通过审计前全部阶段，仅在依赖审计处 fail-closed。
- 剩余阻塞仍是 Prisma 7.9.1 的精确传递依赖链（`@prisma/config`/`deepmerge-ts`、`mariadb`、`mysql2`）及已过期例外；本次补丁不是该核心阻塞的最终解除方案，也未部署候选。

## 2026-09-03 上游稳定版本复核

- npm registry 当前稳定版本为 Prisma `7.10.0`、`@prisma/client` `7.10.0`、`@prisma/adapter-mariadb` `7.10.0`；其中 Prisma 仍精确依赖 `mysql2@3.15.3` 与 `@prisma/config@7.10.0`，配置包仍精确依赖 `deepmerge-ts@7.1.5`，MariaDB 适配器仍精确依赖 `mariadb@3.4.5`。
- 当前可见的 Prisma `8.0.0-rc.12` 为预发布版本，Node 要求为 `>=22.18.0`，且对应 `@prisma/client`、`@prisma/config` 和 MariaDB 适配器的完整匹配稳定组合未提供；不符合正式版依赖修复条件。
- 本地 `npm run audit:dependencies` 复核结果为 `FAIL_CLOSED`：临时例外已过期，并报告 `@prisma/adapter-mariadb`、`mariadb`、`mysql2` 以及 Prisma 审计链不符合当前正式门禁。
- 结论：当前没有可直接交付的稳定上游兼容修复。正式修复必须等待可用的稳定匹配版本，或另行完成经过架构、供应链和兼容性审批的数据库驱动迁移；本 R1 不采用预发布包、override 或临时例外延长。

## 后续门禁

## 2026-09-03 当前任务正式门禁复验

- npm registry 当前可用的最新稳定匹配三件套为 `prisma@7.10.0`、`@prisma/client@7.10.0`、`@prisma/adapter-mariadb@7.10.0`。
- 上游精确依赖仍为：`prisma@7.10.0 -> mysql2@3.15.3, @prisma/config@7.10.0`；
  `@prisma/config@7.10.0 -> deepmerge-ts@7.1.5`；`@prisma/adapter-mariadb@7.10.0 -> mariadb@3.4.5`。
  registry 中虽然已有稳定 `deepmerge-ts@8.0.2`、`mariadb@3.4.7`、`mysql2@3.24.3`，但不能由上述精确声明自然解析得到。
- `prisma` 的 `latest` 为 `8.0.0-rc.12`；这是预发布版本，且 `@prisma/client`、`@prisma/adapter-mariadb`、`@prisma/config` 没有对应的 `8.0.0-rc.12` 包，不能用于正式版门禁。
- 本次实际检查：`npm ci` PASS；`npm ls` PASS；`npm audit` FAIL（`1 moderate / 5 high`）；`npm run audit` 不存在（Missing script）；
  `npm run audit:dependencies` FAIL_CLOSED；`npm run sbom:generate`/`sbom:validate` PASS（1044 components）；
  `npm run inventory:licenses` PASS（1163 packages，9 missing/unresolved，25 manual review）；`npm run test:governance` PASS（14/14）；
  `npm run quality` FAIL，仅在最终 dependency audit 阶段 fail-closed。
- 结论：没有完整稳定的上游兼容修复；本轮没有修改 `package.json`/`package-lock.json`、审计脚本、业务代码或部署配置，没有运行 CI，也没有部署候选；R1 保持 `BLOCKED / NOT_READY`。

依赖负责人需要在不降低 SBOM、license 和审计完整性的前提下，选择并批准上游兼容版本，或提出经过正式兼容性、供应链和发布审批的修复方案。不得仅通过不兼容的 root override 或自动延长过期例外来关闭门禁。

H1/H2 真实 iPhone 正式记录仍未形成；按用户决定，当前私有预览跳过该验证并标记为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`，不能把桌面 Chromium 或 WebKit 结果写成真机通过。

## 2026-09-08 Prisma override 正式兼容性验证

状态：`FORMAL_COMPATIBILITY_VERIFIED_LOCAL / UNCOMMITTED / CI_NOT_RUN / NOT_RELEASE_READY`

独立最小复现交付物的哈希复核通过。此前 SBOM `invalid` 的直接根因已改判为 npm 11.13.0
Arborist 未跨 workspace/file link 传播根 `overrides`；同一 workspace、锁文件和 override 在 npm
11.18.0 下能够稳定生成有效依赖树与两类 SBOM。因此，“npm 11.13.0 下候选不可交付”仍成立，
但“override 永久不可交付”结论过强。

本地候选保留 `prisma`、`@prisma/client`、`@prisma/adapter-mariadb` 7.9.1，并精确 override：

- `deepmerge-ts@8.0.2`
- `mariadb@3.4.7`
- `mysql2@3.24.3`

项目通过 `packageManager: npm@11.18.0`、精确 npm engine、`engine-strict=true` 和三个 CI job 的
显式安装/版本断言固定 npm；系统 npm 11.13.0 的负向安装检查以 `EBADENGINE` 拒绝。当前仓库没有
Dockerfile 或应用部署构建脚本；`deploy/private-preview` 仅含备份 systemd/shell 文件，因此本轮没有
虚构或修改不存在的部署构建入口。npm 11.18.0 的安装脚本治理已按精确版本 allowlist 审阅
`@prisma/engines@7.9.1`、`prisma@7.9.1`、`argon2@0.45.1`、`esbuild@0.28.1`。统一入口
`install:locked` 先以 `--ignore-scripts` 安装，再用结构化 `npm install-scripts ls --json` fail-closed
确认不存在未审阅脚本，最后才执行 allowlist 中的 rebuild；新增脚本、版本漂移、命令或解析错误都会拒绝安装。

供应链结果：仓库内与外部空目录 `npm ci`、`npm ls --all`、`npm audit --json`、项目
`audit:dependencies`、两种 CycloneDX SBOM 及项目校验均通过；audit 为 0，`npm ls` 无 invalid/problem。
目标包在锁文件、实际树和两类 SBOM 中各只有一个预期版本，三条 override 依赖边正确。lock SBOM 为
1043 components/1044 dependency records，Windows 实际树 SBOM 为 970/971；差异是 73 个未安装的
跨平台 optional 原生包，目标组件和依赖边一致，外部 clean 与仓库结果分别完全一致。

过期 deepmerge 例外已清空，不再允许任何活动例外。审计仍严格解析 npm audit v2 JSON，任何
high/critical（包括经 `via` 链传播）、命令启动/超时/输出错误、空或不可解析输出、结构或计数不一致、
非空或畸形例外配置均 fail-closed；治理回归为 30/30 PASS。SBOM 校验新增候选精确版本、唯一性和
三条父子依赖边检查，不能用旧版本重复或缺边制造通过结果。

Prisma/MySQL 结果：config load、validate、generate、12 个现有 migration 空库 deploy、migration
status、已迁移数据库到 schema 的 zero diff 均通过。一次性 Oracle MySQL 8.4.11 最终全流程为
18 files/160 tests PASS，覆盖容量与最后名额并发、快捷指令幂等、用户隔离、同步/离线协议，以及新增
5 项驱动测试：DECIMAL/utf8mb4、事务提交/回滚、事务 timeout 后恢复、连接池 disconnect 释放与显式
重连、会话传输状态。真实数据库 Chromium desktop/mobile smoke 为 44/44 PASS；首轮因外部缓存缺少
Playwright Chromium revision 1234 在 browser launch 前 44/44 失败，补齐仓库外浏览器后原样重跑通过。

本地 MySQL 用户使用默认 `caching_sha2_password`，实际会话为 utf8mb4/utf8mb4_unicode_ci；项目仅把
`DATABASE_URL` 字符串交给 `PrismaMariaDb`，没有代码级 TLS、compression、连接池或 charset override。
本次 loopback 会话实测 TLS 关闭、compression 关闭，这准确覆盖当前默认本地路径；远程数据库 TLS、
证书校验、代理/负载均衡、网络抖动或服务端重启后的断线恢复未验证，因为本任务不读取生产凭据、不连接
真实环境。它们不阻塞候选进入 CI，但在任何远程部署批准前必须于等价 Staging 单独验证。

license inventory 命令通过（1162 packages；8 missing/unresolved；24 manual review）。人工项包括 5 个
内部 workspace 缺少 license metadata、`busboy`/`streamsearch` 缺失、`pause-stream` 非字符串 metadata、
`@visx/vendor`/`type-fest` 复合表达式、`elkjs` EPL-2.0、`mariadb` LGPL-2.1-or-later，以及各平台
`lightningcss` MPL-2.0 包；命令成功不等于法律批准。

完整 `npm run quality` 本地通过；远端 PR #25 仍只保留 2026-09-03 的既有结果（quality FAILURE，
db-validation/browser-qa SUCCESS），新候选 CI 尚未运行。证据目录为
`D:\daily-assistant-prisma-override-compat-20260908-093516`。本地回退可通过撤销本候选 package/lock、
npm/CI 和治理测试差异恢复原树，但旧树重新引入已知漏洞，只能用于紧急开发回退，不是安全发布方案。
R1 仍为 `BLOCKED / NOT_READY`；候选最多具备进入 CI 和人工 license/发布评审的条件。

## 2026-09-08 — 候选提交与远端 CI

- 经用户明确授权，15 个依赖/安装治理/CI/兼容性测试/README 文件提交为 `1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e`，父提交 `1b8354575cc195584af5ee3b1fe8882eda8c3bdd`，已推送至 PR #25 分支。
- PR CI https://github.com/Dada-sys101/richangzhushou/actions/runs/34181552275 与 push CI https://github.com/Dada-sys101/richangzhushou/actions/runs/34181550054 均 SUCCESS；quality、db-validation、browser-qa 各自全部 PASS。
- 依赖候选达到 DONE_PUSHED / CI_PASS；旧 UNCOMMITTED / CI_NOT_RUN 仅为历史验证快照。许可证人工结论与发布环境证据仍待完成，R1 保持 BLOCKED / NOT_READY；未 merge、部署或关闭门禁。
- 原有 15 个混合 Markdown 修改仍保留在本地，交付记录未另作追踪哈希提交。

## 2026-09-08 — PR25 merge and scoped license decision

- 用户明确接受本次许可证处理方案：保留第三方许可证和版权声明，不修改第三方库源码，按实际交付内容核对工具链组件；对外分发后端包/容器或修改库时重新评审。此为当前范围的人工决定，不是对任意未来分发的法律批准。
- 用户独立授权合并 PR #25；已匹配 candidate HEAD 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，并核验 PR/push 两轮 quality、db-validation、browser-qa 全绿。
- PR #25 于 2026-09-08T03:00:13Z MERGED；merge commit 6515b8fd0f13969a0e434d3d8223f60a82cb0310，远端 codex/v15-integration-foundation HEAD 已一致核验。Candidate delivery: DONE_INTEGRATION。合并后 CI 34181985716 SUCCESS，quality、db-validation、browser-qa 全部 PASS：https://github.com/Dada-sys101/richangzhushou/actions/runs/34181985716 。
- 本记录覆盖前文 PR_OPEN、候选 UNCOMMITTED/CI_NOT_RUN 和 LICENSE_APPROVAL_PENDING 的历史快照；本地原有 15 个混合 Markdown 修改保留，当前工作分支不切换，不额外提交记录。
- R1 仍 BLOCKED / NOT_READY：实际发布包许可证声明、目标环境差异与部署验收尚未完成。本次未授权或执行部署、真实数据库迁移、公网切换或发布门禁关闭。
