# 待办编辑 UI 样板 — Impeccable / 2026-10-26

状态：本地样板完成 / UNCOMMITTED；功能测试与构建通过，完整 quality 未通过（最终依赖审计连续超时，结果待验证）；未提交、推送、创建 PR、合并或部署。本记录不替代 canonical 状态、冻结基线或正式发布验收。

## 授权与范围

- 用户委托选择、安装并使用成熟 UI skill，改进先前不满意的界面。沿用 docs/50 的暖白、紫色及既有 Vue PWA 架构，先完成待办编辑这一处可运行样板。
- 复用 `codex/preview-readiness-20261022` checkout，基线 `fbb993342fe1def0f87853a1496e85c14f2bbd89`；保留工作包 A 的全部未提交修改。原 `D:\daily-assistant` 四项未提交内容未改动。
- 本轮只改 `PlannerDetailView.vue`、对应测试及相关文档。未改 API、DTO、数据库、路由、依赖、运行配置或设计系统全局 token，无迁移需求。

## Skill 安装与使用

- 通过内置 skill-installer 安装官方源 [pbakaus/impeccable](https://github.com/pbakaus/impeccable)，固定提交 `3671d50f0ac9a662ce0615e85a256110c9cd720b`，技能版本 4.7.1。
- 安装目录：`C:\Users\hebia\.codex\skills\impeccable`。版本化 CLI 由官方启动器下载并按 SHA256 校验；没有修改项目依赖，也没有添加自动钩子。
- CLI context 确认没有 PRODUCT.md / DESIGN.md，但现有界面支持 `SCOPED_EXISTING_ALLOWED`。本轮采用 distill → polish 的局部精简流程，不启动全站重设计。
- 完成 UI 后手动执行一次 `detect --json apps/web/src/views/PlannerDetailView.vue`，结果 `[]`。这是自动规则未发现问题，不代表审美或可用性已获用户验收。

## 实现

- 待办编辑时只保留“编辑待办”主标题，隐藏重复详情标题、编辑说明和可视分组标题；语义 fieldset/legend 保留。
- 长标题改用多行文本框，保留必填、200 字限制、自动焦点与可访问名称。保存字段、版本号、取消确认和失败重试逻辑不变。
- 移除编辑页的嵌套卡片，统一字段间距、字体与边框；保存/取消改为文档流中的操作区，保留既有根导航。
- CSS 仅在待办编辑状态生效。待办详情、日程及提醒的原有布局不受此样板样式覆盖。

## 验证

- 定向组件测试 45/45 通过，包含日程/提醒编辑、保存载荷、失败重试、未保存离开及焦点恢复。新增待办编辑单一标题及取消返回详情的断言。
- 首次完整 quality 在测试文件 typecheck 失败：组合选择器的元素类型未显式声明。已补充 input/textarea 联合类型；该首次失败保留在 `quality.log`。
- 第二次 quality 的 context、format、lint、typecheck、测试、全部工作区构建、Prisma、OpenAPI 和离线 migration diff 通过。业务测试共 1154 passed / 140 skipped（未配置测试数据库，数据库测试未运行），Web 499/499；未连接数据库执行迁移。执行环境 Node 24.16.0 / 隔离 npm 11.18.0。
- 第二次 quality 在最终安全审计因 `npm audit` 30 秒超时退出 1。单独重试 `audit:dependencies` 再次超时；没有改变超时阈值、审计策略或依赖来绕过。当前依赖风险结果未知，不能用上轮审计或本轮其他阶段通过代替。证据：`quality-retry.log`、`audit-retry.log`。
- 浏览器使用真实 Vue 前端与仅监听 `127.0.0.1` 的合成接口。待办保存仅更新进程内的假数据，没有真实账号或数据库写入。

| 检查项                                   | 375  | 390  | 430  | 768  | 1440 |
| ---------------------------------------- | ---- | ---- | ---- | ---- | ---- |
| 编辑布局、无横向溢出、操作区不被导航遮挡 | PASS | PASS | PASS | PASS | PASS |
| 首页入口触发未保存提醒，取消保留输入     | PASS | PASS | PASS | PASS | PASS |
| 浏览器 Back 触发提醒，取消保留输入       | PASS | PASS | PASS | PASS | PASS |
| 长标题与保存 503 错误布局                | PASS | PASS | PASS | PASS | PASS |
| 真正断网、恢复同步、真机软键盘           | 待测 | 待测 | 待测 | 待测 | 待测 |

- 390 宽度验证日期弹层打开/取消、清除后确认、无截止时间保存、优先级修改、503 后草稿保留及重试成功；1440 下确认离开后实际返回首页。
- 390 宽度检查共用日程编辑字段完整。提醒回归由组件测试覆盖，本轮没有浏览器提醒流程证据。
- 正常与故障恢复后读取浏览器 warning/error 日志为空。HTTP 503 注入不等于真实离线模式。
- 本地证据目录（Git 忽略）：`output/browser-qa/task-edit-impeccable/`，包含五档正常/错误截图、`browser-matrix.json`、日程回归截图、detector 结果和 quality 日志。
- 已关闭本轮测试标签页与两个临时服务，恢复浏览器视口；截图和证据保留。最终源代码与文档 diff 已审查。

## 局限与后续

- 这是单页样板，不表示全站已经采用 Impeccable 重做。日期弹层仍使用现有组件；弹层 Back、日期弹层视觉统一等原有问题未在本轮扩展处理。
- 桌面浏览器视口测试不能替代 iPhone/Android 真机、软键盘、安全区、安装 PWA 或真实离线验收。正式页面验收矩阵仍有这些缺口。
- 没有本次提交哈希、远端 PR/CI 或上线证据；旧 PR #83 的 CI 不包含这些本地修改。当前工作无需用户提供账号或付费服务。
- 发布前需要补过依赖安全审计；本轮未诊断或改动全局网络配置。该缺口不影响用户查看本地单页样板。
- 后续先由用户查看实际样板效果，再决定是否按同一规则扩展到其他页面；提交与发布仍需对应动作授权。
