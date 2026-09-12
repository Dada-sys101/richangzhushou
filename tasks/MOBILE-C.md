# MOBILE-C — 二级页面与应用内交互组件统一

## Metadata

- Contract: `MOBILE_C_SECONDARY_UI_V1`
- Status: `MOBILE_C1_SECOND_FEEDBACK_FIX_DEPLOYED / PR_31_OPEN / CI_PASS / DEVICE_RECHECK_PENDING`
- Branch: `codex/mobile-c1-secondary-shell`
- Base: Integration `5d6c5c51a452ce1c5e425dba32053e017ded77e2`
- Predecessor: MOBILE-B `DONE_INTEGRATION / ACCEPTED_WITH_DEFERRED_LIMITATIONS`
- Delivery model: 每个阶段独立提交、独立 PR 验证；不得形成一次性全站重写。

## Objective

在不改变路由、业务规则、API、数据模型和同步机制的前提下，将现有二级页面从第一版样式统一为接近 iPhone/Android 应用的页面壳、表单、详情、确认弹窗和日期时间选择体验。

## UX baseline

1. 二级页面统一使用紧凑顶部栏：返回、单行标题、可选右侧操作；返回继续调用现有 Navigation Policy。
2. 页面正文按“摘要、主要内容、补充信息、危险操作”分区；减少同屏重复标题、边框、按钮和说明文字。
3. 表单采用统一字段行、错误位置、必填标记和底部主操作区；移动端主操作可吸底，但必须避开安全区和键盘。
4. 详情页先展示核心信息和状态，再展示编辑/删除等操作；危险操作不与主操作并列突出。
5. 375/390/430 宽度单列；768 及以上允许受控双栏；正文保持统一最大宽度。
6. 所有加载、空状态、错误、确认和成功反馈使用中文应用内组件。

## Phased work

### MOBILE-C1 — Secondary shell and tokens

- 建立 `SecondaryPageShell`、`SectionCard`、`FormActions` 等共享壳组件。
- 收敛间距、圆角、字号、阴影、分隔线、安全区和触控尺寸变量。
- 先迁移 `AccountsView`、`CategoriesView`、`BudgetsView`、`SyncConflictsView`、`ChangePasswordView` 验证基础模式。
- Allowed files: the three shared shell components and their tests, the five named views, `apps/web/src/styles.css`, and required task/state documentation.
- Excluded: other views, router/navigation policy, stores, API, database, Service Worker, dialogs and date/time control replacement.
- 实机反馈修复：移动端二级页标题取消错误的粘性偏移；预算内容改为纵向布局；窄屏表单、资源行和操作按钮允许安全换行，避免内容遮挡和按钮重叠。
- 第二轮实机反馈：账单筛选区在窄屏改为两列字段加独立复选行，操作按钮等宽排列；公共返回操作扩大触控区并增加与标题的间距。

### MOBILE-C2 — App dialogs and feedback

- 建立可访问的 `AppDialog`、`ConfirmDialog`、`ActionSheet`、`Toast`。
- 替换当前 `window.confirm` 使用点：日程、计划详情、提案、待办、提醒。
- 支持焦点锁定、Escape、遮罩关闭策略、滚动锁定、危险操作二次确认和中文错误反馈。

### MOBILE-C3 — Date and time controls

- 建立 `DateField`、`DateTimeField`、`MonthField` 与底部弹层选择器。
- 统一 Asia/Shanghai 展示、24 小时制、全天事件、开始/结束约束、清空与确认操作。
- 替换现有 date/month/datetime-local 字段，同时保留键盘、读屏和桌面输入能力。
- 内部值继续使用现有 ISO 8601/本地日期契约，不修改 API 或数据库。

### MOBILE-C4 — Complex secondary pages

- 按风险依次迁移：`TransactionFormView` → `CalendarView`/`TasksView`/`RemindersView` → `PlannerDetailView` → `TripDetailView` → AI 草稿/提案页面。
- 每组迁移单独验证，不借机重写业务 store 或页面数据加载。

## Forbidden scope

- 不新增第二套导航栈，不改路由名、目录结构或 MOBILE-A 返回策略。
- 不修改 AI、同步算法、API、数据库、Service Worker、Push 或认证规则。
- 不引入完整 UI 框架替换现有 Vue 用户端。
- 不一次性迁移所有页面，不以视觉调整为由改写业务逻辑。

## Acceptance gates

- 375、390、430、768、1440 CSS px 检查所有迁移页面。
- iPhone/Android 真机检查安全区、软键盘、滚动、弹层和返回手势。
- 弹窗具备焦点管理、读屏名称、键盘关闭和按钮防重复提交。
- 日期时间覆盖闰日、跨日、全天、开始晚于结束、时区和清空场景。
- Browser Back、应用内返回、深链接 fallback 和未保存表单保护保持通过。
- 无浏览器原生确认框；已迁移页面不直接使用原生 date/month/datetime-local UI。
- 完整 `npm run quality`、`git diff --check` 和受影响页面浏览器验收通过。

## Recommended execution order

MOBILE-B 实机验收与合并 → MOBILE-C1 → MOBILE-C2 → MOBILE-C3 → MOBILE-C4。每阶段通过后再进入下一阶段。
