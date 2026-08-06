# Master Plan

版本：0.8<br>
状态：WP6 本地验收完成<br>
更新：2026-08-06

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

WP1 已在 `codex/wp1-foundation` 完成；WP2 在 `codex/wp2-identity-capacity` 完成本地实现与验收（报告见 `docs/14-wp2-acceptance-report.md`）。WP3 在 `codex/wp3-finance` 完成本地实现与验收（报告见 `docs/16-wp3-acceptance-report.md`）。WP4 在 `codex/wp4-shortcuts-ocr` 完成本地实现与验收（报告见 `docs/18-wp4-acceptance-report.md`）。WP5 在 `codex/wp5-calendar-tasks` 完成本地实现与验收（报告见 `docs/20-wp5-acceptance-report.md`）。WP6 在 `codex/wp6-trips` 完成本地实现与验收（报告见 `docs/22-wp6-acceptance-report.md`）。均使用本机便携 MySQL 8.4 完成真实空库 migration、API 集成与浏览器矩阵验证。
WP7 在 `codex/wp7-pwa-sync` 完成本地实现与验收（报告见 `docs/24-wp7-acceptance-report.md`）。
WP8 在 `codex/wp8-release-prep` 完成本地实现与验收（报告见 `docs/26-wp8-acceptance-report.md`）；分支已推送 `3e88808` 且远端 CI 通过（run `31084755305`），未部署。
