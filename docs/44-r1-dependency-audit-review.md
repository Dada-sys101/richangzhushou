# R1 依赖审计复核记录

复核日期：2026-09-02

状态：`DONE_LOCAL / CANDIDATE_REJECTED / R1 BLOCKED`

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

## 后续门禁

依赖负责人需要在不降低 SBOM、license 和审计完整性的前提下，选择并批准上游兼容版本，或提出经过正式兼容性、供应链和发布审批的修复方案。不得仅通过不兼容的 root override 或自动延长过期例外来关闭门禁。

R1 另外仍等待 H1 的 iPhone Safari 正式记录和 H2 的 iPhone PWA/离线重开正式记录；两项均不能由桌面 Chromium 或 WebKit 结果代替。
