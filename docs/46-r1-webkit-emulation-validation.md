# R1 H1/H2 WebKit 本机模拟验收记录（非真机）

记录日期：`2026-09-02 10:33–10:53`（时区：`Asia/Shanghai`）
测试范围：WebKit `iPhone 13` 模拟、真实本机 API 与一次性 MySQL；未使用 API mock 代替页面请求。
测试账号：脱敏临时账号；仅使用合成验收数据。
运行位置：`D:\daily-assistant-runtime`（MySQL、API、Web 与 admin 服务）；验收后已停止服务并释放端口。

> 本记录是本机浏览器模拟证据，不是物理 iPhone Safari/PWA 证据，因此不能关闭 R1 的 H1/H2 人工门禁。

## H1 — WebKit iPhone 13 模拟

| 步骤 | 实际结果 | 结论 |
|---|---|---|
| 登录并进入首页 | 登录成功，进入首页并显示当前临时账号；真实 API refresh 请求成功 | PASS（模拟） |
| 打开待办列表和待办详情 | 待办列表加载；通过真实页面创建待办并进入带对象 ID 的详情页 | PASS（模拟） |
| 打开日程列表和日程详情 | 真实创建一条测试日程，列表显示并可进入日程详情 | PASS（模拟） |
| 打开提醒列表和提醒详情 | 真实创建一条测试提醒，列表显示并可进入提醒详情 | PASS（模拟） |
| 从详情返回列表/上一级 | 待办、日程、提醒详情均按 `returnTo` 返回对应列表，返回按钮文案正确 | PASS（模拟） |
| 浏览器 Back | 待办详情返回列表后执行浏览器 Back，页面保持可用且数据未丢失 | PASS（模拟） |
| 刷新页面 | 待办列表刷新后仍可读取服务端数据 | PASS（模拟） |

模拟结论：`流程通过；H1 真机门禁仍 PARTIAL`。
控制台与页面请求：本次 H1 会话无 console error/warning；登录、待办、详情和同步请求返回 `200/304`。

## H2 — PWA 与离线重开模拟

| 步骤 | 实际结果 | 结论 |
|---|---|---|
| 首次打开并检查 PWA 能力 | manifest 链接存在；Service Worker 注册并达到 `activated`；刷新后页面受 Service Worker 控制；manifest 为 `standalone` | PASS（模拟） |
| 关闭后离线重开 | 重开后仍显示待办页面、本地缓存待办和“当前离线”提示；同时 WebKit 报告了页面、manifest 与离线 API 资源的内部资源错误 | PARTIAL / WARNING |
| 离线新增测试数据 | 新待办立即显示，本地 ID 以 `local-` 开头，页面可继续使用 | PASS（模拟） |
| 恢复网络 | 网络恢复后自动发起同步，`/sync/mutations` 返回 `200`；本地 ID 替换为服务端 ID，离线提示消失 | PASS（模拟） |
| 服务端复核 | 使用同一临时账号直接查询真实 API，测试标题匹配 1 条，未发现重复对象 | PASS（模拟） |

H2 模拟异常：离线重开期间 WebKit CLI 记录了 `WebKit encountered an internal error`，涉及 `/tasks`、`/manifest.webmanifest` 和离线 API 资源；应用壳、本地缓存数据、离线新增和恢复联网同步仍完成。随后在线读取 manifest 返回 `200`，Service Worker 仍受控。一次额外的未带应用授权头的诊断 `fetch` 返回 `401`，不计入产品请求失败。

模拟结论：`离线业务闭环通过但有 WebKit 模拟器资源错误；H2 真机门禁仍 PARTIAL`。该错误尚未能在物理 iPhone Safari 上复现或排除，暂不修改业务代码并不将 H2 标记为正式通过。

## 归档判断

- H1：WebKit iPhone 13 模拟流程通过，不能替代物理 iPhone Safari 记录。
- H2：PWA manifest/Service Worker、离线缓存、离线新增、恢复联网同步均已在本机模拟完成；离线重开存在 WebKit 资源错误，不能替代物理 iPhone PWA 记录。
- R1：保持 `BLOCKED / NOT_READY`；H1/H2 保持 `PARTIAL`。
- 本次未修改业务代码、API、数据库 schema、依赖、部署配置；未创建提交、推送、PR 或部署。
