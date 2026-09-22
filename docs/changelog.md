# 变更日志（Changelog）

## 2026-09-22 — UIR-09A2B 最终确认双击竞态收尾（DONE_LOCAL / READY_FOR_DELIVERY）

- 在保留既有 `AiOperationCard` 改造的基础上，修复 `ProposalReviewView` 最终确认双击竞态：此前 `canFinalConfirm` 同时控制确认区显示和可点击状态，最终确认开始后 `ai.saving` 使确认区从 DOM 移除，移动端双击后续事件可能落到操作卡“拒绝此项”，导致 operation reject 与 final-confirm 并发并返回 409。
- 最终确认区现在只按“提案仍可审核且存在 ACCEPTED 操作”决定是否显示；请求期间保持 DOM 和页面布局稳定，按钮同步禁用并显示“写入中…”。确认入口在设置 `confirming` 前直接检查 confirming、saving、统一 mutation lock、route/proposal ID 和 ACCEPTED 操作数量；保存、接受、拒绝、整项拒绝与最终确认互斥，保持原 operationIds 排序、version、冲突/权威刷新、响应丢失恢复和 APPLIED replay 语义。
- 保持原字段 key、编辑字段集合、Asia/Shanghai 日期语义、金额字符串、校验规则、payload 构造、`save`/`accept`/`reject` emit、PENDING/ACCEPTED/APPLIED/EXPIRED/FAILED/REJECTED 状态机、保存/接受/拒绝条件和 mutation 锁；未改动 `DateField`、`DateTimeField`、API、Store、Router、后端或数据库。
- `AiOperationCard` 专项 24/24、`ProposalReviewView` 专项 54/54、`AiView` 专项 12/12 通过；Web 全量、lint、typecheck、`npm run quality`、`npm run format:check`、`npm run check:context` 和 `git diff --check` 在最终文档更新后重新执行并通过。
- 使用项目既有便携 MySQL、`daily_assistant_e2e` 与 Fake Provider 进行真实 `ai-proposal` 回归。`tablet-768` 的 `H05-FINAL-DOUBLE-CLICK` 连续 3 次通过；五档项目（375、390、430、768、1440）共 60/60 通过，每次双击断言 final-confirm 请求为 1、operation reject 请求为 0、Proposal 最终为 APPLIED、只生成一条 Task 且无 409。
- Playwright 真实页面手工检查 375、390、430、768、1440 及五档 200% 根字号：长标题/备注、确认后只读结果和操作区均无横向溢出，单击最终确认可进入已写入结果；业务请求均按预期返回 2xx/201。控制台仅记录本地开发环境已有的 refresh 401 与 Service Worker `text/html` MIME 噪声，未发现本次竞态相关错误；验收结束后浏览器、API、Web、Admin 和 MySQL 均已停止。
- 真实第三方 AI Provider、真实设备/系统级文字缩放、真实软键盘和日期时间选择器未验证；Fake Provider 未调用生产数据库或真实密钥。本轮未执行 Fresh Sol，未提交、推送、创建 PR、合并或部署，未开始天气功能或下一任务。

## 2026-09-22 — UIR-09A2A Proposal 审核页框架与确认区改造（DONE_LOCAL / READY_FOR_DELIVERY）

- 将 `ProposalReviewView` 重组为状态摘要、需求概览、逐项审核、整项拒绝和最终确认的清晰顺序；状态文案同时说明可否继续审核及下一步，不只依赖颜色。详情 API 未提供原始用户输入或请求类型，因此概览仅由现有操作数量与类型组成，并明确不重复保存或伪造原始输入。
- 继续直接复用未修改的 `AiOperationCard`，保留 route `proposalId`、权威刷新、版本/冲突处理、接受/拒绝/编辑、整项拒绝、最终确认、幂等、防重复提交、`returnTo` 与 Browser Back。只有明确接受的操作能在最终确认后写入；终态 Proposal 的操作均锁定，且不展示误导性的最终写入按钮。
- 移动端最终确认区采用既有安全区粘性模式，桌面端保持内容流；长内容可换行，操作列表和次要/危险操作具有明确层级。未修改 Store、API、Router、后端、数据库或 `AiOperationCard` 内部编辑逻辑。
- `ProposalReviewView` 专项 50/50、`AiView` 既有专项 12/12、Web 全量 52 files / 379 tests、Web lint/typecheck、`npm run quality`、`npm run format:check`、`npm run check:context` 与 `git diff --check` 均通过。仓库中未发现独立的 `AiOperationCard.test.ts`；既有卡片继续由页面专项与真实 AI Proposal 流程覆盖。
- 使用项目既有便携 MySQL、`daily_assistant_e2e` 和 Fake Provider 运行 `ai-proposal`：375、390、430、768、1440 五项目共 60/60 通过，覆盖加载、逐项接受/拒绝、最终确认、整项拒绝、Browser Back、权威重载、重复最终确认和响应丢失后的恢复；未调用真实第三方 Provider、生产数据库或密钥。五档以 200% 根字号检查均无横向溢出，移动端最终确认区未遮挡操作。390/1440 的 503 响应丢失/重载恢复走真实浏览器流程；加载 404/503、操作冲突、最终确认失败和权威刷新保护由现有 `ProposalReviewView` 行为测试覆盖。真实设备/系统级文字缩放和真实第三方 Provider 未验证。

## 2026-09-22 — UIR-09A1 AI 对话式入口改造（DONE_LOCAL / READY_FOR_DELIVERY）

- 将 `AiView` 调整为轻量单轮 AI 助手入口：二级页说明、助手引导、五种业务类型快捷选择、长文本编辑器、发送中/失败/重试反馈和“确认后才会写入”提示均在同一页面内完成；页面明确不保存聊天历史，不展示伪造回复或多轮会话。
- 保留现有 `ai.createProposal`、八字段请求 payload、错误文案、幂等键规则、ProposalReview 跳转、`returnTo` 与未保存离开保护。未新增 Store、API、Router、Provider 或任何持久化逻辑；AI 仍仅生成待审核 Proposal，不能自动写入正式业务数据。
- `AiView` 专项测试 12/12、Web lint/typecheck、全量 `npm run quality`、Web 全量 52 files / 373 tests、`npm run format:check`、`npm run check:context` 与 `git diff --check` 均通过。
- 使用项目既有便携 MySQL 与 `daily_assistant_e2e` 的本地 Fake Provider 完成真实浏览器回归：`ai-proposal` E2E 已改用 AI 助手标题、五类 chips、长文本编辑器、发送/失败/重试和确认前写入提示等可访问语义；覆盖 Proposal 创建、审核、拒绝、最终确认、`returnTo`、未保存离开保护及网络/Provider 重试。375、390、430、768、1440 五档共 60/60 通过，CI 同款 Chromium desktop/mobile browser smoke 62/62 通过；专项的阻塞性控制台/网络错误检查未命中。真实第三方 Provider 未调用、仍未验证；未使用生产数据库或密钥。

## 2026-09-22 — UIR-08D2 计划详情编辑表单迁移（DONE_LOCAL / READY_FOR_DELIVERY）

- 统一 `PlannerDetailView` 中待办、日程和提醒三套编辑器的信息层级：共用标题与说明、基本信息/实体设置分组、稳定表单 ID 和外置 `FormActions`；补齐必填/可选提示、标题自动聚焦、取消后焦点恢复，以及 768 以下移动端底部粘性操作区。
- 保留既有 payload、version、Planner Store 同步和 Asia/Shanghai 序列化语义；待办继续支持优先级和可空截止时间，日程继续支持全天边界与定时起止时间，提醒继续支持 ONCE/DAILY/WEEKLY/MONTHLY 及原有重复规则。条件字段隐藏时保留编辑草稿，但只提交当前类型适用字段。
- 取消编辑在无改动时直接返回，有改动时使用现有应用确认框；拒绝离开保留输入，确认放弃重置表单并恢复“编辑”按钮焦点。详情实体或 ID 更新、来源返回和 Browser Back 均继续受现有未保存保护约束；保存中禁止重复提交。
- `PlannerDetailView` 专项 44/44、Web 全量 52 files / 365 tests、Web lint/typecheck、`npm run quality`、`npm run format:check`、`npm run check:context` 和 `git diff --check` 全部通过。复用项目既有便携 MySQL 与 `daily_assistant_e2e`，navigation-shell、temporal-picker、deletion、web-push 在 375、390、430、768、1440 五个项目共 35/35 通过。
- 三类表单在五档视口及五档 200% 根字号下均无横向溢出，移动端操作区未遮挡最后一个可编辑控件；全天/定时和四种提醒重复规则的条件字段切换通过。390/1440 受控 400、409、503 均显示安全文案、保留输入并在解除拦截后重试成功；网络中断按既有离线写入与恢复同步语义完成，控制台除开发环境 Service Worker MIME 噪声外仅有上述主动注入请求错误。
- DEVICE_ACCEPTANCE_PENDING：尚未在真实 iPhone/Android 上复验软键盘、安全区和日期时间选择器。本任务不要求 Fresh Sol，未执行独立 reviewer 或实际模型/runtime metadata 验证；本地变更尚未提交、推送、创建 PR、合并或部署，未开始下一任务。

## 2026-09-21 — UIR-08D1 计划详情公共展示与操作区迁移（DONE_LOCAL / READY_FOR_DELIVERY）

- 迁移共享 `PlannerDetailView` 的 `/tasks/:id`、`/calendar/:id`、`/reminders/:id` 详情层级、加载/错误/无效数据/无 ID/404/503/重试反馈和旧请求防覆盖；保留现有三类编辑表单、路由实体分支、字符串 ID、safe `returnTo`、Browser Back、版本保护、Store 同步、软删除/恢复及操作语义。
- 详情展示统一为中文状态、Asia/Shanghai 时间、全天边界、待办优先级/逾期、提醒重复规则/尝试次数/失败原因；公共操作区补充主要/状态/危险操作分组、重复提交保护和移动端单列触控布局。
- 改动已迁移至正确 Integration 基线 `6e3d795d5f998f0156cf004521420c2557e03031`；`PlannerDetailView` 专项 25/25、Web 全量 52 files / 346 tests、`npm run quality`、格式、上下文和差异检查通过。真实浏览器使用项目既有便携 MySQL 与 `daily_assistant_e2e`，相关 E2E 在 375、390、430、768、1440 五档项目中 35/35 通过；200% 文本缩放五档均无横向溢出，详情操作区未越界。
- 390/1440 完成加载、404、503、重试恢复和超长标题/备注/失败原因复核；控制台仅保留既有 Service Worker `text/html` MIME 噪声，网络异常仅为验收主动注入的 404/503。Fresh Sol 不属于本任务门禁，未执行模型或 runtime routing metadata 验证；本地变更尚未提交、推送、创建 PR、合并或部署，UIR-08D2 未开始。

## 2026-09-21 — UIR-08C 提醒列表页面迁移（DONE_LOCAL / READY_FOR_DELIVERY）

- `/reminders` 按“状态筛选/已删除 → 应用外提醒能力 → 反馈 → 新建 → 列表”重组页面层级；补齐待发送、已发送、发送失败、已抑制、已取消和全部筛选，加载/空/失败/重试反馈，陈旧请求保护，以及长标题、备注、失败原因和移动端操作区换行。
- 保留 ONCE/DAILY/WEEKLY/MONTHLY 重复规则、Asia/Shanghai 时间转换、version、取消/重新启用、软删除/恢复、SENT 限制、完整 `returnTo` 和未保存保护；Push 入口区分浏览器不支持、服务端未配置、未开启、已开启、权限拒绝和操作失败，失败时不阻塞提醒 CRUD。
- 仅修改 `RemindersView.vue`、新增 `RemindersView.test.ts`、提醒页作用域样式和本记录；未修改 Planner Store、API、Router、DateTimeField、时间工具、Push/Service Worker、E2E 测试或其他页面。
- `RemindersView` + `PlannerListsView` 聚焦测试 2 files / 19 tests；Web 全量 52 files / 333 tests；Web lint/typecheck、`npm run quality`、`npm run format:check`、`npm run check:context` 和 `git diff --check` 全部通过。
- 复用项目既有便携 MySQL 8.4.11、`daily_assistant_e2e` 和原有启动脚本，navigation-shell、temporal-picker、web-push 在 375、390、430、768、1440 五个 Playwright 项目共 30/30 通过；Push 仅使用既有浏览器模拟，未连接真实第三方服务。
- 浏览器验收在 390 与 1440 注入提醒 GET 503，页面显示可理解的加载失败/重试反馈；移除拦截后请求恢复 200。五档视口启用 200% 根字号时 `document/body scrollWidth` 均等于 viewport，未见横向溢出；SCHEDULED、SENT、FAILED、SUPPRESSED、CANCELLED 状态筛选请求均恢复 200。控制台仅见开发环境既有 Service Worker MIME 噪声，主动注入 503 已在网络记录中确认。
- 本轮未进行 Fresh Sol 审查；未提交、未推送、未创建 PR、未合并、未部署，未开始 UIR-08D。

## 2026-09-18 — UIR-07B 账单表单迁移本地实现

- `/transactions/new` 与 `/transactions/:id/edit` 迁移到 `UiPageFrame` 表单模板，使用 `max-width="form"`、稳定表单 ID、外置原生提交按钮和底部 `FormActions`，保留 `returnTo`、取消替换导航和未保存保护。
- 保留账单类型、定点金额字符串、退款关联、分类/账户/行程过滤、编辑版本和请求字段语义；日期时间统一通过 Asia/Shanghai 辅助函数序列化，初始化新增加载、失败重试和编辑目标失败时不展示可编辑表单。
- 新增 `TransactionFormView` 行为专项测试，覆盖默认时间、完整编辑回填、失败/重试、过滤、退款变体、请求/错误/重复提交、成功替换、操作区关联、取消和未保存导航；专项 16/16、用户端 lint/typecheck、格式、上下文检查、差异检查和完整 `npm run quality` 通过。
- 本轮未修改 Store、API、Router、共享时间工具或其他页面，未提交、推送、创建 PR、部署或修改外部服务。

## 2026-09-18 — UIR-07A 账单明细列表本地实现

- `/transactions` 继续使用 `SecondaryPageShell`、记录父级返回和现有日期/类型/已删除筛选；将“记一笔”和 CSV 导出移至页头操作区，并保留 `returnTo`、当前月默认范围和 API 参数。
- 列表接入独立的加载、失败重试和成功空状态，行内补充类型、Asia/Shanghai 时间、备注及“已删除”标记；金额继续直接使用 API 定点字符串并保留支出负号、收入/退款正号。
- 删除改用可撤销软删除确认，恢复、导出和操作错误保持独立；显示层按当前类型、日期范围和 Asia/Shanghai 日语义过滤 Store 合并后的记录，新增行为测试覆盖筛选、反馈、删除确认/恢复、CSV 参数和长内容换行。未修改 Store、API、Router 或其他页面；本轮未提交、推送、创建 PR、部署或开始 UIR-07B/UIR-08。
- 专项测试 6/6、用户端 lint/typecheck、格式、上下文检查和差异检查通过；`npm run quality` 全部通过。真实浏览器已检查 375、390、430、768、1440：正常列表、类型/日期筛选、空状态、503 加载失败与重试恢复、软删除/恢复、CSV 成功下载与 503 失败反馈、来源返回和长内容；五档 200% 根字号均无横向溢出。浏览器控制台保留既有开发环境 `/sw.js` MIME/刷新噪声，未观察到本次账单列表新增异常。

## 2026-09-17 — UIR-06C 计划中心根页本地实现

- `/plan` 保持既有 PageHeader、查询参数、Asia/Shanghai 日期语义、Planner Store/API 调用和详情/返回链接；将 DAY/WEEK/MONTH、今天/明天/本周/以后/逾期和 7 日日期栏作为可访问、可操作的计划筛选区展示。
- 统一时间轴继续合并日程、开放待办和已排程提醒；保留完成待办、取消日程、当前事项摘要、逾期面板和快速新增入口，并让逾期范围直接展示逾期待办而不重复面板。
- 增加页面本地 loading、初始失败重试、部分来源失败提示、空状态和键盘/焦点/换行样式；未修改 Store、API、Router、子页面或全局状态。实现与 focused tests 尚未提交、推送、创建 PR、部署或开始 UIR-07/UIR-08。

## 2026-09-16 — UIR-05C 统一二级页标题栏样式（本地实现）

- 统一 `SecondaryPageShell` 与 `UiPageFrame` 默认 `PageHeader` 的移动端间距、返回触控高度、背景/边界和长文案换行；沿用现有语义 Token，不增加 sticky 或重复安全区顶部间距。
- 空 actions slot 不再生成空的操作区域；保留 named/default slot、标题/副标题、`returnTo`/fallback/Browser Back 返回语义及可访问名称。
- 新增 PageHeader/SecondaryPageShell 的空/有操作、长文案和 slot 契约回归；Web 41 files / 205 tests 与完整 `npm run quality` 已通过。本轮尚未提交、推送、创建 PR、合并或部署。

## 2026-09-16 — UIR-05B 二级编辑页底部操作区样板（本地实现）

- 为 `UiPageFrame` action 插槽增加移动端页面内粘性操作区、语义层级、边界背景和安全区内边距；桌面端继续使用普通内容流，空 action 不生成区域。
- 将 `ChangePasswordView` 的 `FormActions` 移至 action 插槽，使用稳定的 `change-password-form` id 与标准 `form` 属性保持表单提交和原有认证、校验、错误、返回及未保存行为不变。
- 新增外部提交按钮关联与点击提交回归覆盖；本轮尚未提交、推送、创建 PR、合并或部署，真实设备软键盘与安全区待后续预览验收。

## 2026-09-16 — UIR-04C 首页反馈状态接入样板（本地实现）

- 首页加载分支接入 `LoadingState`，请求失败分支接入 `ErrorState`；保留原有请求顺序、错误判断、重试流程和业务空状态。
- 本轮仅修改首页样板、对应测试和本变更记录；未修改 Store、API、Router、其他页面或新增全局反馈系统。提交、推送、PR、合并和部署待后续授权。

## 2026-09-15 — UIR-02 候选部署私有预览

- 新增 UI 语义 Token、基础样式、页面/表单插槽及修改密码单页样板，并修复拒绝 Browser Back 后地址栏与页面状态分裂的问题。
- 候选 `05e4d696` 的本地质量检查和 PR #41 两组 CI 全部通过；受保护备份后部署至私有预览并通过发布后 smoke。
- 用户随后确认 iPhone/Android 的软键盘、安全区和连续 Browser Back 行为均正常，真机验收通过。
- PR #41 已合并为 Integration `d05b25cb`，合并 CI `34952298758` 全绿；未部署公网或生产环境。

## 2026-09-15 — UI 规划基线移植（DOCUMENTATION_ONLY）

- 基于 Integration `77bedde...` 移植 UI 视觉/页面基线、当前状态审计、九项未决决策、UIR-00 总任务图和 UIR-02 bounded Luna 契约。
- 对重叠状态文档逐项语义合并，保留 Integration 最近 MOBILE-C4、Web Push、日期时间修复、PR #38/#39、部署和 CI 事实。
- 未修改 Vue、API、数据库、依赖或配置；未推送、未创建 PR、未部署，UIR-02 仍未开始。

## 2026-09-14 — 必填日期时间默认选中当天（PRIVATE_PREVIEW_DEPLOYED）

- 修复空的必填日期时间字段仅以描边标识“今天”、却未真正选择日期的问题。打开选择器时临时选中今天，使“确定”立即可用；取消仍不改变表单值。
- PR #38 已合入 Integration `8bbb302`，合并 CI `34823090430` 全绿。受保护备份后已部署私有预览，入口、提醒深链接、PWA 资源、服务及日志检查通过；iPhone/Android 复验待执行。

## 2026-09-14 — R1.1 私有预览 Web Push 实机验收（DONE_LOCAL）

- 用户选择真实应用外提醒并确认 `web-push@3.6.7` 的 MPL-2.0 使用边界；私有预览已生成服务器专用 VAPID 和订阅加密密钥，开启双开关并完成 API 重启健康检查。
- 用户确认真实设备订阅、送达、通知点击、退订和重新开启均正常；H6 在本私有预览范围关闭，提醒调度器已恢复。

## 2026-09-14 — iPhone 当天日期时间确认修复（DONE_LOCAL）

- 提醒选择当天时可能因本地化日期字符串参与文本比较而禁用“确定”。组件现以 `formatToParts()` 组装稳定的 ISO 日期；专项回归测试和完整 `npm run quality` 均通过。PR #36 已合入 Integration `9ddc354`，合并 CI `34819073059` 全绿，并已部署私有预览。

## 2026-09-14 — REL-03 私有预览 readiness 收口（DONE_LOCAL）

- 记录当前 release、服务、健康、受保护备份和回滚目标的只读复核结果，并新增可复用的私有预览发布与应用回滚运行手册。
- 本轮不创建资源、不改变服务配置、不触发部署；简化运营记录 PR #35 已合并为 Integration `6e3ba34`，合并 CI `34810670074` 全绿。

## 2026-09-14 — MOBILE-C4 合入 Integration（DONE_INTEGRATION）

- 用户确认 iPhone/Android 私有预览实机验收通过；PR #34 已合并为 Integration `e407157`，合并 CI `34800440131` 的 quality、db-validation、browser-qa 全绿。

## 2026-09-14 — MOBILE-C4 私有预览部署（DEVICE_ACCEPTANCE_PENDING）

- CI 全绿候选 `8e9f53e` 已部署到 Alibaba 私有预览 release `/opt/daily-assistant-preview/releases/8e9f53e0-20260914T1007Z`。
- 数据库备份、锁定安装、构建、依赖审计、服务健康和主要路由冒烟通过；保留上一 release 作为回滚目标。
- 下一门禁为 iPhone/Android 实机验收，尚未声明 MOBILE-C4 验收完成。

## 2026-09-14 — MOBILE-C4 C4.4 AI 页面改版（DONE_LOCAL）

- 重整草稿列表、提案状态、操作卡片和 AI 请求表单，并将用户可见 AI 类型与状态统一为中文。
- 专项测试和完整 quality 通过；已推送至 `b44c1a6` 且 CI `34797420362` 全绿，部署与设备验收待执行。

## 2026-09-14 — MOBILE-C4 C4.3 详情页面改版（DONE_LOCAL）

- 统一计划详情和行程详情的页面壳、摘要、内容分区、编辑与操作呈现，未修改业务、路由或接口。
- 五档视口、专项测试、完整 quality 与差异检查通过；当前未提交、未推送、未部署。

## 2026-09-12 — MOBILE-C4 C4.2 规划列表页面改版（DONE_LOCAL）

- 统一日程、待办和提醒页面的筛选、新建、列表、编辑和状态反馈布局，未修改业务、路由或接口。
- 五档视口、Web 测试、构建、完整 quality 与差异检查通过；当前未提交、未推送、未部署。

## 2026-09-12 — MOBILE-C4 C4.1 记账页面改版（DONE_LOCAL）

- 统一账单列表、筛选、记录表单、退款关联和操作区的移动端呈现，复用 MOBILE-C1-C3 组件且未改业务语义。
- 五档视口、Web 测试、构建、完整 quality 与差异检查通过；当前未提交、未推送、未部署。

## 2026-09-12 — MOBILE-C1 二级页面壳

- 新增共享二级页面容器、内容分区卡片和表单操作区组件及其测试。
- 将资金账户、分类管理、月度预算、同步冲突和修改密码迁移到统一结构，未改变路由、数据或提交行为。
- 增加二级页面最大宽度、移动端粘性页头、安全区和触控尺寸样式；完整验收仍在进行。
- 提交 `91c4fed` 已推送并创建 PR #31；两组候选 CI 全绿，尚未部署或合并。
- 已部署私有预览 release `91c4fed0-20260912T0238Z`，部署前备份和部署后入口、API、静态资源及日志检查通过；PR #31 仍未合并。
- 根据实机反馈修复移动端标题遮挡、预算卡片横向挤压，以及窄屏表单和操作按钮重叠；修复已通过本地完整质量门禁，等待候选 CI 与预览更新。
- 修复提交 `32c44e0` 已通过两组 CI 并部署为私有预览 release `32c44e00-20260912T0313Z`；数据库备份和部署后检查通过。
- 第二轮修复账单页月份、类型和“显示已删除”的窄屏重叠，统一两枚工具按钮宽度，并改善返回按钮触控尺寸及其与标题的间距。
- 第二轮修复提交 `4ffd32d` 已通过两组 CI 并部署为私有预览 release `4ffd32d0-20260912T0332Z`；部署前备份和部署后检查通过。
- 第三轮将账单页强制分行布局从 520px 扩展至 768px，覆盖 standalone WebView 或系统显示缩放下未进入窄屏断点的设备。
- 第三轮修复提交 `8c3e9e7` 已通过两组 CI 并部署为私有预览 release `8c3e9e70-20260912T0346Z`；部署前备份和部署后检查通过。
- 第四轮将账单筛选在移动端固定为单列，并把单月筛选替换为起止日期；列表与 CSV 共用日期范围和类型，默认当月首日至当天，删除/恢复后保留筛选上下文。API 继续接受旧 `month` 参数，无数据库迁移；完整质量门禁已通过，等待提交和 CI。
- 第四轮修复提交 `9a99120` 已通过两组 CI 并部署为私有预览 release `9a991200-20260912T0415Z`；部署前备份与部署后 API、账单入口、PWA 资源、服务和日志检查通过。

## 2026-09-11 — MOBILE-B PWA 生命周期候选

- 完善 Apple touch、192、512 和 maskable 图标，以及 id/scope/start URL、standalone、zh-CN 等 Manifest 字段。
- 新增统一安装与更新策略：Android 原生安装、iPhone 添加到主屏幕说明、已安装模式识别、中文更新提示和安全暂缓。
- 未保存表单和同步活动会阻止新版本刷新；本地完整质量通过，等待提交、CI、部署及实机验收。
- 提交 `4d86f90` 已推送至 PR #30，两组 CI runs `34580364107`、`34580381945` 全绿；已部署至私有预览 release `4d86f900-20260911T0846Z`，备份与部署后检查通过，等待实机验收且尚未合并。
- 实机反馈修复增加页面恢复前台时的版本检查，退出后重新登录明确回首页；最终提交 `aebc257` CI 全绿并部署 release `aebc2570-20260911T0946Z`。
- 第二轮反馈修复 `927dea3` 增加更新执行状态、中文错误和 iOS 刷新兜底，并使计划中心默认明确选中当天；本地完整 quality 与两组 CI 全绿，已部署 release `927dea30-20260912T0129Z` 并通过入口、API 健康、Manifest、Service Worker、资源及日志检查。
- 新增 `tasks/MOBILE-C.md`（`d7860cd`），分阶段规划二级页面壳、统一弹窗、日期时间控件和复杂页面迁移，保持 MOBILE-B 范围不扩张。
- 用户接受将旧安装实例更新按钮和 iOS 根页面系统边缘手势作为非阻塞限制暂时搁置；未把两项写成已完全实现，MOBILE-C1 继续等待 PR #30 合并后的 Integration 基线。
- 更新接管修复 `e756c0b`/`727cb60` 使 Worker 后台激活并接管，按钮刷新不再依赖 waiting 状态；根页面增加横向过度滚动抑制。最终两组 CI 全绿并部署 release `727cb600-20260912T0203Z`。

## 2026-09-11 — MOBILE-A PWA 导航策略

- 新增统一导航策略，根 Tab 切换不再堆积历史，详情页保留直接父级返回来源。
- 清理递归或外部 `returnTo`，并为直接打开的详情页建立确定的业务 fallback。
- 顶部/底部导航与页面返回按钮使用同一策略；加入五档宽度和 WebKit mobile 回归测试。
- 本地自动化验证通过；真实 iPhone 边缘返回和 Android 系统返回尚未验证。
- 已获授权创建任务提交并推送，PR #29 已创建；未合并或部署。
- PR #29 首轮 browser-qa 发现 Browser Back 被附加反向 `returnTo`；现已识别历史遍历并跳过隐式来源注入，本地完整 smoke 52/52 通过。
- 修复后两组 CI 全绿；后续 `7103ad1` 修复退出登录和安装版更新，`77718a0` 修复认证数据库就绪并统一中文错误；`fa0ee53` 修复未登录时错误恢复上一账号缓存，并在退出时等待清除 IndexedDB 与最后用户标记。当前部署为 `/opt/daily-assistant-preview/releases/fa0ee530-20260911T0738Z`，备份、目标顺序构建、公开数据库健康、中文登录错误响应和日志检查通过，旧 release 保留用于回滚。
- 用户确认 iPhone 边缘返回、Android 系统返回及未登录缓存实机验收通过；MOBILE-A 状态更新为 `ACCEPTED / READY_TO_MERGE`，PR #29 尚未合并。

## 2026-09-09 — Web Push 应用外提醒候选

- 新增用户隔离的 Push 订阅 API、加密订阅存储、幂等送达记录和 Web Push 适配器。
- PWA Service Worker 支持 `push` 与通知点击，提醒页可在浏览器和服务端支持时订阅。
- 增加 VAPID/字段加密配置、OpenAPI、账户删除清理和安全测试；功能默认关闭。
- 临时 MySQL 8.4.9 的 13 migrations、18 files/161 tests，以及 Chromium 受控订阅、权限和五档宽度验证通过；真实送达仍未验证。

## 2026-09-09 — Web Push 应用外提醒候选

- 新增用户隔离的 Push 订阅 API、加密订阅存储、幂等送达记录和 Web Push 适配器。
- PWA Service Worker 支持 `push` 与通知点击，提醒页可在浏览器支持且服务端启用时订阅。
- 增加 VAPID/字段加密配置、OpenAPI、账户删除清理和安全测试；功能默认关闭。
- 临时 MySQL 8.4.9 的 13 migrations、18 files/161 tests，以及 Chromium 受控订阅、权限和五档宽度验证通过；真实送达仍未验证。

## 2026-09-08 — Prisma override 正式兼容性验证（FORMAL_COMPATIBILITY_VERIFIED_LOCAL）

- 本地形成 Prisma 7.9.1 + 精确 patched overrides + npm 11.18.0 候选，清空过期安全例外并补充 fail-closed audit/SBOM 回归测试。
- clean install、依赖树、audit 0、两类 SBOM、license、quality、MySQL 8.4.11 真实集成 18/160 和真实数据库 Chromium smoke 44/44 通过。
- 未提交、推送、修改 PR、运行新候选 CI 或部署；人工 license 与远程 TLS/网络路径仍待后续审批和验证，R1 保持 `BLOCKED / NOT_READY`。

## 2026-09-07 — 执行规则本地同步（DONE_LOCAL / UNCOMMITTED）

- 根据用户要求，将共享审阅对话中的规则澄清落实到本地 AGENTS.md、PLANS.md 与 tasks/PR19.md：常规本地任务无需独立契约，只读任务无需写状态，按影响范围验证，已有有效授权不重复申请，历史限制保持原适用范围。
- 保留提交、推送、PR、合并、迁移、真实服务与部署的独立授权及完整集成/发布门禁。R1 仍为 BLOCKED / NOT_READY；未修改依赖、业务、数据库或部署配置。
- 核查个人 deepseek-direct-worker 和 product-architecture-planner 的相关规则：已支持范围内自主执行，固定 Git 操作保护无需放宽；未修改个人技能或系统/插件技能，也未调用 DeepSeek。
- 原有 12 份未提交文档修改保留；本次只新增规则与进度记录，不创建提交、不推送。下一项建议仍是独立 override/SBOM 最小复现调查。
- 验证：Prettier、npm run check:context 与 git diff --check 均通过；没有重跑业务测试或完整 quality，现有 PR #25 quality 失败、db-validation/browser-qa 成功不因规则调整改变。

文档版本：1.2
更新：2026-09-03
说明：根目录 `CHANGELOG.md` 与本文件保持同步；本文件是后续模型接手的标准变更入口。

> 本文件按日期记录历史事实；旧条目的门禁、commit 和部署状态不代表当前状态，当前执行事实以 `PLANS.md` 与 `.project/v15-execution-state.md` 为准。

## 2026-09-03 — R1-STABLE-PRISMA-MATCH-RECHECK（BLOCKED / NOT_READY）

- 重新验证 npm registry 后确认，稳定 Prisma 匹配版本为 `7.10.0`，但其精确传递依赖仍为 `deepmerge-ts@7.1.5`、`mariadb@3.4.5`、`mysql2@3.15.3`；修复版本不能自然解析，Prisma `8.0.0-rc.12` 为预发布且没有完整配套稳定组合。
- `npm ci`、`npm ls`、SBOM、license、治理通过；`npm audit` 为 `1 moderate / 5 high`，`npm run audit:dependencies` 与 `npm run quality` fail-closed，`npm run audit` 脚本不存在。未改依赖、未运行 CI、未部署候选，R1 继续阻塞。

## 2026-09-03 — PRIVATE-PREVIEW-FORMAL-STANDARD-RECONFIRMATION（BLOCKED / NOT_READY）

- 根据用户最新要求，私有预览版与正式版使用同一发布标准；现有 Alibaba Integration `299b1f71` 仅保留为运行基线，不视为已通过正式预览门禁。
- 复核确认稳定 Prisma `7.10.0` 仍精确锁定未通过审计的 `deepmerge-ts`、`mariadb`、`mysql2` 版本；Prisma 8 仍为 RC，且配套客户端/适配器不完整。本轮未采用预发布版本、依赖覆盖或临时例外，也未部署候选。
- `npm run audit:dependencies` 继续 fail-closed，PR #25 的 `db-validation`、`browser-qa` 通过而 `quality` 失败；待取得稳定兼容修复并完成全量门禁后再发布预览版本。

## 2026-09-03 — R1 依赖门禁增量修复（DONE_PUSHED / QUALITY_STILL_BLOCKED）

- 在不改变业务代码、架构、Prisma/schema/migration 或部署配置的前提下，仅更新 `package-lock.json`：`fast-uri` `3.1.5 -> 3.1.7`、`qs` `6.15.3 -> 6.16.0`。
- `npm ci`、`npm ls`、治理测试 `14/14`、CycloneDX SBOM（1044 components）和 license inventory（1163 packages）通过；完整 `npm run quality` 仅在依赖审计处 fail-closed。
- `npm audit` 由 `2 moderate / 6 high` 降为 `1 moderate / 5 high`；Prisma 7.9.1 的精确传递依赖链和过期例外仍阻塞 R1，未绕过门禁部署候选。
- 本次锁文件修复已独立提交并推送到 PR #25；Alibaba 私有预览继续运行 Integration `299b1f71`，后续新功能仍另开分支/PR。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-CANDIDATE-01（DONE_PUSHED / PR_OPEN / QUALITY_BLOCKED）

- 按用户授权，将已验证的 Web/V2 导航、离线同步、AI 提示词与评估、契约/测试及发布运营文档拆分为 `f7fb90a`、`1545e21`、`d649ad4` 三个逻辑提交。
- 与 Integration `299b1f71` 对齐并收口 12 个前端冲突；修复合并后重复的 `/records`、`/plan` 路由，合并提交为 `b7734d0`，分支已推送并创建 GitHub PR #25。
- 本地和远端功能验证通过；PR #25 的 `db-validation`、`browser-qa` 通过，`quality` 仍在依赖审计处 fail-closed。未绕过门禁部署候选代码，现有 Alibaba 私有预览继续运行 `299b1f71`。
- 后续新功能不回写 PR #25；待兼容依赖修复并重新通过 audit/SBOM/license/quality 后，再合并、部署并复验私有预览。

## 2026-09-02 — PRIVATE-PREVIEW-RELEASE-01（OPERATIONAL / PUBLIC_NOT_READY）

- 按用户决定跳过真实 iPhone 验证，标记为 `WAIVED_FOR_PRIVATE_PREVIEW / UNVERIFIED`；不把 WebKit 模拟结果写成真机通过。
- 复核已有 Alibaba 私有预览：Integration `299b1f71` 发布包完整性、API/用户端/管理端/Nginx、数据库迁移和服务状态均通过。
- 生成受保护数据库备份，并在临时恢复库中校验 25 张表、14 条迁移记录；服务器已配置每日备份、7 天保留和过期自动清理，手动执行与清理逻辑复验通过；跨位置备份、周期性隔离恢复和公网域名切换仍未完成。
- 用户已明确允许当前私有预览开启 AI；服务器环境 `V15_AI_ALLOWED=true`、`V15_LIVE_AI_ALLOWED=true`，数据库 `v15.ai.liveProvider=true`，与当前决定一致。该决定不自动扩大公网 Provider 使用范围。
- `npm run audit:dependencies` 仍 fail-closed；Prisma 兼容修复候选因 SBOM invalid 已撤回，当前不发布本地混合未提交工作区。详见 `docs/49-private-preview-release-assessment.md`。

## 2026-09-02 — REL-01-DECISION-RECORD-01（APPROVED / REL-02_AUTHORIZATION_PENDING）

- 用户已确认 D1-D8 按 `docs/47` 推荐值批准；批准记录固化于 `docs/48-r1-approval-decision-pack.md`，并补充 REL-02 执行前检查清单。
- REL-01 设计决策已批准，但本轮未获得明确的 staging 资源创建授权；未创建资源、凭据、部署或真实记录。
- R1 Quality Gate 继续 `BLOCKED / NOT_READY`；H1/H2 继续 `PARTIAL`；依赖审计候选仍为 `CANDIDATE_REJECTED`，没有通过正式供应链门禁的依赖修复。
- 仅运行上下文、格式和差异检查，未重复业务测试，未提交、推送、创建 PR 或部署。

## 2026-09-02 — R1-APPROVAL-PACKAGE-01（DONE_LOCAL / APPROVAL_PENDING）

- 复核 R1 当前阻塞：H1/H2 仍缺物理 iPhone 正式证据，WebKit 模拟仅作辅助；H2 离线重开资源错误仍需真机确认。
- 确认依赖审计候选已因 SBOM 精确依赖声明 invalid 撤回，当前没有通过兼容性、SBOM、license 和发布检查的正式修复。
- 新增 `docs/48-r1-approval-decision-pack.md`，汇总 D1-D8 推荐值、状态、负责人、批准前置条件，并明确 REL-01 批准不等于 REL-02 资源创建授权。
- 本轮限定检查 `npm run check:context`、`npm run format:check`、`git diff --check` 均通过；未重复业务测试。
- 未补充真实记录、未使用真实用户数据、未创建资源、未修改业务代码或部署配置，未创建提交、推送、PR 或部署。

## 2026-09-02 — REL-01 Staging 架构与发布边界设计稿（DESIGN_REVIEWED / APPROVAL_PENDING）

- 在不补充真实记录、不创建云资源、不修改部署配置的前提下，新增 `docs/47-rel-01-staging-architecture-decision.md`。
- 设计稿收敛了单实例 API、私网 MySQL 8.4、私有 OSS、HTTPS、最小权限、费用控制、备份/RPO-RTO、监控、发布和回滚边界。
- 已完成与现有架构、发布清单、部署样例和健康检查实现的跨文档自检；云厂商/地域、域名/TLS、基础设施预算、RPO/RTO 和 readiness 方案仍待人工批准；R1、H1/H2、REL-02/03 状态不变。

## 2026-09-02 — R1 H1/H2 WebKit 本机模拟验收（DONE_LOCAL / NON_FORMAL_EVIDENCE）

- 在 `D:\daily-assistant-runtime` 一次性 MySQL/API/Web 环境中，使用 Playwright WebKit `iPhone 13` 模拟完成真实页面验收；H1 登录、首页、待办/日程/提醒列表与详情、返回、浏览器 Back、刷新通过。
- H2 的 manifest/Service Worker、缓存离线重开、离线新增、恢复联网自动同步和服务端去重通过；离线重开期间记录到 WebKit `internal resource error`，因此不将模拟结果视为 H2 真机通过。
- 新增 `docs/46-r1-webkit-emulation-validation.md`；H1/H2 仍为 `PARTIAL`，正式门禁仍需物理 iPhone Safari/PWA 记录。本轮测试服务、临时数据库和浏览器会话已清理，未创建提交、推送、PR 或部署。

## 2026-09-02 — R1 依赖审计兼容性复核（DONE_LOCAL / CANDIDATE_REJECTED）

- 评估 Prisma 7.10.0 与修复版传递依赖候选；由于 npm SBOM 将 Prisma 的精确传递依赖声明标为 invalid，候选已撤回。
- 回滚后依赖树无净变更；`npm ci`、`npm ls`、治理测试 14/14、CycloneDX SBOM 生成/校验（1044 components）和 license inventory（1163 packages）通过。
- `npm run audit:dependencies` 仍 fail-closed；R1 继续等待兼容的正式依赖修复、H1/H2 真机证据和后续门禁，不以 override 或自动延长例外关闭。
- 新增 `45-r1-manual-device-evidence-template.md`，用于归档 H1 iPhone Safari 与 H2 PWA/离线重开结果。
- 详见 `docs/44-r1-dependency-audit-review.md`。

## 2026-09-01 — WEB-SMOKE-01 真实数据库 Web 冒烟收口（DONE_LOCAL / UNCOMMITTED）

- 修复本地 E2E fake-AI 环境开关、草稿返回 URL 的 query 匹配、账号关闭后的未保存导航守卫，以及删除确认和状态选择器契约。
- Web lint、typecheck、unit `21 files / 116 tests`、build、Prettier、`git diff --check` 通过；真实数据库 Chromium desktop/mobile 完整 smoke `44/44 PASS`。
- 本轮未修改 API、Prisma、数据库 schema、同步后端或部署配置；D 盘一次性 MySQL/API/Web/admin 服务已在验收后停止，未创建提交、推送、PR 或部署。
- 该结果移除完整 Web smoke 阻塞，但 R1 Quality Gate 仍受现有依赖审计、H1/H2、Provider enablement 和 REL-04 等独立门禁约束。

## 2026-09-01 — H7 人工门禁关闭（PR20 DONE_LOCAL / H7_CLOSED）

- Dada 已明确关闭 H7；关闭依据为已归档的 DeepSeek 脱敏评估证据、提示词补强回归、`case-146` 3/3 复测、正式写入隔离和当前阶段决策确认。
- PR20 Live Provider Validation 更新为 `DONE_LOCAL / H7_CLOSED`，下一状态转入 `R1 Quality Gate BLOCKED / NOT_READY`。
- H7 关闭不授权生产 Provider、真实用户/生产数据评测、REL-04、R1 advancement、提交、推送、PR 或部署；暂不设金额上限仍不提供金额超支保护。

## 2026-09-01 — PR20 H7 当前阶段决策确认（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- Dada 已确认当前阶段暂定 DeepSeek `deepseek-v4-flash`，接受本轮 Provider 条款复核和评估结果，
  包括 `case-146` 随机失败样本与 provisional schema/effect 判断。
- ADR-029 已接受：用量按 `Asia/Shanghai` 自然月观察，暂不设置固定金额 warning/hard ceiling；保留规范化 token/provider/
  model/status/time 元数据，不进行费用换算或金额拦截。该临时策略不等于生产预算 enforcement。
- H7 仍为 `OPEN / EVIDENCE_READY`，当前仅剩 owner 显式关闭；Provider enablement、REL-04 和 R1 advancement
  仍受独立发布门禁约束。未创建提交、推送、PR、合并或部署。

## 2026-09-01 — PR20 H7 提示词补强后全量复跑与证据收口（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 使用可重复数据集 `h7-adr027-fixed-v1` 完成提示词补强后的完整 200 条本机合成评估：DeepSeek
  `deepseek-v4-flash` 199/200 schema-valid（99.5%），effect proxy 199/200（99.5%），正向 184/185，
  不确定处理 15/15，服务端/客户端 p95 为 1589/1644 ms。
- 唯一异常为 `case-146` 一次 HTTP 502 / `SCHEMA_INVALID`；失败输入保留，随后 3/3 定向复测成功；评估用户
  正式业务表均为 0，`businessWrite=false` 下最终确认仍返回 403 `AI_DISABLED`。
- 新增可重复评估器 `apps/api/src/cli/h7-live-provider-evaluation.ts`，更新脱敏 H7 报告并记录官方 Provider 条款
  复核限制。H7 仍 `OPEN / EVIDENCE_READY`；预算 enforcement、隐私批准、最终阈值/Provider 选择和人工关闭待定。

## 2026-09-01 — PR20 H7 本机受控 Provider 验证（VERIFYING / DONE_LOCAL / H7 HUMAN CLOSURE PENDING）

- 在 `D:\daily-assistant-runtime` 的一次性 MySQL 8.4.11 环境中，以合成数据完成 DeepSeek
  `deepseek-v4-flash` canary、10 条 pilot 和 ADR-027 规定的 200 条评估；200 条中 199 条 schema-valid，
  schema success rate 为 99.5%，p95 延迟 1449 ms。
- 修正 DeepSeek adapter 的 JSON Proposal 输出约束并补充定向测试；一条域校验失败保留原始输入，未保留 raw
  Provider response；失败复测成功，但仍需人工处理该随机失败和两条歧义结果。
- `v15.ai.businessWrite=false` 全程保持；最终确认返回 403 `AI_DISABLED`，评估前后正式业务表基线不变，未发生正式写入。
- H7 仍为 `OPEN / EVIDENCE_READY`，R1 Quality Gate 仍为 `BLOCKED / NOT_READY`；生产预算 enforcement、Provider/model/
  effect thresholds、隐私条款复核和 H7 人工关闭待完成。未启用 Provider，未使用真实用户数据，未创建提交、推送、PR 或部署。
- 脱敏证据：`docs/43-pr20-h7-live-provider-validation.md`。

## 2026-09-01 — PR20 H7 歧义输入定向回归（DONE_LOCAL）

- 收紧 DeepSeek adapter 提示词：关键事实缺失、模糊或占位值必须返回 `UNCERTAIN`，禁止生成“待定任务”等占位字段。
- 本机真实 Provider 复测 3 条合成样例：两条模糊任务归一为 `confidence=0.0000` 且无字段，一条具体任务正常生成
  `title/dueAt/priority`；服务和 MySQL 已在复测后停止。
- 完整 200 条评估未因提示词变更而重跑；H7 仍 `OPEN / EVIDENCE_READY`，后续需在授权窗口重跑全量再决定最终阈值。

## 2026-09-01 — QUALITY-R1 Governance post-write review（PASS / EXISTING COMMITTED ARTIFACT）

- 只读复核既有治理提交 `6adc111492dcbeb35e79475a3d69f6a63007e5bb`：父提交为要求的 `d53f84a...`，只修改 21 个授权 Markdown 文件，专用治理 worktree clean。
- `npm run check:context`、提交差异 `git diff --check`、stash 完整性和远端 ancestry 通过；治理 CI `33048729907` 与最新 Integration CI `33147816383` 的三个 job 均 SUCCESS，Playwright 报告上传跳过。
- ADR-028 仍为 `Accepted`，两项 deviation 为 `KEEP_AND_RECONCILE`，H7 仍 `OPEN`，R1 Quality Gate 仍 `BLOCKED / NOT_READY`；未执行真实 Provider 或凭据评测。
- 当前活动 worktree 的后续 UI/同步修改保持不变；本轮未创建新的提交、推送、PR、合并或部署。PR20 Live Provider Validation 继续 `BLOCKED / H7`。

## 2026-09-01 — SYNC-E2E-01 真实同步验收收口（DONE_LOCAL / UNCOMMITTED）

- 在 `D:\daily-assistant-runtime`（C: 盘之外）使用一次性 MySQL 8.4.11 完成真实 API 集成和 Web 双浏览器验收；API 结果为
  `17 files / 155 tests PASS`，API/Web/admin 服务在验收后已清理。
- 两个真实浏览器完成待办创建、编辑、删除/恢复传播；离线创建在重连后收敛为真实服务端 ID；同时离线编辑触发真实
  `VERSION_CONFLICT` 并在冲突页选择保留服务端；第二用户隔离通过。
- 375/390/430/768/1440 五种 viewport 均无横向溢出；清理日志后无 console error/warning，相关 sync/task 请求均返回 200。
- 现有完整 Web smoke 仍为 `22 passed / 22 failed`，不作为本轮同步验收通过的替代；未创建提交、推送、PR 或部署。下一项建议为
  `QUALITY-R1-GOVERNANCE-RECONCILIATION` post-write review gate。

## 2026-08-31 — SYNC-01 429 限流与失败退避修复（DONE_LOCAL / UNCOMMITTED）

- 拆分同步状态事件与本地变更事件，避免失败状态更新被误判为本地写入并触发新的强制同步。
- 保留 HTTP 429 状态；限流后暂停自动同步 60 秒，普通失败采用指数退避，手动重试仍可立即执行，并将页面提示改为已暂停自动重试。
- 补充同步请求错误、事件原因和协调器退避测试；Web lint、typecheck、build 通过，Web 全量单元测试 `21 files / 116 tests PASS`。
- 真实浏览器中的受控 429 响应复测通过：点击重试后连续观察 10 秒无新增同步请求；该检查只验证客户端行为，真实双浏览器传播尚未重跑，不宣称实时同步已完成。

## 2026-08-31 — SYNC-E2E-01 真实验收检查点（PAUSED / BLOCKED_429）

- 在 `D:\daily-assistant-runtime`（C: 盘之外）使用一次性 MySQL 8.4.11 完成真实 API 集成验收：17 个测试文件、155 项全部通过。
- 既有完整 Web smoke 实际结果为 22/44 通过、22/44 失败；失败集中在 AI Proposal、草稿确认、账号删除和 navigation-shell 选择器，未在本轮扩展修复范围。
- 两个真实浏览器进入待办页后，`/sync/changes` 与 `/sync/status` 返回 429，页面显示 `同步失败 / Too many requests`，并产生高频 429；
  用户中断了跨设备对象创建/传播，因此不能宣称双浏览器同步通过。
- 发现同步失败后缺少 429 专用轮询冷却/退避；下一项应建立 `SYNC-01-429-BACKOFF-REMEDIATION`，完成后再补跑双浏览器、离线、冲突/墓碑和五宽度验收。
- 验收服务已清理；WEB-UX-02/03/03.1、SYNC-01、SYNC-API-01 既有未提交修改保留，未提交、推送、创建 PR 或部署。

## 2026-08-31 — SYNC-E2E-01 真实同步环境验收（BLOCKED / NOT_RUN）

- 完成状态恢复和运行条件核对：`TEST_DATABASE_URL`、`E2E_DATABASE_URL`、`DATABASE_URL` 均未设置，
  本机没有 MySQL/API/Web 监听服务；已有 E2E 启动脚本会拒绝在缺少专用测试库时启动。
- 真实 MySQL API 集成、双浏览器同步、离线恢复、冲突/墓碑、用户隔离和五个 viewport 的真实浏览器检查
  均未运行；没有以 API mock 结果替代真实数据库验收。
- 未修改业务代码或同步协议，未创建提交、推送、PR 或部署；等待专用测试数据库环境。

## 2026-08-31 — SYNC-API-01 增量同步游标契约修正（本地未提交）

- `/sync/changes` 现在对每个非空页（包括非空末页）返回基于最后一条 `(updatedAt,id)` 变更生成的非空不透明游标；
  只有空页返回 `nextCursor: null`。
- 同步共享 TypeScript 类型、OpenAPI 条件 schema、API 文档和 WP7 集成测试；未修改 Prisma、数据库 schema、WebSocket/SSE、
  消息队列或既有 Web 同步 fail-closed 保护。
- API/契约/Web 定向测试通过；`TEST_DATABASE_URL`/`E2E_DATABASE_URL` 缺失，真实数据库集成和双浏览器同步未验证。
- 根 `npm run quality` 在既有 dependency audit（`@prisma/adapter-mariadb`、`mariadb`）处失败；未创建提交、推送、PR 或部署。

## 2026-08-29 — SYNC-01 实时同步整改（本地未提交 / API 契约阻塞）

- `apps/web` 增加统一同步协调器：登录、路由进入、focus、visibility 恢复和联网触发主动拉取；在线可见页面每 7 秒轮询，
  对并发 pull/flush 去重并保护游标不倒退。
- 同步成功按实体类型刷新 planner、finance、drafts、trips store；同步徽标显示最近同步、待同步、失败和冲突，既有离线队列继续保留。
- 复核现有 `/sync/changes` 发现非空末页返回 `nextCursor: null`，缺少可由前端安全持久化的终止游标；未修改后端或伪造游标，任务保持 BLOCKED。
- Web lint/typecheck/unit（21 files / 112 tests）/build、context、diff-check PASS；真实数据库 E2E 与双浏览器同步 NOT_RUN。
- 根目录 `npm run quality` 未通过：既有 dependency audit 拒绝未批准的高/严重包
  `@prisma/adapter-mariadb`、`mariadb`；本次未修改依赖文件。

## 2026-08-29 — WEB-UX-03.1 验收收口（本地未提交）

- 详情页、待办、日程、提醒列表删除增加明确二次确认；删除后不再用客户端当前时间或本地 version
  推导墓碑，而是 DELETE 后读取服务端对象并同步详情与共享 Planner store；离线删除继续走既有本地队列。
- 补齐日程/提醒编辑、删除、恢复、失败重试和共享 store 测试；新增列表删除确认覆盖。Web unit 为
  20 files / 100 tests。
- mocked browser PASS（含日程/提醒编辑、删除确认、恢复、返回、刷新、Back、非法 returnTo 和五个宽度）；
  `E2E_DATABASE_URL` 缺失，真实数据库 E2E 与跨浏览器同步验证均未运行。
- 只读重核当前远端 Integration HEAD 为 `299b1f71debbd5a3140d1ee19f9781372e67134b`；未创建提交、
  推送、PR 或部署。

## 2026-08-29 — WEB-UX-03 核心功能闭环整改（本地未提交）

- 用户端 PlannerDetailView 支持待办、日程、提醒的编辑、完成/取消、重新安排、软删除/恢复；成功后
  更新当前详情和共享 Planner store，失败显示错误与重试入口。
- 编辑页面改用初始表单快照判断 dirty；列表/详情来源通过站内 `returnTo` 传递，返回按钮文案按实际
  目标动态显示，路由非法返回目标安全回退。
- 统计入口改为“账单明细”，保留真实 CSV 导出页面；补充页面/单元测试与 navigation-shell E2E。
- Web lint、typecheck、18 个单元测试文件共 90 项、build、Prettier、context/diff 检查通过；浏览器
  使用本地 API mock 验证了操作、刷新、Back、非法 returnTo 和 375/390/430/768/1440 宽度。
- `E2E_DATABASE_URL` 缺失，真实数据库 E2E 未运行；未创建提交、推送、PR 或部署。

## 2026-08-27 — QUALITY-R1 Governance Approval / Normative Freeze Write（本地未提交）

- Dada 明确批准 ADR-028、PR20-03A/#22 与 PR20-03B/#23 的 `KEEP_AND_RECONCILE` disposition，
  并授权规范 Markdown 冻结写入。
- 当前 Integration 为 `codex/v15-integration-foundation@d53f84a…`；PR20 Adapter Integration
  为 `DONE_INTEGRATION`，PR20 Live Provider Validation 为 `BLOCKED / H7`。
- H7 保持 `OPEN`，继续阻塞真实 Provider calls、real credential/secret use、real-data/provider
  evaluation、Provider enablement、REL-04 和 R1 advancement；R1 Quality Gate 仍为
  `BLOCKED / NOT_READY`；REL-02/03/04 仍为 `BLOCKED / NOT_STARTED`。
- Integration CI run `33043413216` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  `supply-chain-governance` 与 `pr6a-mysql84-evidence` 存在，但 Playwright report upload 被跳过。
- docs/40 升为 V1.2；ADR-026/027 normative content、PR19 V10 scope、实现/数据库/CI/环境、
  commit、push、PR、merge、部署和 stash 未改；当前停在 `NORMATIVE FREEZE POST-WRITE REVIEW GATE`。

## 2026-08-27 — QUALITY-R1 Governance Reconciliation Gate 1（历史前置记录）

- 从远端只读重新核验 `codex/v15-integration-foundation@56ffd3dc…`，在独立
  `D:\daily-assistant-worktrees\quality-r1-governance-draft-write` worktree 执行治理草案写入。
- 记录 PR19（GitHub PR #18）已达到 `DONE_INTEGRATION`，以及 PR20-01/#20、PR20-02/#21、
  PR20-03A/#22、PR20-03B/#23 已进入 Integration 的 adapter integration 事实。
- 新增 ADR-028（`PROPOSED / AWAITING_DADA_APPROVAL`）和
  `QUALITY-R1-GOVERNANCE-RECONCILIATION`（`DRAFT / AWAITING_APPROVAL`）；提出但未生效的
  两阶段语义为 adapter integration `DONE_INTEGRATION`、live Provider validation `BLOCKED / H7`。
- PR20-03A/#22 与 PR20-03B/#23 historical scope deviation 保持
  `PENDING_DADA_DISPOSITION`；`KEEP_AND_RECONCILE` 仅为建议值。canonical R3 PR22/PR23 未修改。
- Integration CI run `33035100661` 的 `quality`、`db-validation`、`browser-qa` 均 SUCCESS；
  artifacts 为 `supply-chain-governance` 与 `pr6a-mysql84-evidence`，browser report upload 被跳过。
- H7 保持 `OPEN`，R1 Quality Gate 保持 `BLOCKED / NOT_READY`；docs/40 V1.1、ADR-026/027、
  apps、packages、Prisma/migration、CI、环境、commit、push、PR、merge、部署和 stash 未改动。
- Gate 1 在 `COMMIT AUTHORIZATION GATE` 停止。

## 2026-08-12 — PR2 AI DB Expand 最终本地验收（DONE / DONE_LOCAL / UNCOMMITTED）

- AI-DECISION-001 已通过 PR #12 合入 integration（`c4cca65bcd2ba71d93f948bf1c8731179fbb7fad`，
  CI 218 SUCCESS），PR2 获准开工。
- schema 新增 `AiRequestStatus`/`AiProposalStatus`/`AiOperationType`/`AiOperationStatus`/
  `AiProviderAttemptStatus` 五枚举与 `ai_requests`/`ai_proposals`/`ai_operations`/
  `ai_provider_attempts` 四表（User/DraftRecord 反向关系、两处 Draft SetNull、逻辑 proposalId 无 FK）。
- 新增单一 additive migration `20260812120000_v15_expand_ai`（无 destructive DDL、无 backfill）。
- 新增 `v15-ai-expand.integration.test.ts`（MySQL 8.4 专项：列类型/enum、四 unique、级联、
  Draft SetNull 与独立、事务回滚、并发重复、禁用字段/循环 FK、startedAt anchor、旧表结构未变）。
- account-deletion service 在 DraftRecord 前显式删除 `AiRequest` roots（DEC-PR2-04），
  open007 测试 seed 四表并断言清理后四表 0、tombstone 仍 DELETED。
- `tasks/PR2.md` 记录 DEC-PR2-01..04、logical invariant、范围、验证与授权边界。
- Oracle MySQL 8.4.9 fresh empty DB 从 0 应用 10 migrations；focused AI 12/12、account deletion 11/11、
  full DB integration 15 files / 117 tests PASS，0 skipped；四表 residual 0，User tombstone 保持 `DELETED`。
- 验证中最小修复 `v15-ai-expand.integration.test.ts` 三个 `created_at DEFAULT CURRENT_TIMESTAMP(3)` 漏断言；
  `quality`、`check:context`、`git diff --check`、final review PASS，临时资源 residual 0；未 add/commit/push/PR/merge/部署。

## 2026-08-11 — AI-DECISION-001 v1.0 Final 本地落地

- PR6a 已通过 PR #11 达到 `DONE / DONE_INTEGRATION`，integration HEAD 已核验为
  `01292ef7a6bcf97addfd139fe39a3576fc05f9c9`；当前任务切换为 AI-DECISION-001。
- 新增 Accepted ADR-027 与任务契约，冻结 DeepSeek→阿里云百炼 / Qwen→OpenAI（仅对照）的
  候选顺序、五个模型候选、服务端 AiProviderAdapter 调用路径、credential/唯一 whitelist/
  logging/retention 边界、失败保留输入和 Proposal 最终确认链。
- 冻结 timeout 15 seconds、最多 retry 1 次、rolling 20 requests 熔断策略、每用户
  ¥3/¥5 monthly warning/hard 与总体 ¥30/¥50 monthly warning/hard，以及 200 条非真实评测数据规范。
- provisional thresholds 为 Schema success `>=99%`、无需完全重录 `>=85%`；四项 immutable
  safety thresholds 不得被 PR20 降低。当前不冻结唯一 Provider，PR20 后 final provider/model/
  effect thresholds 仍需再次人工批准。
- 本任务只落地策略，状态为 `DONE / DONE_LOCAL`；未修改代码、Prisma/migration、正式 CI、依赖或
  lockfile，未访问 credential、执行真实评测/调用、创建云资源、add、commit、push、PR、merge 或部署。

## 2026-08-10 — PR6a 临时 MySQL 8.4 验证入口（本地）

- 核验 PR #10 已合并，integration HEAD 为 `371a43d...`，同步 V15-CTRL-001
  `DONE_INTEGRATION` 与 PR6a 开工快照。
- Round 1 将 `npm run validate:mysql84:temporary` 收紧为 loopback-only；bootstrap 管理凭据与随机
  scoped DB user 完全分离，并加入 guard isolation、child env allowlist、全流脱敏、partial-create
  cleanup、Windows/POSIX 进程树终止、有界 readiness 和稳定退出码。
- focused tests 1 file / 26 tests PASS；MySQL 8.4.9 两次 fresh DB/user 均通过 9 migrations、
  14 files / 105 DB tests；failure exit 41、真实 SIGINT exit 60，四次 DB/user 残留均为 0。
- 四个本地 JSON evidence 与 `.sha256` sidecar 4/4 匹配；quality/context/diff 均通过，临时实例
  已停止且数据目录移入回收站。
- 未修改业务功能、Prisma schema/migrations、依赖或正式 CI；未 add、commit、push、创建 PR 或部署。

## 2026-08-10 — V15-CTRL-001 v2.1.1 Final 本地落地（未提交）

- 人工批准 V1.5 v2.1.1 Final、ADR-026 发布映射、REL-01/02 调整、PR18/20 范围、
  AI provisional/安全阈值、Task Selection Policy 和 main/tag 发布门禁。
- 本地将 PLANS 更新为自包含 v2.1.1，ADR-026 标为 Accepted，docs/40 升级 V1.1，
  execution-state 改为双维度状态与非实时快照语义，并同步必要派生文档。
- 本条记录不表示已 commit、push、更新 PR #10、merge、创建资源、部署、迁移或调用真实 AI。

## 2026-08-07 — PR #6 合并到 main

- PR #6（feat: add Aliyun OSS storage adapter）已 squash 合并到 main（merge commit `db5c5d3`），
  远程任务分支 `codex/aliyun-oss-storage-adapter` 已删除。
- main CI run `31158434661`：quality SUCCESS、browser-qa SUCCESS；本地 quality PASS、smoke 20/20。
- Aliyun OSS 适配器、`STORAGE_PROVIDER` 配置切换、`StorageKeyService` 与测试已进入 main；
  `LocalStorageAdapter` 仍仅用于本地与测试。
- 未创建真实 OSS Bucket/RAM/凭据；未执行真实上传/读取/删除与备份上传验证；staging 未创建、
  生产未部署；OPEN-006 仍为部分完成。

## 2026-08-07 — PR #6 创建与 CI 验证

- PR #6（feat: add Aliyun OSS storage adapter）已创建：base=main、
  head=codex/aliyun-oss-storage-adapter、head SHA `11614ba5d26fabc13595974471f0c13f642cb3a2`。
- quality 与 browser-qa 均 SUCCESS（run `31156557067`、`31155080018`）；mergeable=true、
  无冲突、未发现真实密钥或敏感配置；尚未合并到 main（当时状态；随后已 squash 合并，见下条）。
- 历史情况：最初因本地 `gh` 未登录无法创建 PR；后续状态：PR #6 已创建，CI 已通过。

## 2026-08-07 — OPEN-006 对象存储接入代码实现

- 新增 `AliyunOssStorageAdapter`（`apps/api/src/integrations/aliyun-oss-storage.adapter.ts`，
  ali-oss 6.23.0）：实现 `put/get/delete`，缺失对象删除幂等，错误不泄漏 AccessKey/正文。
- 新增 `STORAGE_PROVIDER=local|oss` 切换与必填校验；`NODE_ENV=production` 禁止 local
  （staging 门禁），缺失 OSS 配置启动失败。
- 新增 `StorageKeyService`：新附件键 `users/{userId}/attachments/{fileId}`，
  旧 `attachments/{userId}/...` 键兼容；上传仍由 API 代理，无需 OSS CORS。
- 新增/更新单元测试 22 项；`deploy/staging/.env.staging.example` 与 `.env.example` 同步。
- 未创建真实 Bucket/RAM、未完成真实连通测试；staging 未创建、生产未部署；OPEN-006 未关闭。

## 2026-08-07 — E2E 修复 PR #4 合并，main 全绿

- PR #4（E2E 时间助手 24 小时制修复）以 squash 方式合并到 main（`47c40c9`）。
- main CI run `31144549537`：quality SUCCESS、browser-qa SUCCESS。
- 状态文档 PR #5 分支已合入最新 main，同步 PR #4 已合并与 main CI 全绿。

## 2026-08-07 — PR #3 合并与 main 验证

- PR #3（test: automate browser release smoke checks）以 squash 方式合并到 main，
  merge commit `4fcc613`；V1 发布决策与 OPEN-009 自动化正式进入 main。
- main CI run `31143350121`：quality PASS；browser-qa 的 E2E 时间助手 12/24 小时制缺陷
  （`endsAt` 被格式化为 01:xx 早于 `startsAt`）已由 PR #4（`47c40c9`）修复，
  后续 main run `31144549537` quality/browser-qa 均 SUCCESS。
- 合并后本地验证：quality PASS、smoke 20/20、完整矩阵 70/70。
- OPEN-006 为唯一未决 Staging 外部决策；staging 未创建、生产未部署。

## 2026-08-07 — V1 发布决策固化 + OPEN-009 浏览器 QA 自动化

- 产品名：正式中文“日常助手”、英文“Daily Assistant”（OPEN-001）；统一产品配置
  `packages/config/src/index.ts`（PRODUCT），用户端/管理端/登录页/PWA manifest/元数据一致；
  技术 package 名不重构（OPEN-011 品牌显示名与技术标识分离）。
- 通知范围：V1 仅应用内提醒（OPEN-005），提醒页明确“仅应用内查看”，不再展示浏览器推送授权状态；
  `FakeNotificationAdapter` 仅用于本地与测试；Web Push/系统通知列为 V1.1 候选。
- OPEN-009：`@playwright/test` 1.62.1、`playwright.config.ts`、`tests/e2e`
  （auth/admin/home/deletion 10 个用例）、`scripts/start-e2e-services.mjs`
  （专用测试库 + 自动 generate/build/migrate/bootstrap + 三服务启动 + 健康等待 + 进程清理）、
  根命令 `test:e2e`/`test:e2e:smoke`/`test:e2e:headed`/`test:e2e:matrix`；
  CI 新增独立 `browser-qa` job（Node 24 + MySQL 8.4 + Chromium + 失败截图/trace/video 上传）。
- 稳定性修复：web 客户端 401 单飞刷新重试，避免会话轮换竞态；登录限流可配置
  （`LOGIN_RATE_LIMIT_MAX`，默认仍为 10）。
- 验证：本地 smoke 20/20；完整矩阵 70/70（Chromium 桌面/390 移动、Firefox、WebKit、1440/375/430）。

## 2026-08-07 — OPEN-007 合并到 main（PR #1）

- PR #1（feat: implement expired account deletion cleanup）以 squash 方式合并到 main，
  merge commit `6d9c888`；任务分支 `codex/open-007-deletion-cleanup` 已删除。
- 合并后本地 `npm run quality` PASS；main 远程 CI run `31136793516` PASS
  （quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 账户删除调度器默认关闭，staging 单实例验证后方可开启；staging 未创建、生产未部署。
- 合并后状态文档同步在 `codex/post-open-007-merge-status` 分支（PR 待用户确认）。

## 2026-08-06 — OPEN-007 账户期满删除清理实现完成

- 数据模型：`UserStatus` 新增 `DELETION_PROCESSING`；`users` 新增
  `deletion_scheduled_at`/`deletion_started_at`/`deletion_completed_at`/
  `deletion_attempt_count`/`deletion_last_error`/`deletion_lease_expires_at`；
  migration `20260806092920_open007_account_deletion_cleanup`。
- 申请删除：写入计划删除时间（默认 30 天，`ACCOUNT_DELETION_RETENTION_DAYS` 可配置）。
- 清理任务：`AccountDeletionService` 原子领取（状态+租约+尝试上限）、批量扫描、
  失败保留可诊断状态并可在租约过期后重试；`AccountDeletionScheduler` 受
  `ACCOUNT_DELETION_SCHEDULER_ENABLED` 开关控制；手工入口
  `npm run account-deletion:run`。
- 清理范围：sessions/device_credentials/分类/账户/账单/预算/草稿/附件/日程/待办/
  提醒/行程（含节点与行李）/sync_mutations 真实删除；附件先经 `StorageAdapter.delete`
  删除文件再删记录（文件缺失幂等成功）。
- 匿名墓碑：随机 `deleted_<hex>` 用户名、空显示名、随机 Argon2 密码散列、
  `status=DELETED`、`deletion_completed_at`；原账号名可重新使用；`AdminAudit`
  清空 JSON 与原因并保留最小审计事实。
- 取消删除：管理端 `POST /admin/users/:id/cancel-deletion`（仅 `DELETION_PENDING`、
  容量复查、`USER_DELETE_CANCEL` 审计），契约/OpenAPI/管理端已同步。
- 测试：API 测试 111/111（新增 8 个单元 + 11 个 OPEN-007 集成）；空库 8 migrations
  `prisma migrate deploy` 通过；CLI 演练通过。
- 文档：`docs/05`、`docs/06`、`docs/27`、`docs/28`、`docs/decisions.md` 与状态文件同步。

## 2026-08-06 — 正式 main 分支建立与推送完成

- 确认 `codex/wp8-release-prep` 完整包含 `codex/wp1-foundation`（`rev-list --left-right --count` = `0 42`，`merge-base` = `981aafc8`）。
- 从 `codex/wp8-release-prep` @ `42bcef0` 创建并推送正式 `main`（`git push -u origin main`）；main = origin/main = origin/codex/wp8-release-prep = `42bcef0`。
- main 推送触发 GitHub Actions run `31086031458` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 无 force push、无额外 merge commit、旧远程分支未改动；GitHub 默认分支随后已由用户切换为 main（`codex/wp1-foundation`、`codex/wp8-release-prep` 暂时保留）；暂不执行 staging/生产部署。

## 2026-08-06 — 发布准备第一阶段完成（推送 + 远端 CI 验证）

- 推送 `codex/wp8-release-prep` 到 `https://github.com/Dada-sys101/richangzhushou.git`（首推 `71b9f74`）。
- 首轮远端 CI run `31084434078` 失败：纯净环境缺 Prisma 生成客户端（`apps/api/src/generated`）与
  `packages/api-contracts` dist，typecheck 大量 TS2307/TS2339；本地因已有生成产物而通过。
- 最小修复 `.github/workflows/ci.yml`：quality 前执行 `prisma:generate` 与 contracts `build`；
  提交 `3e88808` 并推送；run `31084755305` PASS（quality、空库 migrate deploy、WP2 集成测试全部通过）。
- 未创建 PR、未部署；当时 origin 无 `main`、默认分支为 `codex/wp1-foundation`（后续已建立 main 并切换默认分支）。

## 2026-08-06 — 首页界面优化完成（docs/29）
- 首页改为“今日概览”（日期副标题）；未登录/登录失效/请求失败友好状态与按钮，
  不再展示后端技术错误文本。
- 顶部导航精简为首页/日程/待办/财务/行程/更多；移动端底部导航 5 项；
  快捷操作保留 4 项并统一图标；新增本月财务摘要、今日安排说明、空状态卡片。
- 同步状态支持已同步/同步中/同步失败并可重试；浅灰蓝背景 + 白色卡片 + 1280px 容器。
- 修复本地缓存日程未按日期过滤的既有缺陷（planner store 前端过滤）。
- 仅改前端；`npm run quality` PASS；用户端测试 15/15；浏览器 375–1440 无横向溢出；
  已提交 `68f3987` 并随 wp8/main 推送；未部署。

## 2026-08-06 — WP9 身份与录入简化本地验收通过（docs/28）
- 账号模型：`username`/`normalized_username`/`must_change_password`，邮箱列删除；
  删除 `recovery_codes`/`invite_codes`/`invite_redemptions` 表与邮件适配器；
  `system_settings` 仅保留 `max_active_users`；WP9 migration 含存量回填与回滚说明。
- 认证：登录改账号密码；新增 `POST /me/change-password`；删除注册/忘记密码/重置/自助重开；
  登录响应携带 `mustChangePassword`，未改密数据端点 403 `PASSWORD_CHANGE_REQUIRED`。
- 管理端：新增创建账号与重置密码（容量校验、强制改密、脱敏审计），
  `/admin/settings` 仅管理容量；邀请码与注册设置端点删除。
- 录入：删除 `/drafts/ocr`、OCR/Scan 适配器与 `AttachmentScanStatus`；
  附件保留上传/完成/删除与本地存储。
- 前端：用户端登录改“账号”、新增修改密码页、删除注册/找回/重置页与截图入口；
  管理端新增创建账号/重置密码，删除邀请码页。
- 验证：`npm run quality`、空库 7 migrations+seed、API 92/92、契约 125/125、
  浏览器登录/强制改密/管理端建号与控制台 0 错误、重启持久化全部通过。
- 已提交 `71b9f74` 并随 wp8/main 推送；未部署、未开始 OPEN-007。

## 2026-08-06 — 本机启动与访问验证完成（本地运行）
- API/Web/Admin 在本机运行（3000/5173/5174），本地 MySQL 8.4.9（3307）新建本地库 `daily_assistant_local`（6 migrations + seed）；演示账号 `demo@example.com` 登录、待办/记账读写与 API 重启持久化验证通过；`.env` 已备份，状态文档已更新，未提交、未推送、未部署。

## 2026-08-06 — 输出 WP8 可执行规划（docs/25）

- 新增 `docs/26-wp8-acceptance-report.md` 与 `docs/27-wp8-staging-release-checklist.md`：WP8 本地验收与发布清单。

## 2026-08-06 — WP8 全量质量与发布准备本地验收通过（docs/26/27）

- 契约/一致性：审计枚举补全 `DRAFT_BATCH_DISCARD`；数据字典补 `RecoveryCode`；端点清单补 `DELETE /me/sessions`；OpenAPI 72 路径与控制器一致，契约测试 132/132。
- 安全：生产强制 `CONFIRMATION_TOKEN_SECRET`；用户自助关号/申请删除/恢复码重开补写脱敏审计（`USER_CLOSE`/`USER_DELETE_REQUEST`/`USER_REOPEN`）；`.env.example` 补齐适配器与调度变量。
- 上传：新增 JPEG/PNG/WEBP 魔数校验；超大上传流改为 resume；wp4 测试适配并新增不匹配用例；扫描门控与悬空清理缺口如实记录。
- 可访问性/响应式：键盘路径、焦点、语义标签、role=alert、文字+图标状态、触控目标；375/390/430/768/1440 + 200% 缩放矩阵 Web 102/公开 30/管理端 42 全部无横向溢出。
- 回归：`npm run quality`、空库 6 migrations+seed、集成 63/63、浏览器主流程（注册/登录/记账/日程/行程）与离线排队→恢复→单条落库通过。
- 演练：备份恢复（mysqldump→隔离库→24 表一致）；账号删除（DELETION_PENDING、会话撤销、容量释放、脱敏审计；期满清理未实现，缺口记录）。
- 发布准备：staging 发布清单、监控告警清单、隐私/试用门禁（docs/27）；OPEN-001~011 全部记录，未宣称生产可用。
- 分支 `codex/wp8-release-prep`；本地提交；未推送、未部署、未创建生产资源。

- 新增 `docs/25-wp8-codex-execution-plan.md`：安全复审、上传复审、可访问性、
  响应式矩阵、OpenAPI/数据库/浏览器全量验证、备份恢复与账号删除演练、staging
  发布清单的可执行规划。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步、`.project/session.md`
  恢复指引与 `docs/progress.md` 未开始项。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP7 PWA 与离线同步本地验收通过

- 契约：Sync 变更流/幂等 mutations/状态端点、`SyncEntityType`/`SyncAction`
  枚举、`CURSOR_INVALID`/`MUTATION_BATCH_TOO_LARGE`/`MUTATION_UNSUPPORTED`
  错误码，分类/账户/预算创建增加 `clientMutationId`；契约测试 132/132。
- 数据：`sync_mutations` 表（`user_id + client_mutation_id` 唯一、
  `request_hash`/`result_ref`/`status`）与同步实体游标索引；空库 6 migrations
  部署与 seed 通过。
- 后端：`(updatedAt, id)` 键集游标变更流（含墓碑）、幂等批量
  `POST /sync/mutations`、版本冲突返回服务端当前实体、`GET /sync/status`、
  跨用户 404/管理员 403/限流；集成测试 63/63（WP2–WP7）。
- 前端：IndexedDB 用户隔离缓存、离线写入队列、同步器（指数退避/手动重试/
  401 自动刷新）、SyncBadge、离线横幅、`/sync/conflicts` 冲突页、离线会话
  与退出/关闭账号清理；Service Worker 仅缓存应用外壳。
- 验收：`npm run quality`、空库 migration+seed、集成 63/63、浏览器
  QA-SYNC-001~004 与 375/390/430/768/1440 矩阵 20/20 全部通过
  （报告见 `docs/24-wp7-acceptance-report.md`）。
- 分支 `codex/wp7-pwa-sync`；未推送、未部署、未创建生产资源、未进入 WP8。

## 2026-08-06 — 输出 WP7 可执行规划（docs/23）

- 新增 `docs/23-wp7-codex-execution-plan.md`：应用安装、IndexedDB 本地缓存、离线
  写入队列、同步游标、幂等批处理、冲突页面与账号退出清理的可执行规划。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步、`.project/session.md`
  恢复指引与 `docs/progress.md` 未开始项。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-06 — WP6 行程本地验收通过

- 契约：Trips/TripItems/PackingItems OpenAPI 请求/响应/DTO/枚举（`TripItemType`
  = TRANSPORT/STAY/ACTIVITY/FOOD/OTHER）、`TripExpenseSummary`、
  `TripDetailResponse`、`TripItemOutOfRangeWarning` 与 `Transaction.tripId`；
  契约测试 127/127。
- 数据：新增 `trips`/`trip_items`/`packing_items` 表与 `transactions.trip_id`
  外键/索引；migration `20260806011520_wp6_trips` 空库部署与 seed 通过。
- 后端：行程/节点/行李 CRUD（软删除/恢复、幂等、版本并发、position 排序）、
  超范围节点“未确认不保存、确认后保存并返回提示”、服务端定点费用汇总
  （只计 CONFIRMED 未删除，退款冲减）、行程详情返回日期范围内日历事件、
  交易关联行程（跨用户 404）。
- 前端：行程列表/详情（费用汇总、节点、行李、关联账单、日历跳转）、记账表单
  行程选择、首页“行程/最近行程”入口；错误与网络失败状态沿用统一展示。
- 安全：跨用户 404、管理员 403；集成测试 55/55（WP2–WP6）。
- 验收：`npm run quality`、空库 5 migrations+seed、集成 55/55、浏览器矩阵
  10/10 无横向溢出（行程列表+详情，375/390/430/768/1440），主流程与控制台
  仅预期 400 校验日志（报告见 `docs/22-wp6-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP7。

## 2026-08-06 — 输出 WP6 可执行规划（docs/21）

- 新增 `docs/21-wp6-codex-execution-plan.md`：行程/节点/行李/账单关联/预算与实际
  支出/日程关联入口的可执行规划（前置与授权、只读检查、设计约束、8 个 checkpoint、
  强制测试与停止条件、风险与未决）。
- 同步 `docs/README.md` 索引、`.project/context.md` 下一步与 `.project/session.md`
  恢复指引；`docs/progress.md` 未开始项补充规划引用。
- 仅文档改动；未提交（等待授权）；未推送、未部署。

## 2026-08-05 — WP5 日程、待办与提醒本地验收通过

- 契约：Calendar/Tasks/Reminders OpenAPI 请求/响应/DTO/枚举（`CalendarEventStatus`、
  `ReminderScheduleType`、`ReminderTargetType`）与契约测试 118/118。
- 数据：新增 `calendar_events`、`tasks`、`reminders` 表与 migration
  `20260805095154_wp5_calendar_tasks_reminders`；seed 增加演示日程/待办/提醒。
- 后端：日程 CRUD（时间校验、重叠提示、软删除/恢复）、待办 CRUD 与状态机
  （完成/取消时间、过期计算）、提醒 CRUD 与重复展开、提醒调度器（原子领取、
  防重、失败重试上限、`FAILED`/`SUPPRESSED`）、`NotificationAdapter` 与本地假实现。
- 前端：今日安排卡片、日程页、待办页、提醒设置页与通知权限降级提示。
- 安全：跨用户 404、管理员 403；幂等/版本冲突与 Finance/草稿一致。
- 验收：`npm run quality`、空库 4 migrations+seed、集成 48/48、浏览器矩阵
  20/20 无横向溢出（报告见 `docs/20-wp5-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP6。

## 2026-08-05 — WP4 快捷指令、OCR 与统一录入本地验收通过

提交：`7cb7656`、`4be9524`、`4cd75e9`（分支 `codex/wp4-shortcuts-ocr`）

- 契约：补全 Shortcuts/Drafts/Attachments OpenAPI 请求/响应/DTO/错误码，
  新增 `ShortcutScope`、`AttachmentScanStatus`、`AttachmentOwnerType`、
  `DraftTargetType` 与 WP4 错误码；契约测试 112/112。
- 数据：`DeviceCredential`（tokenHash 唯一、scopes JSON、revokedAt）、
  `Attachment`（objectKey/uploadTokenHash 唯一、scanStatus 门控）、
  `DraftRecord`（clientMutationId 唯一、resultId）；migration
  `20260805085724_wp4_shortcuts_ocr` 空库部署与回滚说明。
- API：设备凭证创建/列表/撤销 + Bearer 守卫；快捷指令幂等草稿与今日支出；
  草稿文本解析/OCR/CRUD/确认/丢弃/批量二次确认；附件上传意图/内容上传/完成/删除；
  `StorageAdapter`/`OcrAdapter`/`ScanAdapter` 接口与本地假实现。
- 安全：跨用户 404、管理员 403、数据库无明文令牌、批量丢弃审计。
- 前端：快捷记录（文本/截图）、草稿中心与 DraftReviewCard、快捷指令配置页；
  OCR 失败与网络错误降级状态。
- 验收：`npm run quality`、空库 migration+seed、集成测试 41/41、浏览器 5 宽度
  矩阵 25/25 与主流程全部通过（`docs/18-wp4-acceptance-report.md`）。
- 未推送、未部署、未创建生产资源、未进入 WP5。
- 修复：附件非法类型错误码改由服务层返回 `ATTACHMENT_TYPE_NOT_ALLOWED`
  （`c1cfc33`）。

## 2026-08-05 — 持久化项目状态恢复机制（v2）

提交信息：`chore: add persistent project state recovery workflow`

- `AGENTS.md` 合并为 Project State Recovery / Required Workflow Before Every Task / Task Completion State Updates / Safety Rules 四章。
- `.project/context.md` 按新规范重写（含 Last Verified Commit、session 职责）。
- 新增 `.project/session.md` 与 `.project/decisions.md`（ADR-001~009）。
- 新增 `scripts/check-project-context.mjs`（`npm run check:context`，已并入 quality）与 `scripts/pre-commit-context-check.mjs`；提供可选 `.githooks/pre-commit` 示例。
- 同步 README、docs/progress 与根状态文件；未修改业务代码。

## 2026-08-05 — WP3 基础记账与今日财务本地验收通过

提交：`c1c8f92`、`3fcf1df`、`e7b971c`、`3fe6739`、`3db5b40`（分支 `codex/wp3-finance`）

- 契约：Finance OpenAPI 请求/响应/DTO/错误码、共享类型与契约测试；`DUPLICATE_RESOURCE` 错误码与 `POSSIBLE_DUPLICATE` 警告。
- 数据：`Category`、`FinancialAccount`、`Transaction`、`Budget` 表与 `CategoryKind`、`FinancialAccountKind` 枚举；migration `20260805080803_wp3_finance`；seed 支持演示用户与默认分类/账户。
- API：账单 CRUD/软删除/恢复、疑似重复提示（10 分钟窗口）、退款引用原账单或标记无原单、分类/账户归档、预算 CRUD 与 `Asia/Shanghai` 自然月校验、统计摘要与今日支出、CSV 导出（UTF-8 BOM、安全文件名、用户隔离）。
- 安全：Finance 路由要求 `USER` 角色（`UserOnlyGuard`），管理员访问用户内容 API 返回 403；所有查询强制 `userId` 范围。
- 前端：今日财务卡片、账单列表/表单、分类、账户、预算页面与 CSV 导出；校验失败与网络失败有明确错误提示。
- 修复：控制器 DTO 元数据（`import type` → 运行时导入）与非 JSON 错误体解析。
- 验收：`npm run quality` 通过；便携 MySQL 8.4 空库 `prisma migrate deploy` + seed 通过；集成测试 29/29；浏览器 5 宽度矩阵 30/30 与主流程/错误状态通过；`git diff --check` 通过（详见 `docs/16-wp3-acceptance-report.md`）。
- 未推送、未部署、未进入 WP4。

## 2026-08-05 — 跨任务自动恢复项目状态机制

提交信息：`docs: add automatic project state recovery workflow`

- `AGENTS.md` 新增 Project State Recovery（15 条）、Required workflow before every task（Step 1–8）、Task completion state updates、Task priority rules。
- `.project/context.md` 规范化为固定结构（Last Updated / Repository State / Project Summary / Current Development Stage / Last Completed Task / Current Task / Next Recommended Task / Completed Work / Remaining Work / Blockers / Known Issues / Verification Status / Recent Changes / Important Constraints / Handoff Instructions）。
- 同步更新 `docs/progress.md`（WP3 状态改为进行中）与根状态文件。
- 未修改业务代码；保留未提交的 `apps/api/src/finance/finance.controller.ts` 修改。

## 2026-08-05 — WP2 身份、容量与账号生命周期（本地完成）

提交：`ee0d3c9`（分支 `codex/wp2-identity-capacity`）

- 契约先行：OpenAPI、共享类型、错误码与账号状态机更新并通过契约测试。
- 新增 Prisma 实体与首个 migration：`SystemSetting`、`User`、`Session`、`RecoveryCode`、`InviteCode`、`InviteRedemption`、`AdminAudit`。
- 后端：Argon2id 密码、访问令牌内存保存、刷新令牌 HttpOnly Cookie 轮换/撤销、密码恢复、账号关闭/暂停/恢复/删除申请。
- 容量：SystemSetting 单例锁、固定锁顺序、邀请码同事务兑换、有上限重试；注册失败不消耗邀请码。
- 管理端：角色守卫、原因必填、脱敏审计；管理员默认不能访问用户生活数据正文。
- 前端：用户端注册/登录/忘记密码/重置密码/账号页；管理端概览/邀请码/用户/设置/审计页。
- 质量：`npm run quality` 通过；便携 MySQL 8.4 空库 migration 与 `TEST_DATABASE_URL` 集成测试通过；浏览器 5 宽度矩阵通过。
- 未推送、未部署、未创建生产资源；WP3 未实现。

## 2026-08-05 — 推送 WP1 分支到远端

提交信息：`docs: record wp1 branch push`

- 用户授权后推送 `codex/wp1-foundation`（提交 `518477e`）到 origin。
- GitHub Actions 首次运行结果待确认（本机 `gh` 未登录）。
- 推送期间发现本机 Git 全局代理不可用，使用系统代理临时覆盖；未修改全局配置。

## 2026-08-05 — 项目上下文与开发交接文档（本次提交）

提交信息：`docs: establish project context and development handoff`

- 新增 `.project/context.md` 实时上下文文件。
- 新增 `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`。
- 完善 `AGENTS.md`：计划先行、范围控制、兼容性检查、验证要求、进度更新、独立提交与不确定标注。
- 更新 `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、根 `CHANGELOG.md`、`docs/README.md`。
- 未修改业务代码，未创建或变更生产配置。

## 2026-08-05 — WP1 工程骨架与共享契约

提交：`6169ac0`（分支 `codex/wp1-foundation`）

- 创建 npm workspaces、Vue PWA 用户端、Vue Element Plus 管理端和 NestJS 单体 API 空壳。
- 创建共享配置与 API 契约包，对齐数据字典枚举、字符串 ID、ISO 8601 时间与定点金额边界。
- 将规划端点转换为 OpenAPI 3.1 基线（59 路径 / 86 操作）。
- 创建 Prisma 7 + MySQL schema 基线（仅枚举）、安全 `.env.example`、本地开发说明与 CI。
- 通过本地格式、Lint、类型、单元/契约/HTTP 冒烟测试、全部 workspace 构建、Prisma/OpenAPI、离线 migration diff 与依赖审计；详见 `docs/13-wp1-acceptance-report.md`。
- 本机缺少 MySQL/Docker，真实空库 migration deploy 未执行；未推送、未部署、未进入 WP2。

## 2026-08-05 — 初始化项目

提交：`5d52395`

- 初始化独立 Git 仓库与 WP0 规划文档体系（`docs/00`–`docs/12`）。
- 建立根级计划、状态、任务、验收、架构与恢复文件。

## 2026-08-04 — WP0 规划（提交前的本地规划过程记录）

- 完成产品范围、页面流程、业务规则、管理权限、数据模型、API、架构、安全、UI、测试、部署、风险与开发交接文档。
- 将 V1.0 拆分为 WP1–WP8；保留产品名称、远端仓库、供应商、部署地域与数据保留政策为未决项。

## 2026-09-08 — Prisma candidate delivery authorization

- 用户明确授权继续候选提交、推送及 CI；不包含 merge、部署或 R1 门禁关闭。
- 本次交付仅包含 15 个已审阅的依赖、工具链、安装治理、CI、测试及 README 文件；原有 15 个混合 Markdown 修改保留本地，不混入候选提交。
- 提交前治理测试 30/30、git diff --check 与 staged diff 检查通过。许可证人工结论和发布环境证据仍待完成。
- Delivery: DONE_COMMITTED / DONE_PUSHED / CI_PASS；commit 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，parent 1b8354575cc195584af5ee3b1fe8882eda8c3bdd；PR #25 已自动更新；PR CI 34181552275、push CI 34181550054 均 SUCCESS；各自 quality、db-validation、browser-qa 全部 PASS。此条覆盖前文候选 UNCOMMITTED / CI_NOT_RUN 的历史快照；R1 仍 BLOCKED / NOT_READY。

## 2026-09-08 — PR25 merge and scoped license decision

- 用户明确接受本次许可证处理方案：保留第三方许可证和版权声明，不修改第三方库源码，按实际交付内容核对工具链组件；对外分发后端包/容器或修改库时重新评审。此为当前范围的人工决定，不是对任意未来分发的法律批准。
- 用户独立授权合并 PR #25；已匹配 candidate HEAD 1e8bd5fe2d5e7312993f7e8b618a098eaa74b69e，并核验 PR/push 两轮 quality、db-validation、browser-qa 全绿。
- PR #25 于 2026-09-08T03:00:13Z MERGED；merge commit 6515b8fd0f13969a0e434d3d8223f60a82cb0310，远端 codex/v15-integration-foundation HEAD 已一致核验。Candidate delivery: DONE_INTEGRATION。合并后 CI 34181985716 SUCCESS，quality、db-validation、browser-qa 全部 PASS：https://github.com/Dada-sys101/richangzhushou/actions/runs/34181985716 。
- 本记录覆盖前文 PR_OPEN、候选 UNCOMMITTED/CI_NOT_RUN 和 LICENSE_APPROVAL_PENDING 的历史快照；本地原有 15 个混合 Markdown 修改保留，当前工作分支不切换，不额外提交记录。
- R1 仍 BLOCKED / NOT_READY：实际发布包许可证声明、目标环境差异与部署验收尚未完成。本次未授权或执行部署、真实数据库迁移、公网切换或发布门禁关闭。

## 2026-09-08 — Release bundle preparation

- 基于已合并且 CI 全绿的 6515b8fd0f13969a0e434d3d8223f60a82cb0310，在 D:/daily-assistant-release-6515b8f 导出精确源码并完成独立 npm 11.18.0 安装（audit 0）、Prisma generate、全部 workspace build/PWA、SBOM 1043 components 校验和许可证清单。
- 准备包：D:/daily-assistant-release-6515b8f/daily-assistant-6515b8f-preparation.tar.gz；说明与逐文件校验：bundle/RELEASE-README.md、bundle/SHA256SUMS.txt。LOCAL_BUNDLE_PREPARED / TARGET_ENVIRONMENT_UNVERIFIED / NOT_DEPLOYED。
- 许可证原文收集覆盖 Windows 已安装包中的 1051/1083；32 包无顶层许可证文件，不能推定无许可或替换通用文本。Linux 原生依赖未打包，最终 Linux 包须按锁文件重建并核对实际交付 notices。
- 相比原服务器基线 299b1f71，Prisma schema/migrations 无变化。未操作服务器、读取真实凭据、执行数据库迁移或部署。下一步只读核对目标路径、Node/npm、数据库实际 transport、代理和备份；不要为未使用的 TLS/代理构造额外门禁。
- 原有 15 个 Markdown 修改保留，当前源码包不含它们；本次无新提交或推送。R1 保持 BLOCKED / NOT_READY。
## 2026-09-08 — 私有预览部署暂停（切换前）

- `6515b8f` 部署准备仅写入远端源码 artifact、隔离 release preparing 目录及其 npm 11.18.0 工具；没有进入发布切换。
- 因 SSH banner exchange 持续超时而暂停；站点/API 保持 200。未执行 symlink 切换、服务重启、migration、域名或功能开关变更，R1 保持阻塞。

## 2026-09-08 — 私有预览部署与业务 smoke 完成

- Integration `6515b8f` 已部署；Linux audit/SBOM/build、API/Web/Admin 入口及真实业务 smoke 通过。
- 登录、首次改密、待办、日程、账单与刷新持久化通过，浏览器阻塞错误为 0。
- 一次性测试用户及级联数据清理为 `deleted=1 / remaining=0`；临时凭据已删除，服务保持健康。

## 2026-09-08 — R1/readiness 门禁归一

- 确认 readiness 实现属于已批准 REL-01 D7 下的 REL-03 工作，不倒置为 REL-02 前置阻塞；当前私有预览保留启动前数据库检查、liveness 和业务 smoke 组合证据。
- 已完成的依赖、许可证当前范围决定、CI、部署和业务 smoke 从当前阻塞清单移除。R1 仍等待 H1/H2 豁免是否覆盖 advancement 的人工决定；REL-02 资源/费用、公网入口和后续发布门禁保持独立。

## 2026-09-08 — R1 Quality Gate 获批

- 用户明确批准 H1/H2 对本次 R1 advancement 豁免；状态为 `WAIVED_FOR_R1 / UNVERIFIED`，不记为真机通过。
- R1 Quality Gate 更新为 `APPROVED / DONE`，canonical task 转为 `REL-02 Authorization / BLOCKED / RESOURCE_FEE_AUTHORIZATION_PENDING`。本决定未授权创建云资源、产生费用、部署 Staging、切公网或扩大 Provider。

## 2026-09-08 — 独立 Staging 豁免

- 用户明确决定取消独立 Staging 资源建设；REL-02 更新为 `CANCELLED / SEPARATE_STAGING_WAIVED`，不新增云资源或费用。
- 现有 Alibaba 私有预览作为验证环境，canonical task 转为 `REL-03 Private Preview Readiness / READY`。公网、生产、Provider 扩展与未来扩容仍需独立门禁，并在届时重新评估独立 Staging。
## 2026-09-12 — MOBILE-C2 应用内弹窗与反馈

- MOBILE-C1 PR #31 已合并为 Integration `7ce7805`，合并后 CI `34675913987` 全绿。
- 新增可访问的应用内弹窗、确认服务、操作表和 Toast 基础组件；将现存业务 `window.confirm` 替换为统一中文确认，保留浏览器关闭标签页时的平台 `beforeunload` 安全提示。
- 焦点进入/恢复、Tab 约束、Escape、滚动锁定和并发确认服务均有专项测试；完整 quality 与差异检查通过，尚未提交、推送、创建 PR 或部署。
- 提交 `4b873f5` 与 E2E 修正提交 `999426f` 已进入 PR #32；push run `34676910173`、PR run `34676911672` 的 quality、db-validation、browser-qa 全部通过。
- PR #32 HEAD `3a07d28` 已部署至私有预览 release `/opt/daily-assistant-preview/releases/3a07d280-20260912T0608Z`；发布前备份、公开入口、API、深链接、静态资源与日志复核通过。
- 根据实机截图，将应用弹窗从移动端贴底调整为全宽度居中，并修正面板背景变量、遮罩、文字对比度与按钮强调；本地完整 quality 通过，尚未提交或重新部署。
- 弹窗修正提交 `b620850` 的 CI runs `34678001648`、`34678004033` 全绿，并在备份后部署至 `/opt/daily-assistant-preview/releases/b6208500-20260912T0627Z`；发布后检查通过。
- PR #32 合并为 Integration `e4b6567`，合并后 CI run `34678903476` 全绿；新增 `tasks/MOBILE-C3.md`，冻结自定义日期时间控件的范围与门禁。
- MOBILE-C3 新增应用内日期、月份和日期时间选择器；首批替换账单、预算、行程列表、日程、待办和提醒页面的浏览器原生日期控件。
- 完成计划详情、行程详情和 AI 卡片日期字段迁移，用户端源码不再直接使用 `date`、`month` 或 `datetime-local`。

- MOBILE-C3 PR #33 HEAD `7ec404d` 已推送；修正 Playwright 对自定义日期时间弹窗的操作方式，两组 CI runs `34680683732`、`34680685271` 的 quality、db-validation、browser-qa 全部通过。

- PR #33 状态证据提交后 HEAD 为 `b18b91d`，两组后续 CI runs `34680908365`、`34680910314` 仍全绿。候选已在受保护备份后部署至 `/opt/daily-assistant-preview/releases/b18b91d0-20260912T0735Z`，并通过入口、深链接、API、PWA 资源与日志检查。

- 2026-09-12 用户确认 iPhone/Android 实机日期、月份和日期时间控件验收通过；MOBILE-C3 更新为 `ACCEPTED / READY_TO_MERGE`，PR #33 合并仍需独立授权。
- PR #33 已合并为 Integration `5a0dc52`；合并 CI run `34683019629` 最终全绿。browser-qa 首次详情重载时序断言失败后在未修改代码的重跑 job `103525654367` 中通过。
- 新增 MOBILE-C4 独立契约，将复杂二级页面拆为四个顺序切片，并冻结允许文件、禁止范围、兼容性 Gate、五档视口与设备验收要求；未修改业务代码。

## 2026-09-15 — UIR-02 本地实现（未提交）

- 在 `codex/ui-reconstruction-foundation` 基线 `1907c5898d5916fe5d443444bf14b33a82ac97e4` 完成用户端语义 token、基础样式层、`UiPageFrame`、`UiFormField` 和 `ChangePasswordView` 样板迁移；未触碰 API、Store、router、数据库、管理端或 E2E。
- `format:check`、用户端 lint/typecheck、3 个 focused test files（14 tests）、`npm run quality`、`check:context` 和 `git diff --check` 通过。
- 浏览器验收已补充：复用 `D:\daily-assistant-runtime` 的 MySQL 8.4.11（`daily_assistant_e2e`），forced-password Playwright 在 `mobile-375`、`chromium-mobile`（390）、`mobile-430`、`tablet-768`、`desktop-1440` 五项全部通过，总耗时 18.1s；成功流程由五档 E2E 覆盖。
- 手工验收记录：五档 CSS 宽度及 200% 根字号无横向溢出且内容可滚动。已通过项：取消和 Browser Back 均出现自定义未保存确认；Tab、原生 required、客户端不一致、模拟 400、离线提交的输入保留行为符合预期。另观察到 Browser Back 触发原生 `beforeunload`。FAIL/待独立处理：拒绝离开后地址栏为 `/account` 但页面仍显示改密页；该状态未闭合，不作为通过依据。
- 观察与缺口：控制台存在开发环境 Service Worker MIME、`mustChangePassword` 下 sync 403、预期 mock 400；不宣称零错误。加载中仅单测验证，手工延迟模拟未成功；实体软键盘和真实安全区未验证，仅检查移动 viewport 与可滚动布局。离线改密“当前离线，操作已保存到本地并将在联网后同步”作为既有范围外 UX 风险记录，不修改同步/API。UIR-02 focused suite 当前为 3 files / 14 tests。
- 本轮不提交、不推送、不创建/修改 PR、不部署。

## 2026-09-15 — UIR-02 Browser Back 收尾修复（未提交）

- 修复 `useUnsavedChanges` 的 Browser Back 拒绝恢复：`createWebHistory` 的 `popstate` 监听位于 `window`，改用 window capture 拦截并捕获目标 fullPath；用 Vue Router history 的 `go(delta, false)` 恢复当前项，接受时以 `allowNavigation` + `router.replace(targetPath)` 完成一次真实路由更新，避免 `pauseState` 吞导航和历史循环。
- 修复后 active authenticated ChangePassword Browser Back 在 `375/390/430/768/1440` 五档矩阵全部通过：拒绝 URL/page/input/dialog 保持，接受为 `/account` 且显示“我的”页面；无重复确认或历史循环。
- 五档额外中止改密请求验证网络失败降级：均显示既有离线提示且保留三个输入；直接打开 `/change-password` 后再 Back 的拒绝/接受同样保持 URL 与页面一致。
- forced-password auth E2E 8/8 projects 全部通过；`ChangePasswordView.test.ts` 真实 Web History 覆盖 dirty 拒绝/接受、弹窗关闭与单次确认、clean Back、应用内返回接受/拒绝，UIR focused suite 共 18 tests。
- 控制台仅有开发环境既有 Service Worker MIME、`mustChangePassword` 下 sync 403 和预期 mock 400；不宣称零错误。实体软键盘与真实安全区标记为 `DEVICE_ACCEPTANCE_PENDING`。
- 未修改 API、Store、认证、其他页面或 E2E；本轮未提交、未推送、未创建/修改 PR、未部署。

## 2026-09-17 — UIR-06B 记录中心根页本地实现

- RecordsView 保持 /records、现有 PageHeader 语义、Store/API/路由不变；将快速记录固定为首要入口，摘要改为使用 Store 原始金额字符串，并对未加载、失败和未设置预算显示诚实状态。
- 最近记录与待确认使用带 query 保留的可访问 tabs（RECENT/PENDING），各自最多展示六行，保留来源链接、支出/收入/退款标签与金额符号；财务和草稿 loading/error/retry 状态相互隔离。
- 新增 RecordsView.test.ts 覆盖标题与来源、摘要降级、tab query/ARIA、行数与金额、错误重试和空状态；记录页专项测试 7/7、用户端 lint/typecheck、`npm run quality`、格式、上下文与 git diff --check 已通过。浏览器已检查正常/空/加载/失败重试、Tab query/刷新、来源链接、待确认逐行“待确认/去确认”、375/390/430/768/1440 和 200% 文本缩放；仅记录开发环境既有 Service Worker MIME 错误，未发现业务请求失败。本轮未提交、未推送、未创建 PR 或部署。

## 2026-09-15 — UIR-03 TemporalPicker 时间选择控件本地实现

- `TemporalPickerField` 小时/分钟改为原生紧凑 `<select>`（00–23、00–59），保持原日期/月行为、`YYYY-MM-DDTHH:mm` 值格式、取消/确认和边界校验；既有 E2E helper 改用 `selectOption`。
- 聚焦单测 5/5、用户端 lint/typecheck、`format:check` 与 `git diff --check` 通过；本地未提交、未推送、未创建 PR、未部署。

## 2026-09-16 — UIR-04A Dialog foundation 本地实现

- 加固 `AppDialog`、`ConfirmDialog` 和 `ActionSheet` 的焦点、键盘/遮罩关闭去重、滚动锁、安全区、长内容和可访问标题/描述关联；聚焦 3 文件 16 测试、用户端 lint/typecheck 与差异检查通过，未提交、未推送、未创建 PR 或部署。

## 2026-09-16 — UIR-04A 430px 验收收尾（DONE_LOCAL / READY_FOR_DELIVERY）

- 430 CSS px 浏览器验收通过：ConfirmDialog 与 ActionSheet 的焦点、Tab/Shift+Tab、Escape、遮罩、长内容滚动、安全区变量、底部操作区和横向溢出均符合预期；组件检查无新增控制台或网络错误，既有开发环境 `/api/v1/auth/refresh` 502 已单独记录。
- 本轮未修改代码；专项测试 16/16、`git diff --check` 通过；继续保持未提交、未推送、未创建 PR、未合并、未部署。

## 2026-09-16 — UIR-04B 反馈组件基础（本地实现）

- 在当前用户端基础上完善 `ToastMessage`、`EmptyState`，新增展示型 `LoadingState` 和 `ErrorState`；保持业务页面、Store、API、Router、PWA 和管理端不变。
- 组件仅负责语义化展示和可选操作：Toast 不含队列/计时器，ErrorState 只发出一次 retry，LoadingState 不管理异步状态；长文案、纯文本渲染、focus-visible、减少动态效果与语义 Token 样式已覆盖。
- 新增四个组件的专项测试；本记录对应本地实现，尚未提交、推送、创建 PR、合并或部署。

## 2026-09-16 — UIR-05A App Shell 根导航显示边界（本地实现）

- 底部导航现在仅在已登录的四个根页面显示；快速新增、二级、详情、流程和登录页面不再渲染底部导航。
- 移动端主内容的底部空间仅在底部导航实际显示时保留，并继续支持安全区；桌面导航、路由策略和业务页面未修改。
- 新增 App Shell 行为测试覆盖根页面、非根页面、登录态和根/二级页面切换；本轮未提交、未推送、未创建 PR 或部署。

## 2026-09-16 — UIR-05A E2E 导航假设修正

- 修正认证和首页 Playwright 流程：从 `/tasks`、`/calendar` 先使用真实的“返回计划”入口回到根页面，再使用可见的根导航进入目标页面。
- 保持 UIR-05A 生产实现、路由语义和业务断言不变；本轮仅调整测试路径与记录，未迁移其他页面或开始 UIR-05B/UIR-06。

## 2026-09-17 — UIR-06A 首页信息层级与入口样板（本地实现）

- 首页成功态将 Asia/Shanghai 问候、日期/星期、诚实天气 fallback 与 AssistantMark 置于同一信息组；快速记录保持原来源上下文并前置，AI 入口明确为待确认的建议/内容。
- 保持首页请求、状态机、业务内容顺序与既有路由/API/Store 不变；本地 focused tests、用户端 lint/typecheck、格式、quality、context 检查通过。使用一次性 loopback MySQL 运行首页 E2E 五档（375、390、430、768、1440）5/5 通过，并以标准字号与 200% 文本放大检查横向溢出；长用户名和长业务标题在 375px 下也未溢出。仅记录既有开发环境 `/api/v1/auth/refresh` 401 与 Service Worker MIME 噪声，未发现本次组件新增错误；测试数据库、服务和浏览器已清理停止。未提交、未推送、未部署。

## 2026-09-17 — UIR-06B 200% 文本缩放验收补充

- 在 390、430、768 CSS px 下分别启用 200% 根字号，正常记录（长商户名、支出/收入/退款金额）、待确认草稿、空状态、finance/drafts 失败与重试、加载态、Tab/焦点、快速记录/账单明细/预算管理入口及底部导航均完成检查；三档 `scrollWidth === clientWidth`，未发现文字裁切、横向溢出或底部导航遮挡。
- 失败态使用一次性 503 mock 后点击“重试”恢复，业务请求在恢复路径返回 200；控制台仅有开发环境既有 Service Worker MIME 错误，无新增组件错误。未修改实现代码，仅补充本验收记录；实体设备软键盘和真实安全区仍未验证。状态归一为 `DONE_LOCAL / READY_FOR_DELIVERY`；本轮未提交、未推送、未创建 PR、未部署。

## 2026-09-17 — UIR-06C 浏览器故障状态验收收尾

- 在 390×844 与 1440×900 实际浏览器中分别注入计划加载请求 503，确认 `ErrorState`、页面标题、视图/日期/范围控件和根导航保持显示，失败来源的时间线不展示旧缓存或虚假成功/空状态；移除拦截后点击“重试”，请求恢复 200，时间线和当前事项恢复且 query 保持不变。
- 两个视口均对可见待办完成和日程取消注入单请求 503：页面展示对应操作失败反馈，原事项仍保留，未升级为整页加载错误；移除拦截后再次操作成功，事项按既有行为更新，页面继续可操作。恢复成功后本次观察到已有操作错误提示会继续显示至后续刷新，未修改实现，作为后续独立 UX 观察项记录。
- 故障期间未发现横向溢出、底部导航遮挡或新增 PlanView 运行错误；网络记录包含预期注入的 503 和恢复后的 200。控制台仅见本地开发环境既有 Service Worker MIME、同步 401 及注入 503 噪声。未修改实现代码，仅追加验收记录；浏览器、测试服务和本地 MySQL 已停止。本轮未提交、未推送、未创建 PR、未部署，UIR-07/UIR-08 未开始。

## 2026-09-18 — UIR-07C 分类与资金账户页面迁移（本地实现）

- 分类与资金账户页保留 `SecondaryPageShell`、Finance Store/API、版本字段、未保存保护和原有归档/恢复流程；补齐固定页面顺序、类型/名称标签、收入分类编辑、统一行操作和可访问按钮名称。
- 新增分类/账户页的加载、失败重试、空列表、创建/编辑/归档/恢复失败反馈；失败时保留当前表单或编辑输入，重试只调用对应原始加载方法。
- 仅添加分类/账户页作用域样式，覆盖触控尺寸、focus-visible、长文本换行、窄屏和 200% 文本缩放所需的换行规则；真实设备安全区/软键盘仍待设备验收。
- 真实浏览器已在 375、390、430、768、1440 CSS px 以及各档 200% 文本缩放下检查两页的正常/空状态、长名称、底部导航和横向溢出；两页均在 503 加载失败后通过重试恢复，并分别验证创建失败时保留输入、分类/账户归档与恢复及 Browser Back 未保存保护；缓存列表存在时注入加载 503 仍保留列表并提供可重试 ErrorState，恢复后数据正常回填。
- 浏览器控制台仅记录既有 Service Worker MIME、同步 403 和密码表单可访问性提示，以及本轮主动注入的 503；未发现实现新增业务异常请求。新增两个视图专项测试，聚焦套件 16/16、用户端 lint/typecheck、`npm run quality`、格式、上下文与 `git diff --check` 通过；补充修正了成功变更后刷新失败的错误语义、缓存行重复操作锁定、写操作拒绝时保留加载错误，以及未知异常的通用错误回退。本轮未提交、未推送、未创建 PR、未部署，UIR-07D/UIR-08 未开始。

## 2026-09-18 — UIR-07B 浏览器错误与恢复验收收尾

- 在 390×844 与 1440×900 实际浏览器中注入创建账单 400 字段错误：页面保留金额、商户、备注、当前路由和可用保存按钮，显示服务端第一条字段错误；移除拦截后重新提交均以 201 成功并 replace 返回 `/records`。
- 两个视口均注入创建账单 503 服务/网络失败：显示通用操作错误，输入和路由保持、不产生假成功；恢复正常响应后再次提交成功。注入的失败请求及恢复请求均已记录。
- 两个视口均验证 `duplicateWarning` 201 响应：警告随成功响应被接受，不被当作失败、不触发覆盖或删除；页面按既有行为立即 replace，未擅自改变产品流程，因此警告未在表单页停留展示。
- 编辑页在 390px 与 1440px 注入详情 GET 503 时展示 ErrorState、不渲染未初始化表单；点击“重试”后请求恢复 200，正确回填类型、金额、时间、商户、备注及 `version: 1`，不触发未保存保护。
- 390px 完成 Browser Back 未保存保护抽查：拒绝离开后 URL、页面和 `21.00` 输入保持，确认弹窗关闭；再次 Back 接受后进入 `/records`。1440px 编辑页取消入口返回 `/records`，两档均无横向溢出（`scrollWidth` 不超过 viewport）。
- 控制台仅见既有开发环境 Service Worker MIME 噪声及本轮预期注入 503；未发现新的业务异常。未修改实现代码，仅追加本验收记录；Fresh Sol 复用既有 `ship`。本轮未提交、未推送、未创建 PR、未部署，UIR-07C/UIR-08 未开始；实体软键盘和真实设备安全区仍待设备验收。

## 2026-09-18 — UIR-07D 预算管理页面迁移（本地实现）

- 预算页保留 `MonthField`、Asia/Shanghai 默认月份、Finance Store/API payload、字符串金额和预算 `version` 语义；页面按月份控件、当月概览、设置新预算和预算列表组织。
- 使用现有 `LoadingState`、`ErrorState`、`EmptyState` 和 `requestAppConfirm`；区分列表加载、摘要失败与写操作错误，缓存列表在刷新失败时仍可见，删除取消不会调用 Store。
- 本轮仅修改 `BudgetsView.vue`、`BudgetsView.test.ts`、预算页作用域样式和本变更记录；专项测试 11/11、用户端 lint/typecheck、`npm run quality`、格式、上下文与差异检查通过。真实浏览器在 375、390、430、768、1440 CSS px 及各档 200% 根字号下检查标题、月份控件、新增表单、预算列表、操作按钮和横向溢出，均未发现新增溢出或遮挡；390px 另以受控延迟捕获 `LoadingState`。390px 完成月份切换、创建成功/503 失败保留输入、行内更新 503 保留输入、删除确认取消与 503 失败保留列表；1440px 完成预算加载 503、摘要 503、重试恢复及创建/更新/删除 503 失败保留数据。390px Browser Back 未保存金额拒绝后 URL、页面和 `123.45` 输入保持，确认弹窗关闭；再次 Back 接受后进入 `/account`，未出现重复弹窗或历史循环。控制台仅见开发环境既有 Service Worker MIME/同步刷新噪声与本轮注入 503；停止本地服务后浏览器残余同步请求的 `ERR_CONNECTION_REFUSED` 属于 teardown 噪声，未发现实现新增业务异常请求。实体软键盘和真实安全区仍待设备验收。Fresh Sol 复核结论为 `ship`。本轮未提交、未推送、未创建 PR、未部署；UIR-08 未开始。

## 2026-09-19 — UIR-07E 草稿审核页面迁移（DONE_LOCAL / READY_FOR_DELIVERY）

- 草稿中心按“确认边界说明 → 快速新增/状态筛选 → 加载/错误/陈旧提示 → 待确认批量操作 → 草稿审核卡片/空状态”组织；仅保留 `PENDING`、`CONFIRMED`、`DISCARDED` 和全部筛选，不新增 FAILED 筛选。单条丢弃使用现有应用确认，批量丢弃继续使用意图、confirmationToken 和二次确认；确认前不会写入正式账单。
- DraftReviewCard 保留金额字符串、`EXPENSE`/`INCOME`/`REFUND`、`Asia/Shanghai` 时间序列化、版本号、分类/账户过滤、失败输入保留、只读已确认/已丢弃/失败状态和可访问文字语义；未修改 Store、API、Router、数据库、时间组件、其他页面或依赖。
- 专项测试 27/27、用户端 lint/typecheck、`npm run quality`、`npm run format:check`、`npm run check:context` 和 `git diff --check` 通过；既有 `capture-draft.spec.ts` 在 chromium desktop/mobile、webkit mobile、375、430、768、1440 七个 Playwright 项目 7/7 通过。Fresh Sol 初次复核提出的未保存确认、变更后刷新失败可重复操作和多卡重复离开确认问题，已在本任务允许文件内收紧并由新增回归测试覆盖；后续复核补充确认了跨 reload 保留未保存输入、陈旧卡片选择框禁用和筛选请求串行化。
- 实际浏览器检查覆盖 375、390、430、768、1440；各档启用 200% 根字号后 `document/body scrollWidth` 均与 viewport 相等。390 与 1440 注入草稿列表 503 后均显示 ErrorState，移除拦截并点击“重试”后恢复列表；390 另验证单条丢弃取消不改变草稿，以及批量确认 503 后对话框、原因、选择和重试上下文保留，恢复后成功丢弃并显示空状态。控制台仅记录开发环境既有 Service Worker MIME 噪声及本轮主动注入的 503，未发现新增业务异常请求；真实设备软键盘和安全区仍为 `DEVICE_ACCEPTANCE_PENDING`。
- Fresh Sol 最终复核结论为 `ship`；本轮未提交、未推送、未创建 PR、未合并、未部署；UIR-08 未开始。

## 2026-09-19 — UIR-08A 日程列表页面迁移（DONE_LOCAL；Fresh Sol 复核不可观测）

- 基于 Integration `97f4cd8b6f7837e5e6eccb4b329729f1e2aa8572` 完成 `/calendar` 页面层级、当日概览、加载/空/失败/陈旧刷新反馈、日程创建/编辑/软删除/恢复、版本与状态提交、重叠警告、日期/删除筛选、`returnTo` 和未保存导航保护；保持现有 Store、API、Router、DateField/DateTimeField、时间工具及其他页面不变。
- 新增 `CalendarView.test.ts`，覆盖有效日期查询、加载竞态、缓存刷新失败、全天半开区间、Asia/Shanghai 非全天序列化、重复提交防护、版本/状态、失败保留输入、删除确认/恢复和 Browser Back；用户端全量测试 50 个文件 / 301 个测试通过。
- 仅修改 `CalendarView.vue`、`CalendarView.test.ts`、日历作用域样式和本记录；`npm run quality`、`npm run format:check`、`npm run check:context`、`git diff --check` 全部通过。Playwright CLI preview 验收覆盖 375、390、430、768、1440 CSS px、删除筛选、503 ErrorState 和 375px/200% 文本缩放，均无横向溢出；截图保存在 `output/playwright/uir-08a-calendar-*.png`。
- 真实 E2E 入口已尝试，但配置要求的专用 `E2E_DATABASE_URL`/`DATABASE_URL` 与本机 MySQL 均不可用，因此未宣称真实后端 E2E 通过。Fresh Sol 最终审查因 runtime 路由元数据不可观测而按规则关闭，未采纳 reviewer verdict；本轮未提交、未推送、未创建 PR、未合并、未部署，未开始 UIR-08B。

## 2026-09-19 — UIR-08A 真实 E2E 与 Fresh Sol 验收收尾（DONE_LOCAL；REVIEW_BLOCKED_RUNTIME_METADATA）

- 复用项目既有 MySQL 8.4.11 与 `daily_assistant_e2e` 测试库，使用既有 E2E 启动脚本完成 migration、API、Web、Admin 和浏览器验收；本轮启动的 MySQL、API、Web、Admin 与浏览器均已停止，未输出连接凭据或 Cookie。
- 首轮真实 E2E 的 5 个失败均定位为 UIR-08A 的页面兼容性问题：日程详情入口应沿用既有“查看”名称，以及初始 `/calendar` 的 `returnTo` 不应注入未出现在当前 URL 中的默认日期；仅在允许文件内完成最小修复，未修改 E2E 断言。最终 `navigation-shell.spec.ts` 15/15、`temporal-picker.spec.ts` 5/5，五个项目 `mobile-375`、`chromium-mobile`（390）、`mobile-430`、`tablet-768`、`desktop-1440` 共 20/20 通过，覆盖日程创建、详情 returnTo、返回、编辑、取消、删除、恢复、计划入口和 Browser Back。
- `CalendarView`/`PlannerListsView` 聚焦回归 17/17；Web 全量 50 files / 301 tests；Web lint/typecheck、`npm run quality`、format、context 和 `git diff --check` 全部通过。最终 E2E 输出仅有 FORCE_COLOR/NO_COLOR 警告，未报告失败断言或失败网络请求；五档视口及五档 200% 文本缩放沿用此前通过证据。
- Sol Advisor `install-agents.sh --check` 精确性通过，原生 Luna/Terra/Sol 角色均暴露。新 Fresh Sol reviewer `01a0b87a-d46b-7303-8600-6addbd6cd832` 的公开元数据未提供 model/effort；`inspect-agent-runtime.sh` 返回 `ERROR: rollout is missing, ambiguous, invalid, or inconsistent required routing metadata.`，故 reviewer 已关闭、未采纳 verdict。sandbox policy 与 permission profile 也因同一运行时元数据缺失而不可观测；审查前后工作区状态和允许文件集合一致。
- 用户已明确决定本任务暂不以实际执行模型、reviewer 路由元数据、sandbox 或 permission metadata 作为交付门禁，批准在如实保留 Fresh Sol 未形成有效 verdict 的前提下继续交付；不将 Fresh Sol 记录为 `ship`。
- 本次交付仅负责提交、推送和创建 PR，不合并、不部署、不开始 UIR-08B；Fresh Sol 不形成可采纳 verdict，不记录为 `ship`。

## 2026-09-19 — UIR-08B 待办列表页面迁移（DONE_LOCAL / READY_FOR_DELIVERY）

- 基于 Integration 合并基线完成 `/tasks` 页面迁移：重组待办列表信息层级和响应式布局，补齐状态/优先级/逾期/无截止时间展示，以及加载、错误、陈旧缓存、空状态和重试反馈；保留现有 Planner Store、API、Router、时间工具和详情页不变。
- 真实浏览器复核中发现全局同步无筛选刷新可能覆盖当前筛选快照；在 TasksView 页面层增加 status/软删除收敛防线，并补充回归断言，未修改 Store 或同步规则。
- 完善新建、编辑、完成、取消、删除确认、软删除恢复、失败输入保留、重复提交锁定、版本提交、`returnTo` 和未保存导航保护；保持 OPEN/COMPLETED/CANCELLED、LOW/MEDIUM/HIGH、`dueAt` 的 Asia/Shanghai 序列化和既有离线/冲突语义。
- 仅修改 `TasksView.vue`、新增 `TasksView.test.ts`、待办作用域样式和本记录；未修改 Store、API、Router、E2E 测试、数据库、公共时间/选择器或其他页面。
- `TasksView` 与 `PlannerListsView` 聚焦测试 19/19；Web 全量测试 51 files / 317 tests；`npm run quality`、`format:check`、`check:context` 和 `git diff --check` 全部通过。
- 复用项目既有便携 MySQL 8.4.11 与 `daily_assistant_e2e`，使用既有 E2E 启动脚本顺序执行 `navigation-shell.spec.ts` 与 `temporal-picker.spec.ts`，五个项目（375、390、430、768、1440）共 20/20 通过；Playwright CLI 另在五档宽度启用 200% 根字号检查，均无横向溢出。验收后 MySQL、API、Web、Admin 和浏览器均已停止。
- 故障注入集中在 390/1440：初始任务 GET 503 均展示 ErrorState，移除注入后点击重试恢复；390 在完成请求成功但列表刷新 GET 503 时保留旧行并显示“刷新失败/上次成功加载”提示，恢复后重试收敛；1440 另检查 COMPLETED、CANCELLED、全部筛选及筛选对应空状态。网络中的 503 均为主动注入，恢复请求为 200；控制台仅见既有开发环境 Service Worker MIME 噪声及主动注入的 503。
- 实现与本地验收阶段未提交、未推送、未创建 PR；本交付任务仅执行提交、推送和创建 PR，仍不合并、不部署、未开始 UIR-08C。Fresh Sol 审查不是本任务门禁，未将任何审查状态写成 `ship`。
