# UI 当前状态全量审计（UIR-00）

版本：1.0
状态：`AUDIT_COMPLETE / DOCUMENTATION_ONLY / IMPLEMENTATION_NOT_STARTED`
审计日期：2026-09-15
审计基线：本地 `codex/mobile-c3-date-time-controls@5a0dc529fd9d34a9a2c70788a6d0e87a7745ce2b`

> 本报告来自实际路由、Vue 页面/组件、CSS、单元测试、Playwright 测试及实时 GitHub/CI 证据。它不批准 UI 实现、API、数据库、Provider、定位权限或部署。

## 1. 实时基线与状态冲突

| 事实 | 核验结果 | 证据/限制 |
|---|---|---|
| 当前 checkout | `codex/mobile-c3-date-time-controls@5a0dc529fd9d34a9a2c70788a6d0e87a7745ce2b` | 本地 HEAD 是 PR #33 merge commit；分支相对 origin 同名分支 ahead 1 |
| 远端 Integration | `77bedde231b11342e7bbec40234fc1ee5bcb6860` | `git ls-remote`，2026-09-15；未 fetch、未改远端 |
| PR #33 | `MERGED`，merge commit `5a0dc529...`，mergedAt `2026-09-12T08:20:31Z` | GitHub PR API |
| Integration 包含 PR #33 | 是 | GitHub compare：Integration 相对 `5a0dc529...` ahead 23、behind 0 |
| PR/merge CI | PASS | PR 两组 checks 全绿；merge commit CI run `34683019629` 的 quality、db-validation、browser-qa 全绿 |
| 最新 Integration CI | PASS | `77bedde...` run `34824580264` 成功；只证明该 CI 覆盖范围，不等于本轮浏览器验收 |
| MOBILE-C3 实现 | 用户端不存在原生 `date`、`month`、`datetime-local` 字段；共享日期/月份/日期时间组件和测试存在 | `TemporalPickerField` 的小时/分钟实际仍是 `type="text"` + `inputmode="numeric"`，E2E 通过 `.fill()` 操作；与已确认的紧凑滚轮/不要求手输目标不一致，必须在 UIR-03 修正并回归既有值格式 |
| 设备证据 | 仓库/任务记录为用户确认 iPhone/Android 通过 | 未发现本轮新增截图、设备日志或可复核浏览器 artifact |
| 工作区 | 进入本任务时已有 `docs/README.md`、`docs/changelog.md` 修改和 3 个未跟踪 UI 规划文件 | 全部保留并在其上增量工作 |

Canonical 状态已在本阶段按实时 GitHub/CI 证据归一：PR #33 为 `MERGED / DONE_INTEGRATION / CI_PASS`，远端 Integration 快照为 `77bedde...`。`tasks/MOBILE-C3.md` 作为当时执行契约保留旧门禁文字，不作为实时状态总账。UIR-02 仍须等待本轮规划/状态提交进入 Integration，或取得用户对精确本地提交 SHA 的独立授权，并在开始前重新核验新鲜基线、使用独立分支。

## 2. 审计口径

- 页面类型：根页面、列表、详情、编辑、复杂详情、设置；登录、404 等标为流程页。
- 控件列为实际模板中的原生元素数量：`I/S/T/B = input/select/textarea/button`；隐藏 username 也计入 input。
- 状态缩写：`L` 加载/提交中、`E0` 空、`ER` 错误、`O` 离线、`C` 冲突、`P` 无权限。仅代码中有明确分支才记录。
- 返回：`PH` 使用 PageHeader/SecondaryPageShell 的应用内返回；`UB` 使用未保存保护；`—` 未发现页面级实现。Router 统一保留 scroll、直接深链 fallback、`returnTo` 清洗和 Browser Back 识别。
- 测试：只记录实际存在的 view/component unit 或直接覆盖该路由/流程的 Playwright；“间接”不等于完整页面单测。

## 3. 用户端路由—页面—组件矩阵

| 路由 / 页面 | 层级/类型；核心任务 | 公共组件；I/S/T/B | 弹窗/反馈；时间控件 | 状态；返回 | 当前测试 | 建议包 |
|---|---|---|---|---|---|---|
| `/` Home | 根；今日概览、快速记录入口 | AppIcon、AssistantMark、EmptyState、PageHeader；0/0/0/0 | 页面错误/离线提示 | L/E0/ER/O；根 Tab | Home unit；home E2E | UIR-06 |
| `/login` Login | 流程；登录 | 无；2/0/0/1 | 内联错误 | L/ER；登录重定向 | Login unit；auth E2E | UIR-10 |
| `/account` Account | 根/设置；账户、PWA、退出、关闭账号、申请删除 | AppIcon、AssistantMark、PageHeader；1/0/1/5 | 同页选择高风险 action，再输入密码/原因确认提交；内联错误 | L/ER；UB | deletion/auth E2E，缺 view unit | UIR-10 |
| `/change-password` ChangePassword | 二级/编辑；修改或强制修改密码 | SecondaryPageShell、SectionCard、FormActions；4/0/0/1 | 内联 alert/status | L/ER；PH+UB，成功 `replace` | admin/auth E2E 间接；缺 view unit | **UIR-02 样板** |
| `/records` Records | 根/列表；记录聚合与入口 | AssistantMark、EmptyState、PageHeader；0/0/0/2 | 空状态 | L/E0；根 Tab | navigation/home E2E 间接 | UIR-06 |
| `/transactions` Transactions | 二级/列表；日期与类型筛选、CSV、删除恢复 | DateField、PageHeader；1/1/0/3 | 应用确认；内联错误 | E0/ER；PH | deletion/navigation E2E 间接 | UIR-07 |
| `/transactions/new`、`/:id/edit` TransactionForm | 二级/编辑；新增/编辑账单 | DateTimeField、PageHeader；3/5/1/1 | 内联错误 | L/ER；PH+UB | capture/deletion E2E 间接，缺 view unit | UIR-07 |
| `/capture` QuickCapture | 二级/编辑；自然语言快速新增草稿 | PageHeader；0/0/1/1 | 内联错误 | ER；PH+UB | capture-draft E2E | UIR-06/07 |
| `/plan` Plan | 根/复杂详情；日期、范围、时间线、完成待办/取消日程 | EmptyState、PageHeader；0/0/0/5 | 写操作失败显示内联错误 | E0/ER；根 Tab | Plan unit；navigation E2E | UIR-06 |
| `/ai` Ai | 二级/编辑/列表；提交请求、查看 Proposal | PageHeader；0/1/1/1 | 内联错误；尚非持久化多轮聊天 | L/ER；PH+UB | AiView unit；ai-proposal E2E | UIR-09 |
| `/ai/proposals/:proposalId` ProposalReview | 二级/复杂详情；逐项编辑、拒绝、确认 | AiOperationCard、PageHeader；本页 0/0/0/3，卡片 2/4/1/4 | AppDialog/确认服务；Proposal 状态反馈 | L/ER/C；PH | ProposalReview unit；ai-proposal E2E | UIR-09 |
| `/drafts` Drafts | 二级/列表+编辑；草稿筛选、解析、确认 | DraftReviewCard、PageHeader；3/1/0/3（卡片另含 2/3/1/3） | 内联反馈 | L/E0/ER；PH | capture-draft E2E；缺 view unit | UIR-07 |
| `/shortcuts` Shortcuts | 二级/设置；设备凭证生成、撤销 | PageHeader；2/0/0/3 | 内联错误 | L/E0/ER/P；PH | 无直接 unit/E2E | UIR-10 |
| `/calendar` Calendar | 二级/列表+编辑；日程 CRUD | DateField、DateTimeField、PageHeader；5/1/0/6 | AppDialog/确认；内联反馈 | L/E0/ER；PH+UB | PlannerLists unit | UIR-08 |
| `/calendar/:id` PlannerDetail | 二级/详情+编辑；日程详情/编辑/删除恢复 | DateField、DateTimeField、PageHeader；与 task/reminder 分支合计 8/2/0/9 | AppDialog/确认 | L/ER；PH+UB | PlannerDetail unit；navigation E2E | UIR-08 |
| `/tasks` Tasks | 二级/列表+编辑；待办 CRUD/状态 | DateTimeField、PageHeader；3/3/0/8 | AppDialog/确认 | L/E0/ER；PH+UB | PlannerLists unit | UIR-08 |
| `/tasks/:id` PlannerDetail | 二级/详情+编辑；待办详情/完成/恢复 | 同上共享视图 | AppDialog/确认 | L/ER；PH+UB | PlannerDetail unit | UIR-08 |
| `/reminders` Reminders | 二级/列表+编辑；提醒、重复规则、Push 入口 | DateTimeField、PageHeader；11/3/0/9 | AppDialog/确认 | L/E0/ER/P；PH+UB | PlannerLists unit；web-push E2E | UIR-08 |
| `/reminders/:id` PlannerDetail | 二级/详情+编辑；提醒状态/重复规则 | 同上共享视图 | AppDialog/确认 | L/ER；PH+UB | PlannerDetail unit | UIR-08 |
| `/sync/conflicts` SyncConflicts | 二级/列表；比较并选择冲突版本 | SecondaryPageShell、SectionCard；0/0/0/2 | 内联错误 | E0/ER/C；PH | sync unit 间接；缺 view/E2E | UIR-10 |
| `/trips` Trips | 二级/列表+编辑；行程 CRUD | DateField、PageHeader；4/0/0/3 | 确认服务/内联反馈 | L/E0/ER；PH+UB | 无直接 unit/E2E | UIR-10 |
| `/trips/:id` TripDetail | 二级/复杂详情+编辑；行程、节点、清单 | DateField、DateTimeField、PageHeader；8/2/0/19 | 内联反馈；未发现专用 AppDialog | L/E0/ER；PH+UB | 无直接 unit/E2E | UIR-10（高风险） |
| `/finance/categories` Categories | 二级/列表+编辑；分类 CRUD | SecondaryPageShell、SectionCard；2/1/0/7 | 内联错误 | ER；PH+UB | 无直接 unit/E2E | UIR-07 |
| `/finance/accounts` Accounts | 二级/列表+编辑；资金账户 CRUD | SecondaryPageShell、SectionCard；1/1/0/3 | 内联错误 | ER；PH+UB | 无直接 unit/E2E | UIR-07 |
| `/finance/budgets` Budgets | 二级/列表+编辑；月预算 | MonthField、SecondaryPageShell、SectionCard；2/1/0/2 | 内联错误 | E0/ER；PH+UB | 无直接 unit/E2E | UIR-07 |
| `/:pathMatch` NotFound | 流程/错误；安全回入口 | 无；0/0/0/0 | 404 文案 | ER；链接返回 | 无直接测试 | UIR-10 |

## 4. 管理端矩阵

管理端无 `src/components` 或 `src/styles` 目录，全部基于 Element Plus 和单一 `styles.css`；没有页面单元测试，仅 `app-meta.test.ts` 与 `tests/e2e/admin.spec.ts` 覆盖部分用户管理流程。

| 路由 / 页面 | 类型；核心任务 | 组件/原生控件 | 状态/交互 | 测试 | 建议包 |
|---|---|---|---|---|---|
| `/` Home | 根/流程；引导进入后台 | el-card/result；0 原生 | 静态 | 无直接测试 | UIR-11 |
| `/login` Login | 流程；管理员登录 | el-card/form/input/button | loading、错误 | admin E2E 登录间接 | UIR-11 |
| `/dashboard` Dashboard | 根/复杂详情；容量、健康、统计 | el-row/col/card/alert | 成功/错误；未见明确 loading/空 | 无直接页面测试 | UIR-11 |
| `/users` Users | 列表+编辑；创建、重置、暂停、关闭、恢复、取消删除 | el-form/input/button/table；操作区为卡片，不是抽屉 | loading、错误；原因必填；未见空/权限专页 | admin E2E 覆盖创建、重复、重置；其余不足 | UIR-11（最高风险） |
| `/settings` Settings | 设置；容量上限 | el-card/form/input-number/input/button | loading、错误；原因必填 | 无直接页面测试 | UIR-11 |
| `/audits` Audits | 列表；查看脱敏审计 | el-table | 未见明确 loading/空/错误 | 无直接页面测试 | UIR-11 |
| `/:pathMatch` NotFound | 流程/错误 | el-result | 404 | 无直接测试 | UIR-11 |

当前 `apps/admin/src/App.vue` 是顶部 header + 横向 nav，而已确认目标是左侧导航 + 顶部上下文栏；用户操作详情目前是页内 card，并非右侧 drawer。这是 UIR-11 的明确差距，不能在 UIR-02 顺带修改。

## 5. 公共组件与反馈机制

- 已有并应复用：`PageHeader`、`SecondaryPageShell`、`SectionCard`、`FormActions`、`EmptyState`、`AppDialog`/`AppDialogHost`、`ConfirmDialog`、`ActionSheet`、`ToastMessage`、`DateField`/`MonthField`/`DateTimeField`/`TemporalPickerField`、`BottomNav`、`SiteHeader`、`SyncBadge`。
- `AppDialog` 已覆盖焦点进入/恢复、Tab 约束、Escape 和背景滚动锁；现有单测存在。UIR-04 应补长内容、软键盘、Back、安全区和失败恢复证据。
- `TemporalPickerField` 已替换浏览器原生日期控件，但小时/分钟仍为文本输入；不得把 MOBILE-C3 的“设备验收通过”扩写为滚轮已实现。UIR-03 负责在不改值格式和页面校验的前提下补齐紧凑滚动选择。
- 页面仍大量直接使用原生 input/select/textarea/button；这是后续组件化输入，不是 UIR-02 的批量迁移授权。
- 代码未发现用户端 `window.alert`；危险动作多数经统一确认服务，但 TripDetail 等页面需在迁移时逐动作核对，不能仅凭 import 判断。
- Toast/ActionSheet 已有基础组件，但调用覆盖有限；内联 `.form-error/.form-success` 仍是主要反馈方式。
- 首页代码含离线提示；`SyncBadge` 仍能渲染“已同步”，但已确认首页不得常驻展示，后续需核对它只在合适上下文出现。

### 5.1 写操作当前交互 → 目标交互

下表逐类覆盖实际页面中的正式写操作。目标交互只冻结展示与确认方式，不改变调用的 Store/API、校验、幂等、审计或离线语义。

| 页面/写操作 | 当前交互事实 | 目标交互 | 工作包 |
|---|---|---|---|
| ChangePassword：修改密码 | 三个密码字段、提交中禁用、内联错误；成功清空并 replace 返回；未保存保护 | UiFormField + 统一 action slot；保持全部认证/返回行为 | UIR-02 |
| Transactions：删除/恢复；CSV 为只读导出 | 行按钮经应用确认，结果内联；筛选上下文保留 | ListRow action/ConfirmDialog/Toast；危险后果明确，失败留在行内 | UIR-07 |
| TransactionForm：新增/编辑账单 | 页面表单、提交禁用、内联错误、未保存保护 | 全屏编辑模板 + 固定 action；金额/枚举/日期序列化不变 | UIR-07 |
| QuickCapture：解析并创建草稿 | textarea + 提交；失败保留输入；不直接写正式账单 | 快速记录主操作 + loading/error；结果进入草稿/Proposal 确认 | UIR-06/07 |
| Plan：完成待办、取消日程 | 时间线行按钮直接调用 planner Store；失败写入页面 actionError；无确认弹窗 | 保留快捷行操作和内联失败；取消日程是否增加确认由 UIR-06 基于既有风险语义单独验收，不改变 Store | UIR-06 |
| Drafts/DraftReviewCard：编辑、确认、拒绝草稿 | 列表内嵌编辑、多个原生字段和按钮、内联反馈 | 详情/全屏编辑 + ConfirmDialog；正式写入继续要求确认 | UIR-07 |
| Categories：新增、改名、删除/恢复 | 页内创建与行内编辑，按钮/错误直接呈现 | 列表 + 短 FormDialog/ActionSheet；删除恢复继续确认 | UIR-07 |
| Accounts：新增、删除/恢复 | 页内创建、行按钮、内联错误 | 列表 + 短 FormDialog/ConfirmDialog；已引用账户约束不变 | UIR-07 |
| Budgets：新增、调整、删除 | 月份/分类/金额页内表单和行内金额编辑 | 列表 + 编辑模板；MonthField、定点金额与删除语义不变 | UIR-07 |
| Calendar：新增、编辑、删除/恢复 | 同页创建、AppDialog 编辑、确认服务；全天/起止校验 | 列表 + 全屏编辑/统一 Dialog；日期临时值和关系校验不变 | UIR-08 |
| Tasks：新增、编辑、完成/重开、删除/恢复 | 同页表单、AppDialog、行操作和确认 | 列表/详情/编辑模板；状态转换与离线同步不变 | UIR-08 |
| Reminders：新增、编辑、启停、删除/恢复、Push 订阅 | 复杂同页表单/AppDialog；部分动作受权限/服务状态影响 | 复杂编辑 + ActionSheet/ConfirmDialog；重复规则、权限与 Push 门禁不变 | UIR-08 |
| PlannerDetail：三实体编辑及状态动作 | 按实体条件渲染 AppDialog 表单和 9 个动作 | 详情 + 全屏编辑/ActionSheet；实体分支、Back 和冲突语义不变 | UIR-08 |
| AI/Proposal：生成、编辑操作、拒绝、最终确认 | AiView 提交请求；Proposal 卡片逐项操作和应用确认 | 对话展示 + 明确“待确认”卡；发送成功与正式写入分离 | UIR-09 |
| Trips/TripDetail：行程、节点、清单 CRUD | 列表创建；复杂详情多段内嵌编辑和 19 个按钮 | 复杂详情分段 + 全屏编辑/ActionSheet/ConfirmDialog；嵌套顺序和未保存保护不变 | UIR-10 |
| Shortcuts：创建设备凭证、撤销 | 页面表单/按钮、内联错误；凭证只在必要时展示 | 设置模板 + 确认/一次性敏感展示；可撤销与幂等不变 | UIR-10 |
| SyncConflicts：选择本地或服务端版本 | 两个明确按钮选择版本，冲突正文并列 | 复杂详情 + 固定 action/确认；不自动合并或丢弃版本 | UIR-10 |
| Account：退出登录、关闭账户、申请删除 | 退出登录按钮直接调用 auth；关闭/删除先选择 action，再在同页输入当前密码和原因并“确认并提交”；无确认服务、无取消删除或单会话撤销 UI | 设置模板危险区；保留密码/原因和二阶段明确提交，可评估 ConfirmDialog/FormDialog；清理、容量和审计边界不变 | UIR-10 |
| Admin Users：创建、重置、暂停、关闭、恢复、取消删除 | Element Plus 表单/表格，页内 action card 收集新密码/原因 | 表格 + 右侧详情 drawer + ElMessageBox/表单；原因、容量并发和脱敏审计不变 | UIR-11 |
| Admin Settings：修改容量 | Element Plus card/form，容量与原因必填 | 设置页/Drawer 确认；最后名额并发与审计不变 | UIR-11 |

登录是认证会话创建而非领域写入；仍由 UIR-10/11 保留提交中、错误和安全重定向。Home、Records、Dashboard、Audits 和 404 当前主要为读取/导航，不在本表虚构写操作。

## 6. 设计系统与 CSS 差距

### 6.1 当前定义

- 用户端 `styles.css` 约 3820 行、66 KB；没有 `styles/**` 目录。顶部已有 `--color-*`、3 档 radius、2 档 shadow、content max 和少量 spacing。
- 文件后段再次定义 `:root` 和 `--v2-*`（purple/warm/mint/danger/text/border/radius/shadow），形成两套命名；`--color-bg` 当前 `#fbfaff`，已确认基线建议为更暖的 `#fbfaf7`。
- 字体主要依赖系统 sans-serif；字号、行高、z-index、动效、密度没有完整语义 token。
- 管理端 `styles.css` 仅约 88 行，颜色/间距多为局部值，未形成与用户端对齐的语义层。

### 6.2 历史层与重复

- 单文件同时包含早期 `auth/page/finance/planner/sync`、MOBILE 二级壳、`v2-*` 原型和最新首页/记录/计划/我的覆盖；后置选择器依赖 cascade，删除任一“重复”都可能改变行为。
- 明确重复/覆盖热点包括两次 `:root`、`.secondary-button`、`.form-actions`、`.account-page`、`.v2-page`、`.v2-greeting`、`.focus-card`、`.v2-section`、`.timeline-list`、`.trip-glance-card`、`.home-capture`、`.segmented-control`、`.range-chips`、`.plan-item-actions`、`.bottom-nav` 等。
- 页面专属选择器与公共组件选择器交织，断点分散在文件各处；过去实机曾因 520/768 CSS viewport 与原生控件溢出发生回归，不能以“减少行数”为理由直接合并规则。

### 6.3 不一致

- 按钮存在 `primary-button`、`secondary-button`、`danger-button`、`text-button` 以及组件内部 `primary/secondary`；loading、focus 和尺寸规则不统一。
- 表单同时使用 `.auth-form`、`.inline-create`、`.planner-edit`、`.draft-form` 和页面局部 label 结构；help/error/required 关联不一致。
- 卡片同时有 `section-card`、`card-section`、`v2-section`、`focus-card`、`schedule-card` 等，圆角/阴影/边框层级不同。
- 状态标签有 badge、sync、priority、schedule、attention 等多套色值和结构，尚未统一 neutral/info/success/warning/danger/pending 语义。
- 管理端应继续使用 Element Plus 的 form/table/drawer 交互，不应复用用户端触控密度或自行复制用户端 DOM 组件。

### 6.4 可共享与不可共享

可共享语义：品牌/表面/文字/边框/成功警告危险信息色、spacing/radius/shadow/z-index/motion 命名、focus ring、状态语义、comfortable/compact 概念。

不可直接共享：用户端 44–48px 移动触控密度、底部导航/安全区/Action Sheet 与管理端紧凑表格、侧栏、分页、右侧 drawer；管理端由 Element Plus token 映射实现，不复制用户端基础组件。

## 7. 必须保留的业务行为

- Router 的鉴权、强制改密、redirect、`returnTo` 清洗、直接深链 fallback、滚动位置和 Browser Back 识别。
- 所有未保存保护、提交中防重复、输入保留与失败恢复。
- 金额字符串/定点精度、现有枚举 value、`Asia/Shanghai` 及日期序列化；MOBILE-C3 的临时值、取消恢复和 min/max 行为。
- 删除/恢复、账户关闭、管理员高风险操作的确认、原因与脱敏审计。
- 离线写入、待同步、冲突选择、跨用户隔离及管理员默认不可读个人业务正文。
- AI request → Proposal → 编辑/拒绝/用户最终确认 → 正式领域服务；发送或生成成功不等于正式写入。
- 快捷指令设备凭证可撤销、幂等，且不保存账户密码。
- 容量规则：暂停仍占容量、关闭释放、恢复重新检查容量。

## 8. 迁移风险与样板选择

最高风险：`TripDetailView`（876 行、多类嵌套编辑/清单、19 个按钮）、`PlannerDetailView`（907 行、三实体条件分支）、`RemindersView`（重复规则/日期/Push/权限）、`AiOperationCard` + `ProposalReviewView`（正式写入确认边界）、`AccountView`（会话、删除/关闭与离线清理）、管理端 `UsersView`（容量、账号生命周期、审计）。其次是 3820 行 CSS 的 cascade 拆分本身。

首批低风险样板：`ChangePasswordView.vue`。它已使用 SecondaryPageShell/SectionCard/FormActions，业务调用单一，字段有限，并具备强制改密、未保存、错误、loading 和成功导航等足够验收面。备选为 `NotFoundView`，但过于简单，无法证明表单、状态和插槽架构。

## 9. 测试缺口与后续证据

- 用户端 24 个 view 文件仅 7 个 view unit 文件；资金账户、分类、预算、修改密码、账单、行程、快捷指令、冲突等缺直接 view unit。
- 管理端没有 view unit；admin E2E 重点覆盖用户创建、重复账号和重置密码，暂停/关闭/恢复/最后容量名额、设置、审计、无权限和 drawer 均需补齐。
- 现有 E2E 有 auth、home、navigation-shell、capture-draft、ai-proposal、deletion、offline-repository、web-push、admin；不能据此宣称完整页面×状态×五档矩阵已通过。
- 本轮不启动页面，也不执行 375/390/430/768/1440 浏览器检查。UIR-02 仅对样板页执行完整五档；全量矩阵留给 UIR-12。

## 10. UIR-02 契约就绪与执行门禁

审计输入已经足以冻结 UIR-02 的文件白名单、保留行为和验收矩阵，但当前状态是 `BLOCKED / NOT_STARTED / CONTRACT_READY_LOCAL / PLANNING_NOT_IN_INTEGRATION`。只有本轮规划/状态提交已合法进入 Integration，或用户另行明确授权以精确本地提交 SHA 为基线，主代理才可重新核验 Integration HEAD/CI、创建独立分支并把契约交给 Luna。九项天气、AI、桌面和资产决策均不阻塞 UIR-02 的内部基础工作；其中桌面导航最迟 UIR-05 前确认，天气/AI/小猫资产最迟 UIR-09 前确认。
