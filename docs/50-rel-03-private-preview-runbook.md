# REL-03 私有预览发布与回滚运行手册

状态：`DONE_LOCAL / EXISTING_ENVIRONMENT`

适用范围：现有 Alibaba 私有预览环境 `/opt/daily-assistant-preview`。本手册仅覆盖现有环境的受控发布、健康验证、备份和应用回滚；不创建资源、不开放公网、不修改 DNS/TLS/CORS，也不授权生产发布。

## 已验证基线

- 当前私有预览 release：`/opt/daily-assistant-preview/releases/8e9f53e0-20260914T1007Z`。
- 当前业务候选：`8e9f53e`；已合入 Integration `e407157`，合并 CI `34800440131` 的 quality、db-validation、browser-qa 通过。
- 最近受保护备份：`daily_assistant_preview_20260914T020652Z.sql.gz`。
- 当前应用回滚目标：`/opt/daily-assistant-preview/releases/b18b91d0-20260912T0735Z`。
- 2026-09-14 只读复核：API、Nginx、MySQL 均为 `active`，`/api/v1/health` 经私有预览 Host 路由返回 HTTP 200。

## 发布前检查

1. 核验目标 Integration commit 和合并 CI 的 quality、db-validation、browser-qa 均成功。
2. 确认本次没有未审查 migration；若存在 migration 差异，停止并另行核对兼容性、备份恢复路径和授权。
3. 在隔离 release 目录完成锁定依赖安装、Prisma generate、API/Web/Admin 构建与依赖审计；失败时不切换 `current`。
4. 创建受保护数据库备份，记录文件名、大小和时间；备份失败时停止发布。
5. 记录已验证的上一 release 路径，作为本次应用回滚目标。

## 受控发布

1. 将经过校验的源码或构建产物解压到新的、带 commit 与时间戳的 release 目录。
2. 在新目录执行全部预发布构建和审计检查，不修改现有 `current`。
3. 仅当步骤 1–2 成功后，原子更新 `current` 软链接到新 release，并重启 `daily-assistant-preview-api.service`。
4. 保留上一 release；不在发布窗口删除旧目录、备份或数据库记录。

## 发布后验证

1. 确认 API、Nginx 和 MySQL 服务均为 `active`。
2. 经私有预览 Host 路由检查 `/api/v1/health` 返回 HTTP 200；健康接口必须保持非敏感。
3. 检查用户端入口、受影响深链接、Manifest、Service Worker 与新构建资源均可访问。
4. 检查近期 API 启动日志不存在新的 `warn`、`error`、`exception` 或 `fatal`。
5. 对改动范围执行最小业务 smoke；涉及 UI 时还需要 iPhone/Android 私有预览验收。
6. 记录 release 路径、备份、回滚目标、检查结果和未验证项到 `docs/49-private-preview-release-assessment.md`。

## 应用回滚

只在新 release 造成可复现业务回归、健康失败或阻塞性错误时执行。

1. 停止进一步发布，保留故障 release 和相关脱敏日志供排查。
2. 将 `current` 原子切回已记录的上一 release，重启 API 服务。
3. 重复“发布后验证”的服务、健康、入口和关键业务 smoke。
4. 数据库变更优先向前修复；除非有明确的 migration/恢复授权，不通过回滚应用版本来反向修改数据库。
5. 仅当破坏性数据库变更且恢复方案已获独立授权时，才从受保护备份恢复到隔离目标并完成完整性核对。

## 退出条件与边界

REL-03 的轻量退出条件为：可用的私有预览 release、受保护备份、明确的应用回滚目标、服务与健康检查证据、发布后业务 smoke，以及本手册。

本手册不替代 REL-04 真机与真实服务验收、REL-05 封闭试用或 REL-06 生产发布门禁。公网 DNS/HTTPS/CORS、跨位置备份、Provider 扩展和生产环境操作仍需要各自的独立决策与授权。
