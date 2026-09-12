# MOBILE-C3 — 自定义日期时间控件

## Metadata

- Contract: `MOBILE_C3_DATE_TIME_CONTROLS_V1`
- Status: `VERIFYING / DONE_PUSHED / PR_33_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PENDING`
- Branch: `codex/mobile-c3-date-time-controls`
- Base: Integration `e4b6567e1613f37e689429bd541b0644ab4d9657`
- Predecessor: MOBILE-C2 `DONE_INTEGRATION / CI_PASS / PRIVATE_PREVIEW_DEPLOYED`

## Objective

建立不依赖浏览器原生日期界面的统一日期、月份和日期时间选择组件，在 iPhone、Android 与桌面端提供一致的中文交互，同时保持现有业务值格式、时区和校验语义。

## Allowed scope

- 新增 `DateField`、`DateTimeField`、`MonthField` 及共享选择器逻辑、样式和测试。
- 使用现有 `AppDialog` 承载移动端和桌面端一致的选择界面。
- 分批替换用户端现有 `date`、`month`、`datetime-local` 字段。
- 补充受影响页面测试、浏览器验收与任务状态文档。

## Forbidden scope

- 不修改 API、数据库、业务 store、同步算法、路由、Service Worker、Push、认证或导航策略。
- 不改变日期字段的现有传输格式与业务时区，不借机重做复杂页面布局。
- 不引入完整 UI 框架或第二套弹窗系统。

## Interaction rules

1. 字段使用按钮打开应用内选择器，展示中文日期和 24 小时时间。
2. 日期选择支持上月/下月、今天、闰日以及 min/max 约束；月份选择支持年份切换。
3. 日期时间支持日期、小时和分钟，保留现有本地 `YYYY-MM-DDTHH:mm` 值格式。
4. 可选字段提供清除；确认前不改写业务值，取消恢复原值。
5. 选择器具备读屏名称、键盘操作、Escape、焦点恢复、滚动锁定与安全区。
6. 开始/结束关系继续由页面现有业务校验负责，组件只执行自身 min/max 边界。

## Acceptance gates

- 已迁移页面不直接使用原生 `date`、`month`、`datetime-local` 控件。
- 覆盖空值、今天、闰日、跨日、全天、清除、取消、确认、min/max 和 24 小时制。
- 在 375、390、430、768、1440 CSS px 检查弹层、软键盘、滚动和长标签。
- Browser Back、应用内返回、未保存保护及现有业务序列化保持通过。
- 完整 `npm run quality`、`git diff --check` 与受影响浏览器验收通过。

## Delivery evidence

- PR: #33, HEAD `7ec404d`.
- CI: runs `34680683732` and `34680685271`; quality, db-validation and browser-qa all passed.
- Private preview deployed at `/opt/daily-assistant-preview/releases/b18b91d0-20260912T0735Z`; backup `daily_assistant_preview_20260912T074830Z.sql.gz`; public entry, deep links, API, PWA assets and logs passed.
- Merge remains separately unauthorized; physical-device acceptance is pending.
