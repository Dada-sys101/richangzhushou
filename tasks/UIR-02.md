# UIR-02 — 用户端语义 Token、基础样式架构与修改密码样板

## Metadata

- Contract：`UIR_02_WEB_FOUNDATION_SAMPLE_V1`
- Status：`BLOCKED / NOT_STARTED / CONTRACT_READY_LOCAL / PLANNING_NOT_IN_INTEGRATION`
- Author/Maintainer：`gpt-5.6-sol`
- Implementer：`gpt-5.6-luna`
- Reviewer：主代理独立 diff 审查与验证；完成后 fresh Sol context-clean review
- DeepSeek：`NOT_USED`
- Predecessors：UIR-00 审计和 UIR-01 决策准备文档完成；任何产品建议不等于新增能力批准

## 1. Objective

建立用户端可渐进迁移的语义设计 Token 和基础样式层，预留主题、密度、页面 Header/Filter/Status/Action 插槽，并仅把 `ChangePasswordView.vue` 改造成低风险样板。必须证明视觉基础可以落地，同时完全保留现有修改密码、强制改密、未保存保护、返回和错误行为。

## 2. 开始前 Git 基线

Luna 开始前必须由主代理重新执行并记录：

1. 规划/状态基线提交必须已经合法进入 Integration，或者用户另行明确授权以该**精确本地提交 SHA** 作为 UIR-02 基线；两者均不满足时报告 `UIR-02_BLOCKED_PLANNING_NOT_IN_INTEGRATION`，不得创建分支或调用 Luna。
2. `git ls-remote origin refs/heads/codex/v15-integration-foundation`，Integration 必须包含 PR #33 merge commit `5a0dc529...`；2026-09-15 观测值为 `77bedde231b11342e7bbec40234fc1ee5bcb6860`，仅是契约编写时快照。
3. `gh pr view 33 ...` 必须仍为 MERGED；合并后 CI 必须有 quality、db-validation、browser-qa 成功证据。
4. 分支基线按门禁路径唯一确定：若规划提交已进入 Integration，则从包含该提交的最新鲜 Integration 创建独立 `codex/ui-reconstruction-foundation`（或用户明确指定名称）；若用户授权精确本地规划提交 SHA，则从该授权 SHA 创建独立分支，并记录它对已核验 Integration/PR #33 的 ancestry。不得用未包含本契约的旧 Integration、隐式 cherry-pick 或其他未授权提交拼装基线。
5. `git status --short` 必须确认没有会被覆盖的未知修改。本轮 UI 文档未提交改动必须先由用户/主代理安全保存或纳入明确基线。
6. 记录完整 base SHA、分支、Node/npm 版本和开始时间。基线不满足时停止代码修改并报告，不得在当前 MOBILE-C3 checkout 直接实现。

## 3. 精确允许文件

Luna 仅拥有以下文件；新增文件名固定，若开始时已存在则先报告并由主代理确认是否同用途：

- `apps/web/src/styles/tokens.css`（新增）
- `apps/web/src/styles/foundation.css`（新增）
- `apps/web/src/styles.css`（只允许导入新层、建立兼容别名和删除已被样板证明等价的**样板专属**重复；不得清理全站历史规则）
- `apps/web/src/components/UiPageFrame.vue`（新增）
- `apps/web/src/components/UiPageFrame.test.ts`（新增）
- `apps/web/src/components/UiFormField.vue`（新增）
- `apps/web/src/components/UiFormField.test.ts`（新增）
- `apps/web/src/views/ChangePasswordView.vue`
- `apps/web/src/views/ChangePasswordView.test.ts`（新增）
- `docs/51-ui-component-and-page-spec.md`（只追加 UIR-02 实现记录，不改产品基线）
- `docs/changelog.md`（只追加本地实现与验证记录，未验证不得写通过）

任何其他文件都禁止修改。若 lint/type/test 必须修改清单外文件，停止并回报，不得自行扩大范围。

## 4. 禁止文件与禁止操作

- 禁止：`apps/admin/**`、`apps/api/**`、`packages/**`、`tests/e2e/**`（本任务可运行既有 E2E，不改）、router、stores、composables、offline/sync、Service Worker、Push、Prisma/migration、OpenAPI、canonical 状态文件、PLANS、其他 view/component。
- 禁止全站批量迁移、批量重命名现有 class、删除未验证 cascade/兼容规则、引入第二套 UI 框架或新日期时间库。
- 禁止新增天气服务、AI 会话/API、Provider、定位权限、主题/密度偏好持久化或用户可见开关。
- 禁止改变路由语义、认证/强制改密、API payload、Store、同步、金额/日期规则。
- 禁止 commit、push、创建/更新 PR、部署或修改外部服务。本契约也不授权创建分支。

## 5. Token 与组件合同

### 5.1 Token

`tokens.css` 至少定义并有安全 fallback：

- 颜色：bg/surface/surface-muted、primary/primary-strong/primary-soft、text/text-muted、border/border-strong、success/warning/danger/info、scrim、focus-ring、AI/weather 预留语义。
- 排版：font-family、12/14/16/18/20/24px 语义级、正文/紧凑/标题 line-height、normal/medium/semibold weight。
- 间距：4/8/12/16/20/24/32px；圆角 8/12/16/24px；shadow low/medium/high。
- 控件与布局：control 40/44/48px、page padding、section gap、form max 720px、content max 可配置。
- 层级：base/sticky/popover/dialog/toast；动效 120–220ms，并支持 `prefers-reduced-motion`。
- `data-ui-theme="default"` 和 `data-ui-density="comfortable|compact"` 覆盖点。默认 comfortable；不显示切换 UI、不写 Store/localStorage/API。
- 对现有 `--color-*`、`--v2-*` 只做必要兼容别名；不得一次移除全站旧 token。

### 5.2 `UiPageFrame`

- Props：`title: string`、`titleId: string`、`subtitle?: string`、`maxWidth?: "form" | "content"`。
- Slots：default、`header`（覆盖默认 PageHeader 时仍须保证唯一标题/返回语义）、`filter`、`status`、`action`。名称与 docs/50 和 UIR-00 统一使用单数。
- 默认继续复用现有 `PageHeader`，不能重写 navigation/back 策略。
- DOM 顺序必须为 header → status → filter → content → action；空 slot 不产生多余间距。

### 5.3 `UiFormField`

- Props：`label: string`、`for?: string`、`required?: boolean`、`help?: string`、`error?: string`。`for` 提供时作为 control id；未提供时组件用 Vue `useId()` 生成稳定、同一渲染周期唯一的 control id。
- 组件自身必须渲染 `<label :for="controlId">`，label 内渲染 `label` prop 或 `label` slot；自定义 `label` slot 只替换标签文字内容，不能替换 label 元素。`label` slot props 固定为 `{ label, required }`。
- `required=true` 时，组件在 label 内容后渲染一个 `aria-hidden="true"` 的可见必填标记，并在 default slot 暴露 `required: true`。调用方必须把它同时绑定到唯一控件的 HTML `required` 和 `aria-required`；`required=false` 时不渲染标记，slot prop 为 false。
- Default slot 必须暴露 `{ controlId, describedBy, helpId, errorId, required }`。调用方把 `controlId` 绑定到唯一表单控件的 `id`，把非空 `describedBy` 绑定到该控件的 `aria-describedby`；不得在一个 UiFormField 中放置多个主要控件。
- `helpId = controlId + "-help"`，`errorId = controlId + "-error"`。组件自身负责渲染带对应 id 的 help/error 容器：help 容器内渲染 `help` prop 或 `help` slot，`help` slot props 固定为 `{ help }`，不能替换带 id 的容器；error 不提供自定义 slot。
- 只有 help 实际渲染时才把 `helpId` 加入 `describedBy`；只有 error 实际渲染时才把 `errorId` 加入。error 出现时隐藏 help，因此 `describedBy` 只含 `errorId`，error 容器使用 `role="alert"`；无 help/error 时 `describedBy` 为 `undefined`，不得输出空属性。
- 单元测试覆盖显式/生成 control id、多实例唯一性、默认/自定义 label、默认/自定义 help、required 标记与 slot prop、help/error 容器 id、error 优先级和空描述。ChangePassword 测试必须证明 slot props 已绑定为控件的 id、required、aria-required 和 aria-describedby。
- 本任务只在 ChangePassword 样板使用；不批量替换其他表单。

## 6. ChangePassword 必须保留的行为

- 继续调用 `auth.changePassword(currentPassword, newPassword)`；不改 Store/API。
- 隐藏 username、`autocomplete=username/current-password/new-password`、`minlength=12`、required 均保留。
- 两次新密码不一致时不调用 API，显示中文 `role=alert` 错误并保留输入。
- `submitting` 时禁止重复提交，按钮仍显示“提交中…”。
- ApiClientError 显示安全消息，未知错误显示既有通用中文消息；不得显示 token/原始敏感错误。
- 成功后清空三个密码字段、调用 `allowNavigation()`，并以 `router.replace(returnTarget)` 返回。
- `auth.mustChangePassword` 提示必须保留；普通返回/取消继续走安全 `returnTarget` 和未保存保护。
- 不在 DOM、日志、测试快照中记录真实密码。

## 7. 验收标准

1. 仅精确允许文件有差异，且无管理端/API/Store/router/数据库改动。
2. token 分类完整，样板新增 CSS 不出现未解释的颜色、spacing、radius、shadow、z-index magic number。
3. 新旧 token 兼容，未迁移页面的 computed styles/关键 E2E 不因导入顺序回归。
4. UiPageFrame 四类插槽、空 slot、max-width 和 UiFormField label/help/error/required 有 unit 覆盖。
5. ChangePassword 正常、强制改密、密码不一致、API 错误、提交中、成功返回、取消/Browser Back 未保存保护有 unit 或既有 E2E 证据。
6. 375/390/430/768/1440 无横向溢出、遮挡或按钮重叠；200% 文本仍可操作；键盘焦点清晰。
7. default/comfortable 为正式默认；compact 仅证明 token 覆盖，不新增用户开关。
8. 不把 UIR-03～12、天气、AI 对话、桌面导航或管理端写成已实现。

## 8. 验证命令

Luna 必须依次运行并回报真实输出：

```powershell
npm run format:check
npm run --workspace @daily-assistant/web lint
npm run --workspace @daily-assistant/web typecheck
npm run test --workspace @daily-assistant/web -- src/components/UiPageFrame.test.ts src/components/UiFormField.test.ts src/views/ChangePasswordView.test.ts
npm run quality
git diff --check
git status --short
```

若 workspace script 名称与实际 package 不符，先由主代理核验 `package.json` 后在不改配置的前提下使用等价既有命令，并在报告说明。`npm run quality` 为强制项，因为 `styles.css` 是共享入口。

## 9. 五档浏览器检查矩阵

每个宽度都检查 default/comfortable；1440 另检查 compact；所有宽度检查 200% 文本。证据记录截图路径、URL、viewport、结果、console error 和失败网络请求。

| 检查 | 375 | 390 | 430 | 768 | 1440 |
|---|---:|---:|---:|---:|---:|
| 普通修改密码布局、长中文、无横向滚动 | 必须 | 必须 | 必须 | 必须 | 必须 |
| 强制改密说明、字段、固定/普通操作区不遮挡 | 必须 | 必须 | 必须 | 必须 | 必须 |
| 密码不一致、API 失败、loading/disabled | 必须 | 必须 | 必须 | 必须 | 必须 |
| Tab 顺序、focus-visible、Enter 提交 | 必须 | 必须 | 必须 | 必须 | 必须 |
| 取消、Browser Back、应用内返回、未保存保护 | 必须 | 必须 | 必须 | 必须 | 必须 |
| 200% 文本 | 必须 | 必须 | 必须 | 必须 | 必须 |
| compact token smoke | 不要求 | 不要求 | 不要求 | 可选 | 必须 |
| console/network 失败可解释、无敏感信息 | 必须 | 必须 | 必须 | 必须 | 必须 |

本任务不得修改 E2E 文件；若既有选择器因纯视觉包装失效，应优先保持可访问名称和 DOM 合同。确需改 E2E 时停止，交由主代理决定是否修订契约。

## 10. Luna 完成报告格式

```text
UIR-02 IMPLEMENTATION REPORT
STATUS: complete | partial | blocked
BASELINE: branch + full base SHA + start status
CHANGES: file-by-file actual diff summary
BEHAVIOR PRESERVED: auth/API/unsaved/back/success/error evidence
TOKENS_AND_COMPONENTS: exact token groups, props, slots and compatibility aliases
VERIFIED: exact commands, exit codes and concrete test counts
VIEWPORT_MATRIX: 375/390/430/768/1440 + 200% + compact evidence paths
OUT_OF_SCOPE: confirmation that forbidden areas are untouched
JUDGMENT_CALLS: decisions not fixed by contract, or none
GAPS: failed/unrun/unverified items
WORKTREE: final git status; commit/push/PR/deploy must all be NOT_PERFORMED
```

完成声明没有命令输出、diff 和五档证据则无效。

## 11. 主代理独立复核

主代理不得只采信 Luna 报告，必须：

1. 记录复核前后 `git status --short` 和完整 diff，确认无清单外文件及用户改动覆盖。
2. 逐项比对 token、props/slots、ChangePassword 保留行为和禁止范围。
3. 独立重跑 focused tests、`npm run quality`、`git diff --check`。
4. 独立抽查五档证据、200% 文本、Back/未保存、console/network；对失败格标 FAIL，不得降级为“基本通过”。
5. 使用 fresh `gpt-5.6-sol` 做 context-clean、行为只读的最终审查；若宿主未强制 read-only，记录实际 sandbox/permission 并验证审查前后 worktree 未变。
6. 只有 verdict 为 ship 且所有强制门禁通过，才可报告 `DONE_LOCAL`；仍不得 commit/push/PR/deploy。任何修复后必须重新复核。
