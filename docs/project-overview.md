# 项目概述（Project Overview）

文档版本：1.1
更新：2026-10-23
适用版本：V1.5 私有预览；代码实现与发布验收分别记录。

## 项目目标

独立 Daily Assistant，首发约 10 名管理员创建账号的受邀用户。提供记账、日程、待办、提醒、行程、快捷指令辅助记账、AI 草稿/提案、云端同步及离线使用。管理员默认不能读取用户账单、日程、待办或行程正文。邮箱注册、邀请码注册及截图 OCR 已下线。

## 使用场景

- 手机 PWA：记账和快捷录入、查看安排、行程与提醒、离线操作及重连同步。
- 桌面网页：账单、账户、分类、预算、统计/CSV、计划与行程整理。
- 管理后台：创建账号、容量和账号生命周期管理、脱敏审计及健康状态。

## 核心功能现状

| 功能           | 代码事实                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| 账号与容量     | 管理员建号、登录/改密、暂停/关闭/恢复及容量控制已有实现                                   |
| 记账           | 账单增改删/恢复、分类、账户、预算、汇总与 CSV 已实现                                      |
| 快捷指令和草稿 | 可撤销设备凭证、幂等提交、文字草稿与确认入账已有实现                                      |
| 日程/待办/提醒 | 列表、详情、编辑及站内提醒已有实现；Web Push 有私有预览历史验收记录                       |
| 行程           | 行程、节点、行李项、关联账单/汇总与删除项恢复已有实现                                     |
| AI             | Provider 适配、提案审核/接受/拒绝及最终确认写入已有实现；最新字段校验修复未部署至当前预览 |
| PWA/离线       | IndexedDB 缓存、离线写入、重试、冲突确认与安装/更新流程已有实现                           |
| 管理端         | 账号、容量、审计与健康管理已有实现                                                        |

上述结论依据实际 API 模块、用户端路由、Store 和离线同步代码；不等于所有环境或设备已验收。金额使用定点/最小货币单位；用户 ID 强制隔离，业务时间默认 Asia/Shanghai，AI 不得未经确认写入正式数据。

## 技术栈与目录

- npm workspaces；Node 24 与隔离 npm 11.18.0。
- apps/web：Vue 3、TypeScript、Vite、Vue Router、Pinia、PWA。
- apps/admin：Vue 3、Element Plus。
- apps/api：NestJS 单体、Prisma/MySQL。
- packages/api-contracts：OpenAPI、共享枚举/类型和契约测试；packages/config：共享配置。
- Vitest 单元/契约测试、MySQL 集成验证及 Playwright 浏览器测试；GitHub Actions 执行质量、数据库和浏览器检查。

保持一个 API、一个数据库和两个前端；不增加微服务、消息队列或新基础设施。

## 当前交付与部署

- Integration：6cab22f580f3345696258dea9983ea09c6def7ab；PR #77～#82 已合并。
- 历史 merged CI 38364527083 三项 SUCCESS；当前预览为 d3db83b1-20260924T133437Z，API/Nginx/MySQL active。
- 最新代码与预览版本存在差距；Vite 8.2.4 补丁在本地通过完整 quality 和正式审计，0 High/Critical、8 Moderate，尚无补丁 SHA/CI 或部署。没有正式公开发布。
- R1 历史批准、独立 Staging 豁免及私有预览 H6/H7/H8 关闭保持原范围；H1/H2 豁免不能当作真机通过。
- R2/R3、Import、新 RRULE、完整本地加密迁移、Shrink、公开发布及扩容继续延后；天气尚未配置。

## 开发与接手

从 [AGENTS](../AGENTS.md)、[PLANS](../PLANS.md)、[execution-state](../.project/v15-execution-state.md)、[context](../.project/context.md)、[session](../.project/session.md) 恢复状态，再按明确任务工作。开发启动和隔离工具链见 [README](../README.md) 与 [Integration Bootstrap](codex-native-bootstrap.md)；环境文件只用受控占位配置，真实凭据不得提交。

本轮候选、兼容性、验证结果、回滚及待验收矩阵见 [私有预览更新准备清单](54-private-preview-update-plan-20261023.md)。架构见 [architecture](architecture.md)，冻结产品/API/数据范围见 docs/40 及其引用；历史阶段文档不能覆盖当前代码与实时交付事实。
