# 10 部署与运维

文档版本：0.1  
状态：待供应商确认  
更新：2026-08-07
适用版本：V1.0

## 环境

- `local`：开发者本机和容器化 MySQL。
- `test`：自动测试，使用独立临时数据库。
- `staging`：与生产接近，用于 migration、浏览器、通知和恢复演练。
- `production`：仅在明确批准后创建或变更。

## 最小部署单元

- 用户 Web 静态资源。
- 管理端静态资源，可采用独立域名或受保护路径。
- 一个 NestJS API 实例；如启用多实例，提醒租约必须先验证。
- 一个 MySQL 数据库。
- 一个私有对象存储桶。
- HTTPS 入口和域名。

## 环境变量类别

- 数据库连接。
- 访问/刷新令牌签名与轮换配置。
- 对象存储。
- 前端允许来源和公开 URL。
- 日志级别、上传限制、容量配置。

仓库中的 `.env.example` 只能包含变量名和安全占位符。

## 对象存储接入状态（OPEN-006）

- 已实现 `AliyunOssStorageAdapter`（`apps/api/src/integrations/aliyun-oss-storage.adapter.ts`），
  实现现有 `StorageAdapter` 的 `put/get/delete`，删除缺失对象按幂等成功处理。
- 已实现 `STORAGE_PROVIDER=local|oss` 切换与必填项校验：
  `STORAGE_BUCKET`、`STORAGE_REGION`、`STORAGE_ENDPOINT`、`STORAGE_ACCESS_KEY_ID`、
  `STORAGE_ACCESS_KEY_SECRET`；缺失配置时启动失败且错误信息不泄漏值。
- `NODE_ENV=production` 时禁止 `STORAGE_PROVIDER=local`，未显式配置也会启动失败（staging 门禁）。
- 上传仍由 API 服务端代理（`PUT /api/v1/attachments/:id/content`），不需要 OSS 浏览器 CORS。
- 新附件使用 `users/{userId}/attachments/{fileId}` 键；旧 `attachments/{userId}/...` 键
  保留兼容读取与删除（get/delete 始终使用数据库存储的 objectKey）。
- `LocalStorageAdapter` 仅用于本地开发与测试。
- 实现代码已随 PR #6 squash 合并到 main（merge commit `db5c5d3`）；main CI
  quality/browser-qa 均 SUCCESS。
- 尚未创建真实 OSS Bucket、RAM 用户或密钥；尚未完成真实 OSS 连通测试；staging 未创建、生产未部署。

## 发布流程

1. 备份数据库并记录可恢复点。
2. 在 staging 从备份副本演练 migration。
3. 运行完整质量门槛和浏览器旅程。
4. 部署向后兼容的 API 和数据库变更。
5. 部署 Web/管理端静态资源。
6. 验证账号密码登录、管理员建号/重置密码、记账、同步和提醒。
7. 观察错误和指标后结束发布窗口。

## 回滚

- 应用回滚到上一镜像/构建产物。
- 数据库变更优先采用向前修复；破坏性 migration 必须提供备份恢复路径。
- 文件对象采用不可预测键和延迟清理，避免应用回滚后引用消失。

## 备份恢复建议

- 数据库每日自动备份并保留多个恢复点。
- 对象存储启用版本或延迟删除能力。
- 定期在隔离环境恢复数据库和抽样附件。
- 备份必须加密、限制访问并与生产凭据分离。
- 具体 RPO/RTO 在选择托管供应商后确认，不虚构数值。

## 监控与告警

- API 可用性和错误率。
- 数据库连接与存储容量。
- 登录失败和异常限流。
- 同步积压和冲突率。
- 提醒失败和对象上传失败。
- 容量剩余名额只作为运营提示，不自动扩大上限。

## 发布前待确认

- 部署地域、域名与备案要求。
- 对象存储、通知和监控供应商。
- 隐私政策、用户协议、数据删除周期和未成年人策略。
- 账号创建与容量策略：默认仅管理员创建，人数硬上限。
