# 手机内页导航工作包 A — 2026-10-23

状态：DONE_LOCAL / UNCOMMITTED；本地质量检查及合成接口浏览器验收通过，真机与真实离线验收未完成；未提交、推送、创建 PR、合并或部署。本记录是常规本地改动记录，不改变 canonical 任务、冻结架构或发布门禁。

## 范围与基线

- 用户明确要求按优化规划开发；本轮仅执行 A：多层页面快速回首页和导航可理解性。弹层 Back/编辑标题问题（B）、页面文案和布局清理（C）保留后续。
- 使用现有干净 checkout `codex/preview-readiness-20261022`，本地基线 `fbb993342fe1def0f87853a1496e85c14f2bbd89`。原 `D:\daily-assistant` 四项已有未提交内容保持原样。
- 本轮开始时核对 PR #83 为 Draft，HEAD fbb9933；Integration 为 6cab22f，既有 PR CI 39917149441 通过。该 CI 不包含本次未提交改动，不能作为本次 CI 证据。
- 在线上实际浏览器中观察到内页缺少底部根导航。当前本地代码已包含 #78 的持续底部导航和操作区避让，不重复开发；线上发布版本与本地候选的差异须在后续授权发布时消除。本轮未重新核验服务器 SHA，也未改变线上系统。

## 实现与兼容性

- `navigation-policy.ts` 新增栏目解析，沿既有 `meta.page.parent` 查找所属根入口。待办/日程归计划，账单归记录，行程沿行程列表归我的，快速新增保持独立入口。
- `BottomNav.vue` 和 `SiteHeader.vue` 共用解析：内页显示所属栏目高亮。读屏标记区分当前根页 `page` 与所属栏目 `location`。
- `returnTo` 继续只负责返回来源，不改变栏目归属；未保存内容的确认/取消、根标签 replace、浏览器 Back、顶部返回逻辑保持原实现。
- 无 CSS、路由结构、业务 Store、API/DTO/OpenAPI、数据库/migration、依赖、环境变量或 CORS 变更；无需数据库迁移。现有信息架构、Vue PWA 和后端架构不变。
- 同步 docs/50 与 docs/51 中已被 #78 替代的“深层页面隐藏底部导航”旧规则。

## 自动化验证

- 增补栏目解析、未知/公开/非法父路径/循环终止、父级链、来源 query、手机和桌面高亮、未保存离开取消后栏目保持等覆盖。
- App 单元测试补充：无 access token 的既有离线会话仍显示内页导航；离线身份结束后隐藏。该测试不是浏览器真实断网验收。
- 首轮完整 Web 测试 61 文件、497 项通过；补充离线会话测试后 Web 61 文件、498 项通过。全仓业务测试合计 1153 passed / 140 skipped（数据库集成测试未配置测试数据库，未执行）。
- 首次完整 `quality` 的 context、format、lint、typecheck、tests、build、Prisma 校验通过；OpenAPI 内容校验成功后进程退出触发 Windows libuv `UV_HANDLE_CLOSING` 断言，整套命令失败，后续 migration/audit 未执行。保留 `quality.log`；未修改依赖或配置绕过此错误。
- 第二次完整 `quality` 退出码 0：context、format、lint、typecheck、1153 项测试、全部工作区构建、Prisma、OpenAPI、离线 migration diff、依赖审计均通过；审计无 High/Critical。证据为 `quality-retry.log`，执行环境 Node 24.16.0 / 隔离 npm 11.18.0。此处 migration diff 不连接数据库、不执行迁移。
- 最终文档状态更新后重新运行 `check:context` 和 `git diff --check` 通过，完整 diff 已审查；未创建提交，因此无本轮提交哈希或 CI。
- 新验收文档、README 及新增进度/变更段落的独立格式检查通过。强制检查原本被仓库格式配置排除的 Markdown 时，docs/50、docs/51、progress、changelog 存在历史格式告警；已在 HEAD 原文复现，不为本轮扩大全文格式改动。

## 浏览器操作验收

使用本机实际浏览器、真实前端组件和导航守卫，接口由仅绑定 `127.0.0.1` 的临时合成服务提供。合成数据不含真实用户账单；业务写请求被拒绝。此环境验证交互与布局，不证明数据库、真实同步或线上部署通过。

| 检查项                                         | 375  | 390  | 430  | 768  | 1440               |
| ---------------------------------------------- | ---- | ---- | ---- | ---- | ------------------ |
| 待办编辑：导航可见、无横向溢出、手机保存区避让 | PASS | PASS | PASS | PASS | PASS（桌面顶导航） |
| 新账单：导航可见、无横向溢出、手机保存区避让   | PASS | PASS | PASS | PASS | PASS（桌面顶导航） |
| 待办编辑点首页：取消保留输入，再确认离开       | PASS | PASS | PASS | PASS | PASS               |
| 新账单点首页：取消保留金额，再确认离开         | PASS | PASS | PASS | PASS | PASS               |
| 日程详情：计划高亮、直接回首页                 | PASS | PASS | PASS | PASS | PASS               |
| 行程详情：我的高亮、直接回首页                 | PASS | PASS | PASS | PASS | PASS               |
| 快速新增：当前入口标记、直接回首页             | PASS | PASS | PASS | PASS | PASS               |
| 浏览器 Back：日程详情返回首页                  | PASS | PASS | PASS | PASS | PASS               |
| 注入 HTTP 503：账单错误页可回首页              | PASS | PASS | PASS | PASS | PASS               |
| 真正断网与恢复同步                             | 待测 | 待测 | 待测 | 待测 | 待测               |

- 模拟 503 后移除故障，点击重试恢复账单空列表。正常流程及故障恢复后读取的浏览器 warning/error 日志为空；故障注入用于验证预期错误 UI，不等同离线模式。
- 浏览器 Back 另核验了 1440 下空白新账单返回列表，以及 390 下待办编辑取消离开保留标题/计划高亮、再次确认离开返回首页。弹层打开时 Back 的既有问题归 B，本轮未修复。
- 本地证据位于 `output/browser-qa/nav-a/`（忽略目录）：`browser-matrix.json`、`dirty-browser-back.json`、`task-edit-{width}.png`、`transaction-new-{width}.png`、`error-{width}.png`。截图为合成测试数据。验收结束后已关闭测试标签页及两个本地测试服务，恢复视口设置。

## 未验证与后续

- 本轮未运行真实数据库浏览器 E2E，未调用 AI/通知等外部服务，未作真实持久化写入。
- 浏览器工具未提供真实离线网络控制，本轮仅覆盖离线身份单元边界和 HTTP 503；真实 PWA 断网、重连、冲突处理仍待验收。
- 未做 iPhone/Android 真机、软键盘、系统侧滑、安全区及已安装 PWA 验收。用户目前只能安排一种设备，平台待明确；不得将桌面调整视口记作真机通过。
- A 的本地补全完成后，后续先交付并在现有私有预览验证这一批，再按独立范围处理 B。提交、推送、PR、合并和部署仍需覆盖对应动作的授权。
