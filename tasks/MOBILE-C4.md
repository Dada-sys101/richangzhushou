# MOBILE-C4 — 复杂二级页面统一

## Metadata

- Contract: `MOBILE_C4_COMPLEX_SECONDARY_PAGES_V1`
- Status: `FROZEN / READY / NOT_STARTED`
- Base: Integration `45d52c664fd9232c2fb0dbf5b14f27d277aa1e99`
- Predecessor: MOBILE-C3 `DONE_INTEGRATION / MERGED_CI_PASS / PRIVATE_PREVIEW_DEPLOYED / DEVICE_ACCEPTANCE_PASS`
- Delivery model: 一个 canonical task，四个严格顺序切片；每个切片独立实现、验证和提交，不跨组顺手改造。

## Objective

将仍保留第一版布局的复杂二级页面迁移到 MOBILE-C1 已建立的页面壳、内容分区和操作区，并复用 MOBILE-C2/C3 的应用内弹窗与日期时间控件。改造只调整信息层级、响应式布局和交互呈现，保留既有路由、数据加载、业务校验、序列化和写入行为。

## Design method

- 实施时使用 `auto-ui-design` 技能，先识别每个页面的核心任务、现有字段、操作和状态，再调整结构。
- 视觉方向采用“高频数据工具：精确、紧凑、低干扰”，沿用现有紫色品牌强调色、字体、图标和 C1-C3 token，不新增另一套视觉语言。
- 以对齐、文字层级、适度留白和明确操作优先级组织内容，避免把每个字段机械包装成卡片。
- 必须实际运行页面并完成核心路径和响应式检查；静态检查、构建通过和视觉验收分别记录，未实测的设备不得标记为通过。

## Implementation slices

### C4.1 — Transaction form

- 页面：`apps/web/src/views/TransactionFormView.vue`。
- 目标：统一新建/编辑记账页面的页头、字段分组、错误位置和底部操作；窄屏按钮不得重叠，键盘出现后主要操作仍可访问。
- 配套测试：现有账单页面测试及新增的布局/交互专项测试。
- 退出条件：本切片验证通过并形成独立提交后，才能进入 C4.2。

### C4.2 — Planner lists

- 页面：`CalendarView.vue`、`TasksView.vue`、`RemindersView.vue`。
- 目标：统一列表工具区、编辑区、空状态、项目卡片及完成/删除操作；保留当前日期、筛选、排序、提醒状态和未保存保护。
- 配套测试：`PlannerListsView.test.ts` 及受影响的浏览器流程。
- 退出条件：三个页面共同验证通过并形成独立提交后，才能进入 C4.3。

### C4.3 — Planner and trip details

- 页面：`PlannerDetailView.vue`、`TripDetailView.vue`。
- 目标：按摘要、主要内容、关联信息和危险操作重新分区；减少重复标题和按钮；长列表、空数据及编辑态在窄屏可读可操作。
- 配套测试：`PlannerDetailView.test.ts`、行程详情专项测试及深链接/返回流程。
- 退出条件：两个详情页验证通过并形成独立提交后，才能进入 C4.4。

### C4.4 — AI drafts and proposals

- 页面：`DraftsView.vue`、`ProposalReviewView.vue`、`AiView.vue`。
- 目标：统一草稿列表、提案摘要、字段确认和失败状态；明确“仅生成草稿/建议，确认后才写入”的操作层级。
- 配套测试：`ProposalReviewView.test.ts`、`AiView.test.ts` 及 AI 草稿确认浏览器流程。
- 退出条件：页面、完整门禁和设备验收通过后，MOBILE-C4 才能进入交付决策。

## Allowed scope

- 当前切片明确列出的页面及其直接测试文件。
- `SecondaryPageShell`、`SectionCard`、`FormActions` 的必要兼容性增强及对应测试；增强必须服务于至少两个 C4 页面，单页需求优先留在页面内部。
- `apps/web/src/styles.css` 中仅与当前切片页面或既有共享壳有关的样式。
- 受影响的 Playwright 场景、任务契约、验收与项目状态文档。
- 为可访问性补充语义标签、读屏名称、焦点顺序和状态提示。

## Forbidden scope

- 不修改路由名称、路径、目录结构、Navigation Policy、根 Tab 历史或返回 fallback。
- 不修改 Pinia store、API client、NestJS API、OpenAPI、数据库、migration、同步算法、认证、Service Worker 或 Push。
- 不修改金额、日期、时区、筛选、排序、状态机、AI Proposal 确认和删除恢复等业务语义。
- 不引入新的 UI 框架、导航栈、弹窗系统或日期时间组件。
- 不在同一实现提交中跨越两个切片，不迁移未列出的页面，不借机重构大文件的业务逻辑。
- 不因视觉改造删除现有功能、错误状态、离线状态、审计入口或未保存保护。

## Shared UI rules

1. 二级页使用 `SecondaryPageShell`，只保留一个页面标题；返回继续调用现有 Navigation Policy。
2. 正文使用 `SectionCard` 按摘要、主要内容、补充信息和危险操作分区；避免卡片内再次重复页面标题。
3. 表单主操作进入 `FormActions`；375/390/430 宽度下按钮可纵向排列并避开底部安全区和键盘。
4. 危险操作与保存等主操作分开呈现，继续使用 MOBILE-C2 的中文应用内确认。
5. 日期、月份和日期时间字段继续使用 MOBILE-C3 组件，不恢复浏览器原生时间控件。
6. 加载、空数据、离线、失败和成功反馈使用清晰中文；不得把原始异常或英文内部错误直接展示给用户。
7. 768 px 以下默认单列；仅在内容关系明确且不会产生挤压时使用双列。1440 px 下正文保持受控最大宽度。

## Compatibility gates

- 页面所有既有创建、编辑、完成、删除、恢复、确认和取消流程保持原行为。
- URL、query、route meta、深链接和 `returnTo` 不变；应用内返回、浏览器 Back 和系统边缘返回结果一致。
- 刷新详情、直接打开详情和缺失实体 fallback 保持可预测，不依赖新增历史栈。
- 离线缓存、离线写入、重试、冲突提示和重新登录后的数据隔离行为无回归。
- AI 页面继续只生成 Draft/Proposal；未经确认不得写入正式业务记录。
- 无新增 API、数据库、依赖、环境变量、PWA 生命周期或部署配置变更。

## Test matrix

每个切片均需完成：

- 375、390、430、768、1440 CSS px：首屏、长内容、空状态、错误状态、操作区、滚动与无遮挡检查。
- Chromium 桌面与移动浏览器流程；完整候选至少运行现有 browser-qa 矩阵。
- iPhone/Android 私有预览：安全区、软键盘、内部滚动、弹窗、返回手势和重复提交检查。
- 应用内返回、Browser Back、直接深链接、刷新、无历史 fallback、未保存离开保护。
- 当前切片对应的单元/组件测试、`npm run quality`、`git diff --check`。

## Hard acceptance gates

1. 迁移页面无内容遮挡、按钮重叠、横向溢出或不可达操作。
2. 页面只出现一套标题和返回入口；返回触控尺寸、间距与安全区符合现有移动端基线。
3. 页面数据、校验、提交 payload 和错误处理与改造前兼容。
4. 所有用户可见异常、空状态、确认和结果提示为中文应用内呈现。
5. 原生确认框及原生 `date`、`month`、`datetime-local` 不得重新出现。
6. 当前切片的五档视口与关键浏览器流程有明确通过证据；最终候选完成 iPhone/Android 实机验收。
7. 完整 `npm run quality`、`git diff --check` 和 CI 的 quality、db-validation、browser-qa 全部通过。
8. 不存在第二套导航栈、业务逻辑重写或禁止范围变更。

## Rollback and delivery

- 每个切片形成可单独回退的提交；发生业务回归时回退当前切片，不连带撤销已验收的 C1-C3 组件。
- 完整候选通过本地门禁后，提交、推送、PR、私有预览部署、合并分别遵守独立授权边界。
- 私有预览部署前创建受保护数据库备份；本任务无 migration，若发现 migration 变化必须停止并重新核对范围。

## Codex execution prompt

> 执行 `MOBILE-C4`，以 `tasks/MOBILE-C4.md` 为唯一任务契约，从 Integration `45d52c664fd9232c2fb0dbf5b14f27d277aa1e99` 建立独立 `codex/mobile-c4-complex-secondary-pages` 分支。一次只执行当前顺序切片：C4.1 TransactionFormView → C4.2 Calendar/Tasks/Reminders → C4.3 PlannerDetail/TripDetail → C4.4 Drafts/ProposalReview/AiView。修改前核对页面现有行为和测试；只调整布局、信息层级、响应式样式、可访问性及应用内反馈，复用 C1-C3 组件。不得修改路由、Navigation Policy、store、API、数据库、同步、认证、SW、Push 或业务语义。每个切片独立验证并提交，运行对应专项测试、五档视口检查、返回/深链接/未保存/离线场景、`npm run quality` 和 `git diff --check`。未经对应授权不得推送、创建 PR、部署或合并。
