# 架构说明（Architecture）

更新：2026-08-10

## 当前架构

- npm workspaces；
- Vue 3 PWA 用户端；
- Vue 3 + Element Plus 管理端；
- NestJS 单体；
- Prisma 7 + MySQL 8.4；
- OpenAPI 3.1；
- IndexedDB 离线队列和同步。

不引入微服务、消息队列、Kubernetes 或通用工作流。

## 已实现 V1

identity/auth/admin/capacity/audit、finance/drafts/attachments/shortcuts、
calendar/tasks/reminders/trips、PWA/IndexedDB/sync、Playwright 和 OSS Adapter。

Playwright、E2E 和 browser-qa 已固化到仓库/CI。

## V1.5 尚未完成

AI 正式集成、Push 正式集成、新 RRULE 读写/切换、Import、完整加密迁移、
Cutover/Shrink 和生产发布。PoC 只作证据。

## 扩展边界

- AI：`AiProvider` + Proposal/Operation，R1 一个真实 Provider；
- Notification：站内保底，Push 属 R1.1；
- Recurrence：PR1 已 DB Expand，R2 切换；
- Repository：R1 统一 V1 访问，R3 完整加密迁移；
- Import：R2；
- 不可逆清理：R3，单独批准。

## 数据和安全

服务端权威、userId 隔离、AI 不直写、Feature Flag 默认关闭、
Secrets 环境注入、Expand/兼容/切换/保留/Shrink。

## 部署

目标为 Web/Admin 静态资源 + 单 API + MySQL + 私有 OSS + HTTPS。
Staging 未创建，生产未部署。真实 OSS 资源和连通仍需授权验证。
