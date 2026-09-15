# UI 组件、页面与验收规范（docs/51）

文档版本：1.1（5.6 Sol 最终校准稿）
状态：`BASELINE_CONFIRMED / SOL_REVIEWED / PLANNING_ONLY / NOT_IMPLEMENTED`
最后更新：2026-09-15
适用版本：Daily Assistant V1.5 UI 重构后续系列 `UIR-00` 至 `UIR-12`
前置基线：`docs/50-ui-reconstruction-baseline.md`

> 本文把已确认的视觉方向翻译为可实施的组件和页面约束。数值属于实现起点和验收参考，不等同于设计稿像素合同；业务、API、数据库和权限行为继续以现有正式契约为准。

## 1. 标记与执行边界

- `[现状事实]` 当前用户端已存在 `AppDialog`、二级页面壳、`DateField`、`MonthField`、`DateTimeField`、导航策略和 AI Proposal/确认流程。
- `[已确认]` UI/产品规范和任务契约由 `5.6 Sol` 维护；每个 bounded implementation task 由 `5.6 Luna` 执行；主代理独立审查 diff 与验证证据。当前不使用 DeepSeek。
- `[设计建议]` 下表 token 是柔和紫/暖白基线的建议起点，实施时应集中定义，禁止在页面中散落硬编码。
- `[待确认]` 天气数据适配、AI 多轮会话持久化、对话 API 和隐私策略均不由 UI 规范自动批准。

## 2. Design token 分类

### 2.1 语义 token

| 类别 | 建议 token/起点 | 使用规则 |
|---|---|---|
| 背景 | `--ui-color-bg: #fbfaf7`；`--ui-color-surface: #ffffff` | 页面底色和内容面板分离；不要用阴影替代边界 |
| 品牌主色 | `--ui-color-primary: #7c5cfa`；`--ui-color-primary-strong: #6244d8` | 主要动作、选中态和品牌提示；同一视图只保留一个主要强调层级 |
| 品牌浅色 | `--ui-color-primary-soft: #eee9ff` | 选中背景、轻量提示、AI/天气辅助区域；文字对比度仍需满足无障碍 |
| 文字 | `--ui-color-text: #2b243d`；`--ui-color-text-muted: #756e83` | 正文、辅助说明、禁用说明；禁用不能只降低透明度到不可读 |
| 边框 | `--ui-color-border: #e7e1f3`；`--ui-color-border-strong: #d7cfeb` | 字段、卡片、分隔线和焦点外圈分别使用语义层级 |
| 状态 | `success`、`warning`、`danger`、`info` 语义 token | 状态同时用文字/图标/形状表达，不只依赖色相 |
| 遮罩 | `--ui-color-scrim: rgb(31 25 52 / 42%)` | 弹窗、Sheet、抽屉；打开后背景内容不应继续获得焦点 |
| 天气 | `--ui-color-weather-soft`、`--ui-color-weather-contrast` | 仅为问候区的辅助色，天气失败时隐藏，不影响页面主色 |
| AI | `--ui-color-ai-soft`、`--ui-color-ai-accent` | 区分 AI Proposal 与正式业务记录，不能暗示已写入 |

### 2.2 尺寸、排版与层级 token

| 类别 | 建议起点 | 约束 |
|---|---|---|
| 间距 | `4 / 8 / 12 / 16 / 20 / 24 / 32px` | 页面默认留白和模块间距 16px；同一模块只使用相邻档位 |
| 圆角 | `8 / 12 / 16 / 24px` | 字段/按钮偏小，卡片/面板偏大；不要每个组件自创半径 |
| 控件高度 | 常规 44–48px；紧凑桌面 40px | 主要触控目标不低于 44px，图标按钮也必须可达 |
| 页头 | 约 52px | 返回按钮、标题、可选动作三者应有稳定区域，不依赖绝对定位 |
| 字体 | 12/14/16/18/20/24px 语义级别 | 标题、正文、辅助、金额和时间分层；金额不使用浮点格式化 |
| 行高 | 正文 1.5–1.6；按钮 1.2–1.4 | 长文案和错误信息可换行，不能裁切 |
| 阴影 | 低、中、高三档语义 token | 只用于层级、浮层和焦点；卡片分组优先用背景/边框 |
| 层级 | base / sticky / popover / dialog / toast | 避免组件各自产生不可预测的 z-index |
| 动效 | 120–220ms，尊重 `prefers-reduced-motion` | 动效只说明状态变化，不延迟核心操作 |
| 宽度 | 表单建议 680–760px；桌面主内容 max-width 可配置 | 手机单列，768/1440 可双栏或列表/详情并置 |

以上颜色仅为实现起点。用于正文、按钮文字、焦点和状态的实际组合必须以对比度检查结果为准；若建议色不满足可读性，应通过语义 token 调整，不得在单页局部硬编码补丁色。

### 2.3 密度和主题

- `comfortable`：移动端默认；控件 44–48px、模块间距 16–24px。
- `compact`：桌面列表和管理端可用；控件不低于 40px，表格行高和间距收紧。
- `[设计建议]` token 通过主题根节点或 CSS 层级覆盖；组件不直接读页面专属颜色。
- `[待确认]` 首批是否暴露用户可切换的密度/主题入口；即使暂不暴露，也要保留实现层扩展点。

## 3. 基础组件状态规范

| 组件 | 必须支持的状态 | 交互/可访问性要求 |
|---|---|---|
| Button | default、hover（桌面）、focus-visible、pressed、disabled、loading、danger | loading 禁止重复提交；文字与图标同时表达动作；危险按钮明确后果 |
| IconButton | default、focus、pressed、disabled、带 tooltip/可见标签 | 不能只有图标而无可访问名称；触控区不低于 44px |
| TextField/TextArea | empty、filled、focus、disabled、readonly、error、success、loading | label 与错误关联；不通过 placeholder 代替 label；错误用 `role=alert` 或字段关联 |
| AmountField | empty、positive、negative、invalid、disabled、loading | 只接受现有金额语义；展示格式和精度不使用二进制浮点计算 |
| Select | closed、open、selected、empty、disabled、error、loading | 键盘上下/Enter/Escape；长选项可读；不把原生值类型静默转换 |
| Checkbox/Radio | unchecked、checked、indeterminate、focus、disabled、error | 点击文本也可切换；组有 legend/label；状态不只由颜色表达 |
| SegmentedControl | selected、unselected、focus、disabled、loading | 适合同一页面的少量视图切换，不作为长选项下拉替代 |
| Badge/Status | neutral、info、success、warning、danger、pending | 文字 + 图标/形状；不能把 `SYNCED` 常驻渲染为首页主内容 |
| ListRow | normal、pressed、selected、disabled、with-action、with-error | 操作按钮与行跳转不冲突；长标题换行 |
| EmptyState | empty、permission、offline、error、loading-placeholder | 有解释和下一步动作；不显示原始后端错误 |
| Toast | success、info、warning、error、dismissible | 短消息不替代字段错误；支持读屏播报和手动关闭 |
| Skeleton | loading、reduced-motion | 只表示结构，不放假数据冒充已加载内容 |

## 4. 弹窗、Sheet、抽屉与反馈

### 4.1 统一基础规则

- `[现状事实]` 继续复用 `AppDialog` 作为基础弹窗宿主；不新建平行的浏览器 `alert/confirm` 或第二套弹窗系统。
- `ConfirmDialog` 用于确认、删除、撤销和高风险动作；`FormDialog` 只承载短表单；复杂编辑优先使用全屏二级页；移动端操作列表使用 `ActionSheet`。
- 弹窗打开时锁定背景滚动，初始焦点进入标题/首个可操作控件，关闭后恢复到触发元素；Escape 和遮罩关闭规则由弹窗类型明确。
- 弹窗内容区独立滚动，底部操作区保持可见；在有软键盘和安全区时不能遮挡输入或确认按钮。
- 删除/关闭/恢复等危险操作显示明确后果、原因要求和失败提示；管理员高风险操作继续产生脱敏审计。
- Toast 只反馈已发生或已接受的 UI 状态，不能把网络请求开始误报为成功。

### 4.2 弹窗类型

| 类型 | 适用场景 | 移动端 | 桌面端 |
|---|---|---|---|
| ConfirmDialog | 简短确认、撤销、删除 | 居中窄面板或 Sheet，按钮顺序稳定 | 居中面板 |
| FormDialog | 1–3 个短字段 | 若键盘/字段较多则升级全屏编辑 | 居中面板，内容区滚动 |
| ActionSheet | 行动作、快速选项 | 底部 Sheet，支持取消和安全区 | 可使用 Popover/菜单，但语义相同 |
| FullscreenEdit | 复杂表单、AI Proposal 审阅 | 二级页或全屏 Sheet | 二级页/大面板 |
| DetailDrawer | 管理端用户/审计摘要 | 窄屏可转全屏 | 右侧详情抽屉 |

## 5. 表单、选择框和日期时间

### 5.1 表单布局

- `UiFormField` 统一 label、required、help、error、状态图标和字段间距；label 永远位于控件上方。
- 同一表单优先单列；只有语义强关联且在 430px 以上稳定的字段才允许双列。
- 提交区可固定在底部，但必须为滚动内容保留安全区和足够底部 padding；取消/返回不会静默丢弃未保存内容。
- 提交中锁定重复动作，错误恢复后保留用户输入；离线场景标记待同步/失败，不伪装为已保存。
- 金额使用定点小数或最小货币单位；日期时间按 `Asia/Shanghai` 业务语义，API 边界保持 ISO 8601。

### 5.2 选择框

- 短选项可使用弹出列表/Popover，长选项和移动端优先使用 Sheet；选项有当前值、空值、禁用和错误态。
- 打开后可使用键盘上下移动、Home/End、Enter 确认、Escape 取消；触控点击选项后焦点和滚动位置可预测。
- 不手工改写业务枚举、不混淆显示 label 与 API value；空值和清除动作必须明确。
- 选择器失败或无数据时提供说明和重试/设置入口，不显示供应商原始错误。

### 5.3 日期、月份和日期时间

- `[现状事实]` 继续使用已验收的 `DateField`、`MonthField`、`DateTimeField` 体系及 `AppDialog` 宿主。
- 字段以按钮打开选择器，显示当前值/空值和可访问名称；不得要求用户手动输入日期或时间。
- 日期面板支持上/下月、今天、闰日、min/max；月份支持年份切换；空值字段支持清除。
- 日期时间先选日期，再以紧凑小时/分钟滚轮或可选择列表选择 24 小时制的小时和分钟；小时、分钟可点击选择和上下滚动，不展示普通文本输入框。
- 确认前只更新选择器临时值，取消恢复原值；确认后写回既有本地 `YYYY-MM-DDTHH:mm` 值格式，页面继续负责开始/结束关系校验。
- 组件负责自身 min/max 和可选范围；跨日、全天、结束早于开始等业务语义仍由页面/领域服务校验。
- 375/390px 选择器必须不超出视口，430/768px 可适当增大面板，1440px 允许居中或锚点浮层；所有尺寸都验证 Escape、焦点恢复、Back 和滚动锁定。

## 6. AI 对话组件规范

### 6.1 页面结构

1. 二级页头：返回、标题“AI 助手”、可选帮助/清空入口。
2. 对话内容区：用户消息、AI 消息、时间/状态、失败重试和加载占位。
3. 建议快捷项：例如“记录一笔”“整理今天安排”“生成待办”；点击只填入或提交建议，不绕过确认。
4. 底部输入区：多行输入、发送按钮、发送中/禁用/失败状态；软键盘不能遮挡发送操作。
5. Proposal/草稿卡片：明确标记“待确认”，列出结构化字段和编辑/确认/拒绝动作。

### 6.2 消息和状态

| 状态 | 展示 | 行为 |
|---|---|---|
| 空会话 | 介绍能力、示例提示和快捷项 | 不填充虚假历史；可开始新消息 |
| 发送中 | 用户消息已显示，AI 位置为 loading | 禁止重复发送同一幂等键；支持取消/等待策略由 API 决定 |
| 成功回复 | AI 气泡和可选 Proposal | 普通答复不自动写入业务；Proposal 进入确认链路 |
| 网络/Provider 失败 | 友好错误、保留输入、重试 | 不显示原始 Provider 响应；可离线提示“需要联网” |
| 会话过期/无权限 | 明确登录/权限提示 | 不展示其他用户会话；重新加载不越权 |
| Proposal 处理中 | 待确认卡片/步骤状态 | 只能调用正式确认动作；状态冲突要求刷新 |

### 6.3 数据和权限边界

- `[待确认]` 新对话 API、会话 ID、消息 ID、归属用户、历史保留与删除/导出必须先形成 OpenAPI、数据字典和隐私决策。
- `[待确认]` 多轮上下文选择与截断、上下文是否包含既有业务正文、token/费用核算、并发与幂等、流式/非流式协议、超时/重试/熔断和无 Provider 时的降级策略，均不能由本 UI 稿定案。
- 会话上下文默认只属于当前用户和当前授权范围；管理员不默认读取个人对话正文。
- AI 的任何正式写入必须经过用户最终确认、领域校验、幂等和审计；对话“发送成功”不等于业务写入成功。
- UI 不保存 Provider 密钥、账户密码、Cookie 或其他凭据；浏览器不直连 Provider。

## 7. 天气与问候区组件规范

- 首页问候区为一个可伸缩区域：问候文案、日期/星期、城市/天气和小猫插画在同一视觉组内；小猫不单独占一行，也不抢占快速记录的首要层级。
- 视觉顺序建议为：问候 → 日期/星期 → 城市/温度/短天气 → 小猫装饰；窄屏时小猫可以缩小或隐藏，但不能遮挡文字和操作。
- 天气 loading 显示简短骨架或省略天气字段；失败/离线只显示日期和星期，必要时提供城市设置入口。
- 城市、温度、天气短文案和更新时间必须来自适配层的最小展示模型；不得把第三方原始字段写入模板。
- 天气实现前必须决定城市来源（手动设置、账户设置或设备定位）、最小权限、缓存/保留、更新频率、供应商与费用边界。设备定位不得作为默认假设，拒绝授权不阻塞首页。
- `[待确认]` 是否展示空气质量、风力、降雨概率、定位图标等扩展信息；首版基线不要求这些字段。

## 8. 根页面规范

### 8.1 首页

- 问候/日期天气区（含小猫）
- 快速记录主入口（账单/待办/日程/提醒等，按现有能力分组）
- 今日安排摘要与查看全部
- 最近记录/行程摘要与空状态
- AI 对话入口
- 同步异常、冲突或离线提示只在有状态时出现；不常驻展示“已同步”
- 手机底部导航；桌面侧栏/顶部导航适配

### 8.2 记录

- 页面头部、筛选/分段、主列表、空状态、新增入口。
- 金额、类型、时间和状态有稳定层级；删除/恢复等操作进入确认流程。

### 8.3 计划

- 日期/视图切换、日程/待办/提醒摘要、时间线或分组列表、创建入口。
- 同一天多个类型时使用统一状态颜色和文字，避免仅靠颜色区分。

### 8.4 我的

- 账户、偏好、分类/资金账户、快捷指令、同步、AI/帮助按主题分组。
- 账户关闭等危险操作放在底部独立区，说明容量与数据影响。

## 9. 二级页面五类规范

| 类型 | 结构 | 固定动作 | 主要异常 |
|---|---|---|---|
| 列表 | 52px 返回标题栏 → 说明/状态 → 筛选/分段 → 列表 → 空/加载/错误 | 新增、筛选、刷新 | 空数据、无权限、网络失败、分页/加载更多 |
| 详情 | 返回标题栏 → 核心状态 → 基础信息 → 关联内容/时间线 → 危险操作 | 编辑、复制、删除/恢复 | 404、版本冲突、权限、过期状态 |
| 编辑 | 返回标题栏 → 单列字段 → 选择器 → 校验 → 固定底部取消/保存 | 保存、取消 | 字段错误、保存失败、离线待同步、未保存保护 |
| 复杂详情 | 摘要 → 标签/分段 → 时间线/清单 → 关联对象 → 局部编辑 | 分段切换、添加、局部编辑 | 长内容、部分加载、冲突、关联对象缺失 |
| 设置 | 分组标题 → 设置行/开关/选择 → 帮助 → 底部危险区 | 保存、重置、关闭账户 | 权限、环境不可用、同步失败、二次确认 |

统一规则：页面间距 16px 起步；主要控件 44–48px；深层二级页隐藏根底部导航；桌面端可将列表和详情并列但不改变返回语义。

## 10. 管理端组件与页面

- `AdminShell`：固定/可折叠左侧导航、顶部上下文、面包屑或页面标题、用户会话动作。
- `AdminTable`：筛选、排序、分页、加载、空、错误、权限状态；个人业务正文不在表格或抽屉中展示。
- `AdminDetailDrawer`：用户状态、容量占用、账号元信息和脱敏审计摘要；窄屏转全屏详情。
- `AdminForm`：基于 Element Plus 的字段、原因必填、校验、loading、失败重试和审计提示。
- `CapacityCard`：总容量、占用、暂停占用、关闭释放和剩余空间使用明确不同状态/文案。
- `AuditTimeline`：只展示脱敏动作、时间、操作者和结果，不展示账单、日程、待办、行程正文。
- 管理端保留 Element Plus 的表格、抽屉、表单、分页和反馈能力；新增 token 只做主题/密度层适配，不引入第二套组件框架。

## 11. 无障碍与交互验收

- 键盘：Tab 顺序稳定；Enter/Space 激活按钮；Select/日期时间面板支持上下、Home/End、Enter、Escape；焦点可见。
- 读屏：页面有唯一主标题；字段 label/错误/帮助关联；弹窗和抽屉有名称；状态变化可播报。
- 颜色：正文、错误、禁用、主按钮和浅色品牌背景满足可读性；状态同时有文字或图标，不只依赖颜色。
- 触控：主要按钮、导航、关闭、箭头、小时/分钟选项和列表动作目标不低于 44px；密集管理表格可用明确的行操作区域。
- 动效：支持 `prefers-reduced-motion`；loading 不依赖闪烁；关闭弹窗/抽屉不改变用户已输入值。
- 失败和离线：显示可理解的下一步；保留输入；不暴露原始错误、Provider 响应、坐标或凭据。
- 浏览器 Back/系统返回/应用内返回：根 Tab 不堆积历史，二级页返回父级，未保存表单触发保护。

## 12. 375/390/430/768/1440 验收矩阵

| 流程 | 375 | 390 | 430 | 768 | 1440 |
|---|---:|---:|---:|---:|---:|
| 首页问候、日期天气、小猫同区 | □ | □ | □ | □ | □ |
| 快速记录主入口与空/错误态 | □ | □ | □ | □ | □ |
| 根导航与二级页返回 | □ | □ | □ | □ | □ |
| 记录列表、筛选、详情 | □ | □ | □ | □ | □ |
| 计划列表、时间线、编辑 | □ | □ | □ | □ | □ |
| 日期/月/日期时间选择器 | □ | □ | □ | □ | □ |
| 小时/分钟选择（无手输） | □ | □ | □ | □ | □ |
| ConfirmDialog / FormDialog / Sheet | □ | □ | □ | □ | □ |
| AI 对话、失败重试、Proposal 待确认 | □ | □ | □ | □ | □ |
| AI 不直接写正式记录 | □ | □ | □ | □ | □ |
| 天气失败/离线降级为日期 | □ | □ | □ | □ | □ |
| 管理端侧栏、表格、详情抽屉 | □ | □ | □ | □ | □ |
| 键盘、读屏、200% 缩放和焦点恢复 | □ | □ | □ | □ | □ |
| 控制台无新增错误、网络失败可解释 | □ | □ | □ | □ | □ |

每格必须记录 PASS/FAIL 和证据路径；未验证不得标为通过。正式矩阵属于 `UIR-12`，本规划文档中的方框不是已完成证据。

## 13. 关联验收命令与限制

- 文档阶段：`npm run check:context`、`git diff --check`。
- 组件/页面实现：按任务契约运行对应 lint、typecheck、单元/集成/E2E 和浏览器五档矩阵；跨 workspace 或共享配置变更时再运行 `npm run quality`。
- 第一项代码任务只允许完成 token/样式与组件基础架构、主题/密度/slot 扩展点和一个低风险样板页；样板未通过前不得批量迁移页面。
- 开始代码前须重新核验实际 Integration 已包含 PR #33 merge、合并后 CI 和现有设备证据，并从该新鲜基线创建独立 UIR 分支；当前本地 MOBILE-C3 checkout 不得承载 UI 实现。
- 不运行服务、不创建生产资源、不执行数据库迁移、不提交/推送/创建 PR/部署，除非新的独立授权和任务契约明确允许。

## 14. UIR-02 本地实现记录（2026-09-15）

- 基线：`codex/ui-reconstruction-foundation`，`1907c5898d5916fe5d443444bf14b33a82ac97e4`；实现保持在任务白名单文件内，未修改 API、Store、router、composable、数据库、管理端或 E2E。
- 已实现：用户端 `--ui-*` 语义 token（背景、表面、文字、交互、状态、遮罩、焦点、AI/天气预留、排版、间距、圆角、阴影、层级、宽度、安全区和动效），comfortable/compact 密度与 reduced-motion 覆盖，以及 `--color-*`/`--v2-*` 兼容别名。
- 已实现：`UiPageFrame` 的默认 `PageHeader`、header/status/filter/content/action 插槽和 form/content max-width；`UiFormField` 的 `useId()`、label/required/help/error、描述关联和错误优先级语义。
- 已迁移：`ChangePasswordView.vue` 仅使用上述样板组件；`auth.changePassword`、密码字段属性、强制改密提示、安全返回、未保存保护、错误输入保留、提交中防重复及成功清理/导航行为保持不变。
- 本地验证：`format:check`、用户端 lint、用户端 typecheck、UIR-02 focused tests（3 files / 14 tests）、`quality`、`check:context` 和 `git diff --check` 均已通过；未创建提交、PR、部署或生产资源。
- 浏览器验收：复用 `D:\daily-assistant-runtime` 的 MySQL 8.4.11（数据库 `daily_assistant_e2e`）运行 forced-password Playwright 流程；`mobile-375`、`chromium-mobile`（390）、`mobile-430`、`tablet-768`、`desktop-1440` 五项全部通过，总耗时 18.1s。成功流程由五档 E2E 覆盖。
- 手工验收：375/390/430/768/1440 CSS 宽度及 200% 根字号均无横向溢出且内容可滚动。已通过项：取消和 Browser Back 均出现自定义未保存确认；Tab 顺序从当前密码到新密码；空输入触发原生 `required` 且焦点回到首字段；客户端不一致、模拟 400 服务端失败、离线提交均保留输入。另观察到 Browser Back 继续触发原生 `beforeunload`。FAIL/待独立处理：拒绝离开后地址栏为 `/account` 但页面仍为改密页；该状态未闭合，不作为通过依据。
- 运行观察与未验证项：控制台仍有开发环境 Service Worker MIME、`mustChangePassword` 下 sync 403 和预期 mock 400；不宣称零错误。加载中仅由单测验证，手工延迟模拟未成功；实体软键盘和真实安全区未验证，仅完成移动 viewport 与可滚动布局检查。离线改密显示“当前离线，操作已保存到本地并将在联网后同步”，作为既有范围外 UX 风险记录，不修改同步/API。
- 复核补充：`ChangePasswordView.test.ts` 现有 8 个测试覆盖安全取消、路由内存历史 Back 的未保存拦截，以及成功导航先调用 `allowNavigation` 再执行安全返回；UIR-02 focused suite 共 3 files / 14 tests 通过。

## 15. UIR-02 Browser Back 收尾修复（2026-09-15）

- 根因：Vue Router 5.2 `createWebHistory` 在 `window` 注册 `popstate`；原未保存保护挂在 `document`，无法可靠阻止 Router 先处理浏览器历史，因此拒绝离开后出现地址栏 `/account`、页面仍为修改密码的分裂状态。
- 修复：`useUnsavedChanges` 改为 `window` capture 监听；捕获原始目标 fullPath，拒绝确认前使用 `router.options.history.go(-delta, false)` 借助 Vue Router 的暂停监听恢复当前历史项，接受后以 `allowNavigation` + `router.replace(targetPath)` 完成一次路由更新并 reset guard，避免 `pauseState` 吞掉后续导航和历史循环。
- `ChangePasswordView.test.ts` 的真实 `createWebHistory` 覆盖：dirty Browser Back 拒绝时 URL、页面、输入保持不变且弹窗关闭/只请求一次；接受时进入 `/account` 并渲染“我的”页面；clean Browser Back 不打开确认；应用内返回接受/拒绝均覆盖。UIR focused suite 为 3 files / 18 tests 通过。
- 修复后 active authenticated ChangePassword Browser Back 五档页面矩阵 `375/390/430/768/1440` 全部 PASS：拒绝离开 URL/page/input/dialog 保持，接受进入 `/account` 且显示“我的”页面，无重复确认或历史循环。
- 复验补充：五档均实际执行 API 网络失败（中止 `/api/v1/me/change-password`）并观察到既有离线提示“当前离线，操作已保存到本地并将在联网后同步”，三个密码输入仍保留；从账户页直接打开 `/change-password` 后再 Browser Back 的拒绝/接受也保持 URL 与页面一致。
- forced-password auth E2E 8/8 projects 全部 PASS，包含 `mobile-375`、`390`、`430`、`768`、`desktop-1440` 等五档流程。
- 控制台仅记录开发环境既有 Service Worker MIME、`mustChangePassword` 下 sync 403 和预期 mock 400；不宣称零错误。实体软键盘与真实安全区为 `DEVICE_ACCEPTANCE_PENDING`。
- 本轮仅更新未保存保护与既有样板测试/验收记录；未修改 API、Store、认证、其他页面、E2E、生产资源或外部服务。
