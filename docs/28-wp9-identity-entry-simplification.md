# 28 WP9 身份与录入简化 —— 本地验收报告

文档版本：1.0<br>
状态：已完成本地验收（未推送、未部署、未创建生产资源）<br>
更新：2026-08-06<br>
适用版本：V1.0

> 后续状态（2026-08-06）：本报告完成时 WP9 与首页优化尚未推送；其后二者已提交
> （`71b9f74`、`68f3987`）并随 `codex/wp8-release-prep`/`main` 推送，GitHub
> 默认分支已切换为 `main`。OPEN-007 账户期满删除清理已实现（见 `docs/27` 与
> OPEN-007 变更记录），并于 2026-08-07 通过 PR #1 合并到 main（`6d9c888`）。
> 本报告正文保留当时的验收事实，不修改历史。

## 1. 任务与授权范围

用户确认的范围调整：邮箱彻底移除；账号密码登录（账号需在管理端手动创建）；
首次登录强制改密，忘记密码统一由管理员重置；邀请码下线；截图 OCR 下线；
一次性完成代码、契约、测试、文档与状态同步。仅本机实现与验收，未推送、
未部署、未创建云资源、未开始 OPEN-007 删除清理。

## 2. 实现内容

- 账号模型：`users` 新增 `username`/`normalized_username`（唯一）与
  `must_change_password`；删除 `email`/`normalized_email`；删除
  `recovery_codes`/`invite_codes`/`invite_redemptions` 表；
  `system_settings` 仅保留 `max_active_users`；WP9 migration
  `20260806140000_wp9_identity_entry_simplification` 含存量邮箱回填用户名
  与冲突序号处理。
- 认证：`POST /auth/login` 改为 `username + password`；删除注册、忘记密码、
  重置密码、自助重开端点；新增 `POST /me/change-password`；登录响应携带
  `mustChangePassword`，未改密时数据端点返回 `PASSWORD_CHANGE_REQUIRED`（403）。
- 管理端：新增 `POST /admin/users`（容量校验、初始密码、首次登录强制改密、
  `USER_CREATE` 审计）与 `POST /admin/users/:id/reset-password`
  （`USER_PASSWORD_RESET` 审计、撤销会话）；`/admin/settings` 仅管理容量；
  删除邀请码与注册设置端点。
- 录入：删除 `/drafts/ocr`、OCR/Scan 适配器与 `AttachmentScanStatus`；
  附件保留上传意图/内容上传/完成/删除与本地存储，不再识别。
- 前端：用户端登录改“账号”，新增修改密码页，删除注册/忘记密码/重置密码页
  与快捷记录截图入口；管理端新增创建账号与重置密码，删除邀请码页。
- 契约：OpenAPI/共享类型/枚举与错误码同步；`npm run quality` 全量通过。

## 3. 验证结果

| 项目 | 结果 |
| --- | --- |
| `npm run quality` | PASS（格式、Lint、类型、全部测试、构建、Prisma validate、OpenAPI lint、migration diff、审计 0 漏洞） |
| 空库迁移 | PASS（全新本地库 7 migrations + seed，MySQL 8.4.9） |
| 单元 + 集成测试 | PASS（API 92/92，含管理员建号容量并发、强制改密、重置密码、数据隔离；契约 125/125） |
| 容量与账号 | PASS（19 占用时可建第 20 个；满员 409；并发争抢仅一个成功；关闭释放/暂停占用/重开重查；重复用户名 409） |
| 强制改密 | PASS（管理员建号/重置后登录 `mustChangePassword=true`；数据端点 403；改密后恢复；旧密码失效） |
| 数据隔离 | PASS（demo 与 alice 各自只能看到自己的账单） |
| 浏览器 | PASS（用户端账号登录、强制改密跳转与完成、首页数据加载、控制台 0 错误；管理端登录、创建用户 carol 成功、控制台 0 错误） |
| 重启持久化 | PASS（API 重启后 demo/alice 账单仍存在） |

## 4. 修改文件

- 契约：`packages/api-contracts/src/{enums,types}.ts`、`openapi/openapi.yaml`、测试。
- 数据库：`apps/api/prisma/schema.prisma`、`migrations/20260806140000_*`、`seed.ts`。
- 后端：`apps/api/src/{auth,admin,account,capacity,attachments,drafts,integrations,audit,users,sync,shortcuts,cli,common}`。
- 前端：`apps/web/src/{api,stores,router.ts,views}`、`apps/admin/src/{api,router.ts,App.vue,stores,views}`。
- 文档：README、docs/05/06/07/09/10/11/12、docs/decisions.md、docs/26/27 注记、
  本报告、进度/变更日志与状态文件。

## 5. 未验证/待确认

- 远程 CI、staging/生产部署仍未执行（未授权）。
- 真实对象存储、Web Push/系统通知、账号删除期满批量清理仍未实现（OPEN-005/006/007）。
- 多实例提醒调度器租约、语音/文件导入仍为后续版本（未实现）。
