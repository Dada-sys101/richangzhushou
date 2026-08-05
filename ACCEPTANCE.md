# Acceptance

## WP0 规划完成标准

- V1.0 功能范围和明确排除项一致。
- 注册容量、邀请码、账号状态、记账、同步和风险确认规则可测试。
- 页面、权限、数据实体和 API 可以相互追踪。
- 技术架构与 10–20 人早期规模相称。
- 工作包可以直接交给 Codex 顺序执行。
- 未决事项明确标记是否阻塞开发。

## WP1 工程骨架完成标准

- npm workspaces 包含 `apps/web`、`apps/admin`、`apps/api`、`packages/api-contracts` 和 `packages/config`。
- 用户端采用 Vue 3 + TypeScript + Vite + PWA，管理端采用 Vue 3 + TypeScript + Vite + Element Plus，后端保持 NestJS 单体。
- Prisma 使用 MySQL provider；共享枚举与数据字典、TypeScript 和 OpenAPI 3.1 一致。
- OpenAPI 覆盖 `docs/06-api-and-integrations.md` 的全部规划端点，同时明确这些业务端点在 WP1 尚未实现。
- 格式、Lint、类型、单元/契约测试、全部 workspace 构建、Prisma validate、OpenAPI lint、离线 migration diff、依赖审计和 `git diff --check` 通过。
- 用户端和管理端在 375/390/430/768/1440 无布局阻断或控制台错误；PWA 离线刷新、404 与浏览器 Back 通过。
- 本机如无 MySQL/Docker，必须如实记录真实空库 `migrate deploy` 未执行，并保留可运行命令和 CI MySQL 验证路径。
- 未实现 WP2 及以后业务，未写入真实凭据，未创建生产资源、部署、推送或 PR。

实际结果见 `docs/13-wp1-acceptance-report.md`。

## V1.0 总体验收方向

- 受邀用户可在容量范围内完成注册并严格隔离数据。
- iPhone 和电脑网页可完成记账、日程、待办、提醒和行程主流程。
- 快捷指令可以安全、幂等地提交记账草稿并由用户确认。
- 离线新增不会丢失，恢复网络后可以同步或进入冲突确认。
- 管理员可管理容量、注册开关、邀请码和账号状态，但默认不能读取用户生活数据正文。
- 备份、恢复、回滚和注销删除路径可执行。
