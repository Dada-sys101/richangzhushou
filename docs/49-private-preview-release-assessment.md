# 私有预览发布评估

评估更新：2026-09-11（`Asia/Shanghai`）

> 2026-09-12 MOBILE-C2 应用内弹窗发布：PR #32 HEAD `3a07d28` 已通过两组 CI，并在受保护备份 `daily_assistant_preview_20260912T060714Z.sql.gz` 后部署至 `/opt/daily-assistant-preview/releases/3a07d280-20260912T0608Z`。用户端、账单深链接、API 健康、Manifest、Service Worker、管理端、新构建资源和启动后 warning/error 日志复核通过；旧 release `9a991200-20260912T0415Z` 保留回滚，物理设备弹窗验收待完成。

> 2026-09-11 MOBILE-B 实机反馈修复：普通浏览器仍停留旧缓存、退出后重新登录仍回“我的”。提交 `5152fb8` 增加页面恢复前台时的版本检查，提交 `414bb5e` 让退出登录携带首页返回目标，`aebc257` 补充真实重登录浏览器验收。两组 CI 最终全绿；其中一次既有桌面导航用例波动后重跑通过。发布前备份为 `/opt/daily-assistant-preview/shared/backups/daily_assistant_preview_20260911T094516Z.sql.gz`，当前 release 为 `/opt/daily-assistant-preview/releases/aebc2570-20260911T0946Z`，旧 release `4d86f900-20260911T0846Z` 保留为回滚点。公开入口、API 健康、Manifest、Service Worker 和启动后日志复检通过。

> 2026-09-11 MOBILE-B PWA 生命周期发布：提交 `4d86f90` 已推送至 PR #30，两组 CI runs `34580364107`、`34580381945` 的 quality、db-validation、browser-qa 全绿。发布前备份为 `/opt/daily-assistant-preview/shared/backups/daily_assistant_preview_20260911T084533Z.sql.gz`，当前 release 为 `/opt/daily-assistant-preview/releases/4d86f900-20260911T0846Z`，旧 release `fa0ee530-20260911T0738Z` 保留为回滚点。用户端、API 健康、四个 PWA 图标、Manifest、Service Worker 更新处理和近期日志检查通过；iPhone/Android 安装版生命周期验收仍待实机执行，PR 尚未合并。

> 2026-09-11 MOBILE-A 未登录缓存隔离发布：刷新令牌返回 HTTP 401 时，客户端曾误进入离线模式并恢复上一账号的 IndexedDB 数据，造成界面显示未登录但仍可见旧数据。提交 `fa0ee53` 将离线恢复限定为真实网络故障；认证失败直接关闭会话，显式退出会等待用户缓存清除并删除最后用户标记。两组 CI 的 quality、db-validation、browser-qa 全绿，其中浏览器用例覆盖退出、访问受保护页面、刷新后仍停留登录页且无应用导航。发布前备份为 `/opt/daily-assistant-preview/shared/backups/daily_assistant_preview_20260911T073720Z.sql.gz`，当前 release 为 `/opt/daily-assistant-preview/releases/fa0ee530-20260911T0738Z`，旧 release `77718a00-20260911T0713Z` 保留为回滚点。

> 2026-09-11 MOBILE-A 认证修复发布：线上认证请求因 API 数据库连接池启动异常返回 500，重启后即时恢复。提交 `77718a0` 增加 Prisma 启动连接和数据库就绪检查，避免进程存活掩盖数据库故障；API 与 PWA 的可见英文/未知错误统一转换为中文，同时保留已有中文业务细节。两组 CI 全绿后部署至 `/opt/daily-assistant-preview/releases/77718a00-20260911T0713Z`；发布前备份、目标顺序构建、公开数据库健康检查、中文登录错误响应和日志检查通过。旧 release `7103ad10-20260911T0634Z` 保留为回滚点。

## 当前结论

- R1 Quality Gate：`APPROVED / DONE`。
- H1/H2：`WAIVED_FOR_R1 / UNVERIFIED`，不能记为物理 iPhone 通过。
- REL-02 独立 Staging：`CANCELLED / SEPARATE_STAGING_WAIVED`。
- 验证环境：现有 Alibaba 私有预览。
- 当前任务：`MOBILE-B PWA Lifecycle and Installation Experience / VERIFYING`；PR #30 已部署，实机验收待完成。
- 公网 DNS/HTTPS/CORS、Provider 扩展、REL-04 和生产发布仍是独立门禁。

## 当前发布版本

- Integration commit：`6515b8fd0f13969a0e434d3d8223f60a82cb0310`。
- 来源：PR #25，状态 `MERGED`。
- 合并后 CI：run `34181985716`，`quality`、`db-validation`、`browser-qa` 全部通过。
- 服务器 release：`/opt/daily-assistant-preview/releases/aebc2570-20260911T0946Z`（MOBILE-B PR #30 commit `aebc257`；PR 尚未合并）。
- API、用户端和管理端入口均返回 HTTP 200；切换后的 warning/error 日志为空。
- 本次没有执行 migration、修改 MySQL/Nginx、扩展域名或改变 Provider 开关。

## 供应链与构建证据

- Prisma、Client、MariaDB Adapter 保持 `7.9.1`。
- 精确 override：`deepmerge-ts@8.0.2`、`mariadb@3.4.7`、`mysql2@3.24.3`。
- npm 固定为 `11.18.0`；目标 Linux 安装、构建、audit 0、1043-component SBOM 和依赖版本检查通过。
- 本地 MySQL 8.4.11 集成为 18 files / 160 tests 通过；真实数据库 Chromium desktop/mobile smoke 为 44/44 通过。
- 当前范围许可证处理已获用户接受：保留第三方许可证和版权声明，不修改第三方源码；对外分发后端包/容器或修改第三方库时重新评审。
- 详细依赖调查见 `docs/44-r1-dependency-audit-review.md`。

## 部署后业务验证

使用一次性 `qa_release_*` 账号在 390 × 844 Chromium 环境验证：

- 登录与首次强制改密通过。
- 待办创建通过。
- 日程创建通过。
- 账单创建通过。
- 刷新后的数据持久化通过。
- 浏览器阻塞错误为 0。
- 测试账号及级联业务数据已定向清理，结果为 `deleted=1 / remaining=0`。
- 清理后 API 保持 active，health 返回 200，warning/error 日志为空。

临时凭据、本地/远程凭据文件、远程辅助脚本和 SSH 隧道均已清理。

## 备份与恢复

- 每日数据库备份 timer 正常，保留 7 天并自动清理过期文件。
- 已完成受保护备份和临时隔离数据库恢复校验。
- 当前规模下不要求新增跨位置备份；公网开放、扩容或重要真实数据场景需要重新评估。

## Readiness 现状

- `/api/v1/health` 执行数据库查询并提供不泄露敏感细节的 readiness。
- 认证后的 `/api/v1/admin/health` 会执行数据库检查。
- 服务启动流程包含数据库 precheck，部署后真实业务 smoke 已通过。
- Prisma 启动阶段主动连接数据库；公开 readiness、服务状态和业务登录探针已在本次发布后通过。

## 已接受的范围简化

用户明确决定不建设独立 Staging。现有 Alibaba 私有预览同时承担当前小规模受邀用户场景的验证环境，因此不新增 ECS、托管 MySQL、OSS、域名或监控资源，也不产生相应费用。

此决定适用于当前约 10 名受邀用户的私有预览范围。出现以下任一条件时重新评估独立 Staging：

- 开放公网访问；
- 用户规模明显扩大；
- 承载重要真实数据；
- 需要验证托管 MySQL 私网/TLS、跨位置恢复或复杂网络故障；
- 准备正式生产发布。

## 未完成事项

1. REL-03 轻量 readiness 实现、测试和现有环境验证。
2. 固化备份、不可变部署、liveness/readiness、业务 smoke 和应用回滚流程。
3. REL-03 完成后重新界定精简后的 REL-04。
4. 公网开放时再处理 DNS、HTTPS、精确 CORS 和公网 smoke。
5. 物理 iPhone Safari/PWA 仍未验证；公网或支持声明前重新评估。

## 发布边界

- 当前私有预览可以继续运行和供受邀用户使用。
- R1 已通过，不表示生产发布、公开注册或公网 Provider 扩展获批。
- live AI 仅按用户既有决定在当前私有预览保留；扩大适用范围需要独立决定。
- 后续新功能应另开分支/PR，不回写已经合并的 PR #25。
