# Master Plan

版本：0.8<br>
状态：WP0–WP9 本地验收完成；OPEN-007、V1 决策、OPEN-009 与 E2E 修复均已合并到 main，main CI 全绿；OPEN-006 对象存储接入代码已随 PR #6 squash 合并到 main（`db5c5d3`，main CI 全绿），真实资源与 staging 待授权<br>
更新：2026-08-07

| 工作包 | 目标 | 状态 |
| --- | --- | --- |
| WP0 | 产品、规则、数据、API、架构与交接文档 | DONE |
| WP1 | Monorepo 工程骨架、共享契约、CI 和本地环境 | DONE |
| WP2 | 身份认证、邀请码、容量限制、账号状态和管理端 | DONE |
| WP3 | 基础记账、分类、账户、预算和今日财务摘要 | DONE |
| WP4 | Apple 快捷指令、OCR 草稿和统一录入 | DONE |
| WP5 | 日程、待办、提醒和今日安排 | DONE |
| WP6 | 行程、节点、清单和账单关联 | DONE |
| WP7 | PWA、本地缓存、离线写入、同步和冲突处理 | DONE |
| WP8 | 安全、兼容、可访问性、全量验收和发布准备 | DONE（本地验收，未部署） |
| WP9 | 身份与录入简化（管理员建号、密码登录、邮箱/邀请码/OCR 下线） | DONE（已随 main 推送） |
| OPEN-007 | 账户期满删除清理（保留期/调度/附件删除/取消/匿名墓碑） | DONE（已合并到 main，待 staging 验证） |
| V1 决策与 QA | 产品名/通知范围/仓库命名固化 + OPEN-009 Playwright 自动化 | DONE（待 staging 验证 OPEN-006） |
| OPEN-006 接入 | 对象存储接入（OSS 适配器/STORAGE_PROVIDER 切换/键服务/测试/示例） | IN_PROGRESS（代码已合并到 main；真实 Bucket/RAM/连通测试待授权） |

WP1 已在 `codex/wp1-foundation` 完成；WP2 在 `codex/wp2-identity-capacity` 完成本地实现与验收（报告见 `docs/14-wp2-acceptance-report.md`）。WP3 在 `codex/wp3-finance` 完成本地实现与验收（报告见 `docs/16-wp3-acceptance-report.md`）。WP4 在 `codex/wp4-shortcuts-ocr` 完成本地实现与验收（报告见 `docs/18-wp4-acceptance-report.md`）。WP5 在 `codex/wp5-calendar-tasks` 完成本地实现与验收（报告见 `docs/20-wp5-acceptance-report.md`）。WP6 在 `codex/wp6-trips` 完成本地实现与验收（报告见 `docs/22-wp6-acceptance-report.md`）。均使用本机便携 MySQL 8.4 完成真实空库 migration、API 集成与浏览器矩阵验证。
WP7 在 `codex/wp7-pwa-sync` 完成本地实现与验收（报告见 `docs/24-wp7-acceptance-report.md`）。
WP8 在 `codex/wp8-release-prep` 完成本地实现与验收（报告见 `docs/26-wp8-acceptance-report.md`）；分支已推送至 `42bcef0` 且远端 CI 通过（run `31085287317`）；正式 `main` 已从 wp8 建立并推送（`42bcef0`，main run `31086031458` PASS），GitHub 默认分支已切换为 main（用户网页操作），`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留，未部署。
OPEN-007 已通过 PR #1（squash）合并到 main（merge commit `6d9c888`，migration
`20260806092920_open007_account_deletion_cleanup`）；本地 API 测试 111/111、空库 8 migrations、
CLI 演练与 main 远程 CI（run `31136793516`）均通过；未部署。
OPEN-006 对象存储接入代码已在 `codex/aliyun-oss-storage-adapter` 完成（ali-oss 6.23.0、
`AliyunOssStorageAdapter`、`STORAGE_PROVIDER` 切换、`StorageKeyService` 与 22 项新增单元测试）；
PR #6 已 squash 合并到 main（`db5c5d3`），main CI quality/browser-qa 通过；未创建真实
Bucket/RAM、未完成真实连通测试，OPEN-006 尚未关闭。
V1 决策（OPEN-001/005/011）与 OPEN-009 浏览器 QA 自动化在 `codex/v1-decisions-browser-qa` 分支完成：
Playwright smoke 20/20、完整矩阵 70/70；已通过 PR #3 squash 合并到 main（`4fcc613`）。
合并后 main browser-qa 暴露 E2E 时间助手 12/24 小时制缺陷，修复已通过 PR #4 合并到 main（`47c40c9`），
main CI run `31144549537` quality/browser-qa 均 SUCCESS。
