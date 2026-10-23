# Project Context

> Git 交付授权（2026-10-23）：用户明确确认提交当前 21 个文件、推送 codex/preview-readiness-20261022、创建面向 codex/v15-integration-foundation 的 Draft PR 并跟进 CI。当前正在交付；下文未提交/未授权表述为交付前检查点，不撤销本授权。合并、部署及真实服务调用仍不在范围内。

## Last Updated

2026-10-23 — 状态对齐、预览更新准备及 Vite 安全补丁本地完成；候选尚未提交或部署。

## Repository State

- Repository: `Dada-sys101/richangzhushou`。
- Main: `9421d819a44a47728e6d7f6e93bfd4f98f681f24`。
- Integration: `codex/v15-integration-foundation` / `6cab22f580f3345696258dea9983ea09c6def7ab`；2026-10-23 远端重核。
- Worktree: `C:/Users/hebia/.codex/worktrees/preview-readiness-20261022/daily-assistant`。
- Branch: `codex/preview-readiness-20261022`；HEAD 为上述 Integration，无本轮提交。
- 原始 `D:/daily-assistant` 分支与四项未提交内容保留，详见更新准备清单。

## Project Summary

独立 Daily Assistant，约 10 名管理员创建账号的受邀用户；NestJS 单体、MySQL、Vue PWA 与 Vue Element Plus 管理端。记账/预算、日程/待办/提醒、行程、快捷指令、AI 提案、离线同步和管理能力已有实现；实现存在不等于本候选全量验收完成。云端为主副本，AI 正式写入必须经用户确认。

## Current Task

- Canonical: `PRIVATE_PREVIEW_OPERATION / ACTIVE / FEEDBACK_FIXES_ONLY`。
- 本轮已完成：`VITE-SECURITY-PATCH-20261023`，承接 `PREVIEW-UPDATE-PREP-20261023`，限定 Vite 及必要间接依赖修复；canonical 保持不变。
- 当前运行 release：`/opt/daily-assistant-preview/releases/d3db83b1-20260924T133437Z`；API、Nginx、MySQL active。
- 本地候选：基于 `6cab22f` 的未提交 Vite 8.2.4 补丁；完整 quality 与正式审计通过，尚无补丁提交或 CI，未部署。历史 R1 APPROVED、独立 Staging 豁免、H6/H7/H8 关闭保持原范围；H1/H2 仍为豁免而非设备通过。

## Last Completed Task

本轮 Vite 补丁为 DONE_LOCAL，见 [修复记录](../docs/55-vite-security-patch-20261023.md)。最新远端代码交付为 PR #82 的 Integration Bootstrap 与 PR 基线保护，已合并至 `6cab22f` 且合并 CI 通过；这不是当前预览的部署版本。canonical 上次完成的 REL-03 历史收口语义保留。

## Completed Work

- 状态对齐、兼容性审查和更新验收准备已完成；Vite 8.2.4 补丁及本地验证为 DONE_LOCAL，High/Critical 均为 0，不等于已经部署。

- PR #77 行程子项恢复已合入；当前预览包含该版本。
- PR #78 手机内页导航、#79 依赖/测试门禁修复、#80 Cloud setup、#81 AI 澄清字段校验、#82 Bootstrap 均已合入，尚未出现在当前预览 release。
- 最新 merged CI `38364527083` 的 quality、db-validation、browser-qa SUCCESS；浏览器报告上传 SKIPPED。
- 既有 Web Push 私有预览验收、R1 决策与备份恢复历史证据继续有效于原范围，不作为本次新候选验证。

## Remaining Work

- 本地补丁待独立 Git 交付授权、形成精确 SHA 并通过远端 CI；历史 6cab22f CI 不覆盖补丁。
- 新候选目标 Linux 构建、备份、切换与业务/设备验收尚未执行。
- 公网发布、扩容、新基础设施、R2/R3 保持延后。

## Blockers

- Vite High 已在本地消除；尚无补丁 SHA/CI 和目标 Linux 构建、备份及部署后验收，不能视作发布就绪。
- Git 交付、部署及真实第三方调用尚无本轮独立授权；不阻碍完成本地准备。

## Known Issues

- 依赖仍有 8 项 Moderate；许可证清单有 8 项 missing/unresolved、25 项 manual review required，未自动关闭既有审核项。
- 当前预览记录中的业务及 iPhone/Android 验收仍待完成；本轮只核对服务运行状态。
- 历史 PWA 更新/系统返回限制与真实断网验收缺口未在本轮消除。
- Cloud Bootstrap 自动触发与平台自动 PR 基线仍未被证明；使用已记录的显式初始化流程。

## Verification Status

- 已核实：远端 SHA、PR 合并、候选历史 CI、服务器 current 和服务状态、候选兼容性差异。
- 修复后 setup、完整 quality、治理 30/30、依赖树、SBOM 1057 components 均 PASS；业务测试 1148 passed / 140 skipped。正式审计 PASS，0 High/Critical、8 Moderate。详见 [修复记录](../docs/55-vite-security-patch-20261023.md)。
- 未执行：本地真实数据库/浏览器矩阵、真实 Provider、目标 Linux 候选构建、部署与设备验收。

## Recent Changes

对齐 Integration、预览与本地工作区；两个前端提高 Vite 最低版本至 ^8.2.4，锁文件统一解析修复版及必要间接依赖。保留历史决策，不虚构发布晋级。

## Next Recommended Task

下一步是审阅本地补丁及已完成的状态对齐，独立授权后形成提交和 CI；再按精确 SHA/环境走预览更新与验收。不要自动执行下一 canonical 功能任务。

## Handoff Instructions

1. 先读 AGENTS、PLANS、本文件、session 与 execution-state；按更新准备清单恢复。
2. 本工作区包含既有文档改动和三个依赖文件的本地补丁；不要覆盖原始 D:/daily-assistant 的四项内容，不使用旧分支交付新候选。
3. 重核最终候选 SHA 与审计；当前本地通过不等于已提交、已跑远端 CI 或已部署。
4. 保留 H1/H2 豁免、H6/H7/H8 原范围和 R1 历史审批，不自动关闭任何新候选门禁。
5. 没有独立授权，不提交、推送、建 PR、部署、迁移或调用真实 Provider。
