# AGENTS.md

## 项目范围

- 本项目是独立的日常助手 / Daily Assistant。
- `main` 是稳定 V1；`codex/v15-integration-foundation` 是 V1.5 集成线。
- `PLANS.md`、`.project/v15-execution-state.md` 和当前 `tasks/*.md`
  是 V1.5 执行入口。
- 未经授权不得创建生产资源、购买服务、开放公网注册、合并或部署。

## 产品不变量

- 首发约 10 名管理员建号的用户，容量上限可配置。
- 邮箱注册、邀请码注册和截图 OCR 已下线。
- 用户数据按 userId 强制隔离，管理员默认不能读取生活数据正文。
- 金额使用 Decimal/最小货币单位；时间默认 Asia/Shanghai，API 使用 ISO 8601。
- 服务端数据库是正式权威；客户端支持缓存、离线、重试和冲突确认。
- AI 只生成 Proposal；所有正式写入必须由用户确认。
- 站内提醒保底；Web Push 可关闭，不得显示虚假启用状态。

## 架构不变量

- NestJS 单体、MySQL、Vue PWA 和 Vue 管理端。
- 不引入微服务、消息队列、Kubernetes 或无明确用例的基础设施。
- AI、通知、对象存储必须通过适配层并有降级。
- V1.5 增量集成，不重建现有 V1。
- 不可逆清理和生产发布必须单独批准。

## 安全规则

- 不记录或提交密码、Cookie、Token、数据库凭据、API Key、私钥和敏感正文。
- 上传限制类型/大小并防路径穿越。
- 管理写操作和高风险操作写脱敏审计。
- 模型和第三方 Provider 不得直写业务表。

## 强制恢复顺序

1. `AGENTS.md`
2. `PLANS.md`
3. `.project/v15-execution-state.md`
4. `.project/context.md`
5. `.project/session.md`
6. 当前任务契约
7. `PROJECT_STATUS.md`
8. `MASTER_PLAN.md`
9. `docs/progress.md`
10. `docs/roadmap.md`
11. 决策文档
12. GitHub 分支、HEAD、开放 PR、CI、提交和实际代码

不得把聊天历史作为唯一记忆。

## 状态冲突

- GitHub 实际代码/PR/CI 优先；
- 冻结技术基线优先于历史路线图；
- execution state 与 context/session 冲突时先核验 GitHub；
- 未知分支、PR、修改或严重冲突时停止；
- 不确认的信息写“待确认/未验证”，不得猜测。

## 每个任务的流程

### 1. 恢复
恢复阶段、完成项、当前任务、下一任务、门禁和验证。

### 2. 审查
修改前输出任务 ID、可执行原因、依赖、范围、禁止项、验证和授权。
任务不符合进度时停止。

### 3. 核验
检查分支、HEAD、工作树、开放 PR、CI、相关提交和实际实现。

### 4. 执行
一次一个任务，只改允许文件；不删功能、不做无关重构；架构变化先 ADR。

### 5. 验证
运行适用的 check:context、quality、diff check、focused tests、数据库测试和 E2E。
明确 PASS/FAIL/NOT_RUN，不得虚构。

### 6. 持久化
所有 V1.5 任务结束或暂停前更新 execution state、context、session、progress、
roadmap 和相关计划/决策。

### 7. 报告
报告状态、修改、验证、未运行项、阻塞、Git/PR 状态和下一任务。

## 状态纪律

- 同时最多一个工程任务 IN_PROGRESS；
- 无验证证据不得 DONE_LOCAL；
- 区分 COMMITTED、PUSHED、INTEGRATION、RELEASED；
- 人工门禁不得自动关闭；
- 当前任务未合入前不得自动开始下一任务。

## Git 和外部操作

- 未经契约授权不得 commit/push/PR/merge/部署/创建云资源；
- 提交前审查完整 diff；
- 一个任务使用清晰独立提交，不制造逐文件提交；
- 禁止破坏性 Git；
- PR 不自动合并；
- 真实 AI、Push、OSS、Staging 和生产均需独立授权。

## V1.5 门禁

- H1/H2/H7 阻塞 R1；
- H6/H8 只阻塞 Push；
- H4 阻塞 Android 正式支持声明；
- H3/H5 为记录限制/观察；
- R3 迁移清理不阻塞 R1；
- AI-DECISION-001 阻塞 PR2，不阻塞 PR6a。
