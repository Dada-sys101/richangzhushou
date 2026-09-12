# MOBILE-C2 — 应用内弹窗与反馈

## Metadata

- Contract: `MOBILE_C2_APP_DIALOGS_V1`
- Status: `VERIFYING / PR_32_OPEN / CI_PASS / PRIVATE_PREVIEW_DEPLOYMENT_AUTHORIZATION_PENDING`
- Branch: `codex/mobile-c2-app-dialogs`
- Base: Integration `7ce7805f04ac6366b5047dc0fde365f433e4be3c`
- Predecessor: MOBILE-C1 `DONE_INTEGRATION / CI_PASS`

## Objective

建立可访问、适配移动端安全区的应用内弹窗与反馈组件，替换用户端现存业务 `window.confirm`，使危险操作和未保存内容提示使用一致的中文交互。

## Allowed scope

- 新增 `AppDialog`、`ConfirmDialog`、`ActionSheet`、`ToastMessage` 与确认服务、宿主和测试。
- 在 `App.vue` 挂载全局确认宿主。
- 替换 `CalendarView`、`TasksView`、`RemindersView`、`PlannerDetailView`、`ProposalReviewView` 和 `useUnsavedChanges` 中的原生确认调用。
- 增加弹窗、操作表、Toast 所需样式及任务状态文档。

## Forbidden scope

- 不修改路由与 Navigation Policy、API、数据库、业务 store、同步算法、Service Worker、Push 或日期时间控件。
- 不重做页面布局，不改变删除、恢复、Proposal 或导航保护的业务语义。
- 不用自定义弹窗替代浏览器关闭标签页时由平台强制提供的 `beforeunload` 安全提示。

## Interaction rules

1. 弹窗提供 `role=dialog`、`aria-modal` 和可解析标题。
2. 打开后焦点进入弹窗，Tab/Shift+Tab 留在弹窗内，关闭后恢复触发元素焦点。
3. Escape 等同取消；确认与取消按钮最小触控高度 48px。
4. 弹窗打开时锁定背景滚动，并避开 iPhone 底部安全区。
5. 危险操作使用中文标题、说明和明确动词，默认焦点落在取消按钮。
6. 确认请求返回 Promise；同一时间只显示一个，新请求安全取消旧请求，避免重复执行业务动作。

## Acceptance gates

- 用户端源码不再存在业务 `window.confirm`；`beforeunload` 平台提示保留。
- 日程、待办、提醒、计划详情、Proposal 拒绝和未保存内容离开均使用应用内确认。
- 375、390、430、768、1440 CSS px 检查弹窗尺寸、按钮、长文案和安全区。
- 键盘焦点、Escape、取消、确认、焦点恢复和滚动锁定测试通过。
- 完整 `npm run quality` 与 `git diff --check` 通过。
