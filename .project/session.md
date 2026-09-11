# Current Development Session

## Session Status

VERIFYING / MOBILE_A / DONE_PUSHED / PR_29_OPEN / CI_RECHECK_PENDING / DEVICE_ACCEPTANCE_PENDING

## Task

- ID: `MOBILE-A PWA Navigation and Mobile Shell`
- Execution: `VERIFYING`
- Delivery: `DONE_PUSHED / PR_29_OPEN / CI_RECHECK_PENDING / DEVICE_ACCEPTANCE_PENDING`
- Worktree: `D:\daily-assistant`
- Branch: `codex/mobile-a-navigation-shell`
- Base HEAD: Integration `be9d89927aa39abe867e1df5594588bafda3b8cc`
- Scope: 浏览器历史统一导航策略、根 Tab replace、直接父级 returnTo、深链接业务 fallback、应用内返回一致性。
- Excluded: AI、同步算法、API、数据库、Service Worker、Push、视觉重做和发布。

## Current Progress

- `navigation-policy.ts` 成为根 Tab、普通页面、详情页和流程页的统一决策入口。
- 首页/记录/计划/我的连续互切不累计历史；详情返回列表与直接打开详情后的应用内返回、浏览器返回均有确定结果。
- `returnTo` 仅保留直接父级并拒绝外部地址；未保存表单守卫继续生效。
- lint、typecheck、Web 121 项单元测试及导航 E2E 五档宽度与 WebKit mobile 已通过。
- PR #29 首轮 browser-qa 发现 Browser Back 回到 AI 页面时被错误附加 `returnTo`；修复后定向 2/2 与完整浏览器 smoke 52/52 通过，等待远端 CI 复跑。

- 新增 `PushSubscription`/`PushDelivery` migration；订阅敏感字段使用 AES-256-GCM，索引仅存 endpoint SHA-256。
- 新增用户隔离的 Push status/save/delete API、OpenAPI 契约、PWA Service Worker 与提醒页开关。
- Web Push 适配器记录幂等发送状态，404/410 标记失效，临时错误交给现有提醒调度器重试。
- 无订阅、浏览器不支持或功能关闭时继续应用内提醒；两个功能开关默认关闭。
- lint、类型、全仓测试、构建、Prisma 校验/migration diff、OpenAPI 均通过；`npm audit` 为 0。
- 候选复核修复了 Service Worker 反斜杠跨源深链风险，并为逐设备 delivery 增加原子领取与超时恢复，防止重复执行并发发送。

## Remaining Work

1. 在真实 iPhone 已安装 PWA 上验证边缘返回，在 Android 已安装 PWA 上验证系统返回。
2. 若设备验收通过并需要交付，再单独授权提交、推送与 PR。

## Previous Task Record

1. 审阅并在独立授权后合并 PR #27；随后将 PR #28 基线切回 Integration，再经独立授权合并。
2. 启用前使用测试 VAPID 配置完成真实 Push Service、系统通知与手机/PWA 送达证据。

## Verification Status

- API/Web lint and typecheck: `PASS`.
- Unit/full repository tests: `PASS`；临时 MySQL 8.4.9 数据库集成为 `18 files / 161 tests PASS`。
- Build, Prisma validate/migration diff, OpenAPI: `PASS`.
- Dependency audit: `PASS / 0 vulnerabilities` after current safe patch updates.
- Locked install: `PASS` using project-required npm `11.18.0` via one-shot npx; host-global npm remains `11.13.0` and direct `npm ci` correctly failed the engine gate.
- Governance/SBOM/license: `PASS`（30/30；SBOM 1055 components；1174 packages inventoried）.
- Temporary MySQL validation: `PASS`（13 migrations、schema zero-diff、18 files / 161 tests，含订阅加密与跨用户隔离）。
- Chromium controlled Push API validation: `PASS`（订阅、刷新恢复、退订、权限拒绝及 375/390/430/768/1440 五档宽度）。
- Real Push Service/system notification/physical-device delivery: `NOT_RUN`；功能保持关闭。
- Final full `npm run quality`: `PASS` after all security and isolation fixes.

## Resume Instructions

1. 读取 `AGENTS.md`、`PLANS.md`、`.project/v15-execution-state.md` 并核验分支和工作树。
2. 本地候选可进入提交与 CI；不在缺少真实送达证据时启用 Push。
3. 保持应用内提醒降级、用户隔离和字段加密，不引入额外通知基础设施。
4. 未获对应授权不得提交、推送、部署或修改服务器开关。

## Last Updated

2026-09-11 11:40 +08:00 — MOBILE-A 已推送并创建 PR #29；首轮 browser-qa 回归已修复并完成本地全量复验，等待远端 CI 重跑与实机验收。
