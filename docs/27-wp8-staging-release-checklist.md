# 27 WP8 Staging 发布检查清单与运维准备

> 范围调整：WP9（docs/28）已下线邮箱/邀请码/截图 OCR；`MAIL_ADAPTER`、`FAKE_OCR_*`、
> `FAKE_SCAN_*` 等变量已移除，账号创建与密码重置改为管理端操作。

文档版本：1.0<br>
状态：本地可执行清单（真实 staging 创建/部署需另行授权）<br>
更新：2026-08-06<br>
适用版本：V1.0

## 1. 用途

将 `docs/10-deployment-and-operations.md` 落为可勾选清单。任何一项未完成或标注 `[待确认]`
均不得宣布“可开放体验”或生产可用。

## 2. 环境变量清单（staging）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | 是 | `production`（触发 HTTPS Cookie 与密钥强校验） |
| `PORT` / `API_BASE_PATH` | 是 | 端口与 `/api/v1` 前缀 |
| `BUSINESS_TIME_ZONE` | 是 | `Asia/Shanghai` |
| `DATABASE_URL` | 是 | 仅 staging 数据库，禁止写仓库 |
| `CORS_ORIGINS` | 是 | 精确允许的用户端/管理端来源 |
| `ACCESS_TOKEN_SECRET` | 是 | 长随机密钥 |
| `CONFIRMATION_TOKEN_SECRET` | 是 | 长随机密钥（WP8 强制，见 `docs/26` CP2） |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_SECONDS` | 是 | 建议 900 / 2592000 |
| `MAIL_ADAPTER` | 是 | 真实邮件适配器或明确禁用 |
| `REMINDER_SCHEDULER_ENABLED` | 是 | 单实例时 `true`；多实例前必须先做数据库租约 |
| `LOCAL_STORAGE_DIR` / 对象存储配置 | 是 | 生产不得使用本地临时存储 |
| `FAKE_*` 适配器开关 | 否 | 真实供应商接入后必须关闭 |

## 3. 安全与兼容性检查

- [ ] HTTPS 入口与 HSTS；Cookie `Secure` 由 `NODE_ENV=production` 自动启用。
- [ ] CORS 仅允许 staging 来源；注册默认关闭，邀请制且人数硬上限。
- [ ] `prisma migrate deploy` 在 staging 空库演练通过；回滚说明见 migrations README。
- [ ] 健康检查 `/api/v1/health` 存活/就绪可区分；不暴露依赖凭据。
- [ ] 错误响应仅含 `code/message/requestId`，无堆栈。
- [ ] 日志不含密码、令牌、邀请码、账单正文、完整邮箱或图片内容。

## 4. 部署与回滚步骤

1. 备份数据库并记录可恢复点（备份必须加密、限权、与生产凭据分离）。
2. 在 staging 从备份副本演练 migration。
3. 运行 `npm run quality` 与浏览器矩阵（`docs/26` CP4/CP5）。
4. 先部署向后兼容的 API 与数据库变更，再部署 Web/管理端静态资源。
5. 验证登录、注册关闭状态、记账、同步与提醒。
6. 观察错误率与指标后结束发布窗口。
7. 回滚：应用回退上一构建产物；数据库变更优先向前修复，破坏性 migration 必须提供备份恢复路径。

## 5. 监控与告警配置清单

- [ ] API 可用性与 HTTP 5xx 错误率告警。
- [ ] 数据库连接数、存储容量与慢查询。
- [ ] 登录失败与异常限流触发告警。
- [ ] 同步积压/失败与冲突率（`sync/status` 口径）。
- [ ] 提醒投递失败、OCR/AI 失败、附件上传失败。
- [ ] 容量剩余槽位仅作运维提示，不自动扩限。

## 6. 隐私说明与小规模试用门禁

- [ ] 隐私说明：覆盖数据收集范围（记账/日程/待办/行程）、保存期、删除申请路径与审计保留。
- [ ] 试用门禁：邀请码 + 全局有效用户硬上限（10–20 名），注册默认关闭。
- [ ] 删除路径：用户可申请删除（已实现 `DELETION_PENDING`）；期满批量清理与保留期
  `[待确认]`（OPEN-007），实现前不得宣称“数据已删除”。
- [ ] 供应商与部署地 `[待确认]`：邮件/OCR/AI/对象存储/通知、部署地域与合规（OPEN-003/004/005/006）。

## 7. 发布前待确认项（OPEN-001~011）

| ID | 事项 | 状态 |
| --- | --- | --- |
| OPEN-001 | 正式产品名称 | 未决，暂用 Daily Assistant |
| OPEN-002 | 正式仓库与远程策略 | 未决，origin 未推送 |
| OPEN-003 | 邮件供应商 | 未决，当前 memory 适配器 |
| OPEN-004 | OCR/AI 供应商 | 未决，当前 fake 适配器 |
| OPEN-005 | 通知渠道（Web Push/系统） | 未决，应用内提醒可用 |
| OPEN-006 | 部署地域与对象存储 | 未决，未创建资源 |
| OPEN-007 | 关闭/删除保留期与清理 | 未决，暂按 30 天假设，清理未实现 |
| OPEN-008 | 邮箱验证是否首版必选 | 未决 |
| OPEN-009 | 浏览器 QA 脚本固化 | 未决，依赖 playwright-cli 手工流程 |
| OPEN-010 | 共享契约包接入方式 | 未决，前端使用本地类型 |
| OPEN-011 | 仓库名与产品名关系 | 未决 |

结论：以上任一项未决或未实现时，不得进入生产上线。
