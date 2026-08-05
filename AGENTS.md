# AGENTS.md

## 项目范围

- 本项目实现独立的 Daily Assistant，不属于开封旅游助手。
- `docs/` 是产品、业务、数据、API、架构、测试、部署和开发交接的事实来源。
- 只实施 `docs/12-development-handoff.md` 中标记为当前的工作包。
- 未经用户明确要求，不得创建生产资源、购买服务、发布应用或开放公网注册。

## 产品不变量

- V1.0 面向 10–20 名受邀用户，容量上限可配置。
- 邀请码永远不能绕过全局有效用户上限。
- 账号关闭释放容量；暂停账号仍占容量；恢复必须重新检查容量。
- 同一用户的数据必须按用户 ID 强制隔离，管理员默认不能读取用户账单、日程、待办和行程正文。
- 金额使用定点小数或最小货币单位，禁止二进制浮点计算。
- 业务时间默认 `Asia/Shanghai`，API 时间使用 ISO 8601，API 边界 ID 使用字符串。
- 云端是同步主副本；客户端支持本地缓存、离线写入、重试和冲突确认。
- AI/OCR 只生成草稿或建议，不得未经确认写入正式账单、日程、待办或行程。

## 架构不变量

- 保持一个 NestJS 单体后端、一个 MySQL 数据库、一个 Vue PWA 用户端和一个 Vue Element Plus 管理端。
- 不引入微服务、消息队列、事件总线或未被具体用例要求的基础设施。
- 第三方 OCR、AI、邮件和对象存储必须通过适配层接入，并提供失败降级。
- 快捷指令使用可撤销的设备凭证和幂等键，禁止在快捷指令中保存账户密码。

## 安全规则

- 使用安全密码哈希、DTO 校验、参数化数据库访问、登录限流、精确 CORS、安全 Cookie/令牌策略和生产安全错误响应。
- 不记录或提交密码、令牌、Cookie、数据库凭据、API Key、私钥、个人账单正文或原始敏感错误。
- 文件上传必须限制类型、大小、生成安全文件名并防止路径穿越。
- 所有管理写操作和高风险用户操作必须记录脱敏审计。

## 工作纪律

- 开始任务前必须按“Project State Recovery”与“Required workflow before every task”恢复项目状态，并按 `.project/context.md` 的阅读顺序读取：`.project/context.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md` 和相关工作包文档。
- 修改前先分析现状并列出计划：说明任务目标、影响范围、涉及文件、兼容性检查和验证方式；发现计划超出任务范围时必须先与用户确认。
- 不得擅自改变整体架构、技术栈、目录结构或产品不变量；架构性变更必须先成文并经用户确认。
- 只修改任务相关文件；不得修改无关业务代码，不得删除已有功能，不得破坏用户未提交修改。
- 涉及数据库、接口、部署配置时，必须先检查兼容性：数据字典/枚举一致、OpenAPI 契约同步、migration 与回滚策略、环境变量、CORS/安全配置。
- 修改完成后必须运行对应检查或测试；跨工作区或共享配置变更必须通过 `npm run quality` 与 `git diff --check`。
- 完成任务后必须更新项目进度文档（`.project/context.md`、`docs/progress.md`、`docs/changelog.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`）。
- 完成功能时同步更新实现、测试、文档、状态与验收记录；未完成或未验证的功能不得写成已完成或已验证。
- 每个任务应形成清晰、独立的 Git 提交；提交前检查 `git diff`，只包含本任务相关改动。
- 无法确认的信息必须明确标注“待确认”“未发现实现”或“文档与代码不一致”，不得猜测或编造。
- 保留用户未提交修改，禁止破坏性 Git 操作。
- 数据库、API、前端枚举必须与数据字典一致。
- 未经授权不得提交、推送、创建 PR、部署或更改外部服务。

## 接手阅读顺序

1. `.project/context.md`：实时项目状态与下一步建议。
2. `AGENTS.md`（本文件）：项目约束与纪律。
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`：进度快照。
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`：项目与架构上下文。
5. 当前工作包定义：`docs/12-development-handoff.md`。
6. 实现代码与对应详细文档：`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md` 等。

## Project State Recovery

1. 每次开始任何任务之前，必须先恢复项目状态；恢复完成前不得修改业务代码。
2. 必须按顺序读取：`.project/context.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/changelog.md`、`README.md`（需要时）。
3. 必须检查：当前 Git 分支、最近提交、`git status`、当前未提交修改。
4. 不得仅依赖聊天记录判断项目状态。
5. 不得仅依据 `.project/context.md` 判断实际完成情况。
6. 必须使用实际代码、Git 历史和项目文档交叉验证。
7. 文档与代码不一致时：以实际代码和可验证结果为准；在最终报告中指出不一致；必要时修正项目状态文档。
8. 在恢复项目状态之前，不得开始修改业务代码。
9. 如果当前用户只是提出问题或要求分析，可读取必要上下文，但不得因此擅自开发。
10. 如果用户指定了明确任务，恢复状态后优先执行用户指定任务，而不是擅自选择 roadmap 中的其他任务。
11. 只有当用户明确要求“继续开发”但没有指定具体任务时，才可以依次从以下位置选择下一项任务：
    - `.project/context.md` 中的 Current Task
    - `.project/context.md` 中的 Next Recommended Task
    - `docs/progress.md` 中的进行中任务
    - `docs/roadmap.md` 中依赖已满足的最高优先级任务
12. 开始开发前必须确认：当前目录正确；任务目标明确；验收标准明确；不会覆盖未知未提交修改；不需要缺失的密钥或外部权限。
13. 每次任务完成后必须更新：`.project/context.md`、`docs/progress.md`、`docs/changelog.md`。
14. 每次任务结束时必须记录：本次完成的任务、修改的文件、测试结果、未验证内容、当前阻塞问题、下一项建议任务。
15. 未经用户明确授权：不执行 `git push`；不修改生产环境；不部署上线；不执行破坏性数据库操作；不删除已有功能；不重置 Git 历史。

## Required workflow before every task

Step 1: Read project state

- Read `.project/context.md`.
- Read `docs/progress.md`.
- Read `docs/roadmap.md`.
- Read `docs/changelog.md`.
- Read `README.md` when needed.

Step 2: Inspect repository state

- Run `git status --short`.
- Determine the current branch.
- Inspect recent relevant commits.
- Inspect existing uncommitted changes without modifying them.

Step 3: Reconstruct context

- Determine: current development stage, last completed task, current task, next task, blockers, known issues, verification status, relevant project constraints.

Step 4: Reconcile

- Compare project documents with actual code and Git history.
- Do not assume a feature is complete merely because a document says so.
- Do not mark untested work as verified.
- Preserve unknown uncommitted changes.

Step 5: Execute the user request

- The current user request takes priority.
- Do not automatically execute unrelated roadmap tasks.
- Only choose the next roadmap task when the user explicitly asks to continue development without specifying a task.

Step 6: Verify

- Run relevant tests, type checks, lint, build or focused validation.
- Clearly distinguish passed, failed and not run checks.

Step 7: Persist state

- Update `.project/context.md`.
- Update `docs/progress.md`.
- Update `docs/changelog.md`.
- Update architecture or decision documents only when the task materially changes them.

Step 8: Report

- Include: restored project state, work completed, changed files, validation results, remaining issues, next recommended task, Git status, commit information (if a commit was created).

## Task completion state updates

每次开发任务完成后，必须在结束之前更新 `.project/context.md`，更新时必须：

1. 更新 Last Updated。
2. 更新当前分支和最近提交。
3. 将完成的 Current Task 移入 Last Completed Task。
4. 更新 Completed Work。
5. 更新 Remaining Work。
6. 更新 Verification Status。
7. 更新 Recent Changes。
8. 更新 Next Recommended Task。
9. 记录未解决的 Blockers 和 Known Issues。
10. 不得把未测试或失败的功能写成已完成。
11. 不得把计划中的功能写成已实现。
12. 不得记录任何密钥、密码、令牌、Cookie 或私钥。

提交顺序（如果本次任务需要创建 Git 提交）：

1. 先完成代码修改和测试。
2. 更新项目状态文档。
3. 创建任务提交。
4. 获取真实提交哈希并记录；不得虚构哈希。
5. 不要为了只更新哈希而制造无限循环提交。

## Task priority rules

1. 用户当前明确提出的任务优先级最高。
2. 项目状态恢复仅用于补充上下文，不得覆盖用户当前指令。
3. 用户明确指定功能、缺陷或文件时，只执行该任务。
4. 用户说“继续开发”“接着做”但没有指定任务时，才读取：Current Task、Next Recommended Task、`docs/progress.md`、`docs/roadmap.md`。
5. 一次只执行一个边界明确的任务。
6. 不得因为 roadmap 中还有任务，就在完成用户任务后自动继续执行其他任务。
7. 遇到以下情况必须暂停并询问用户：
   - 多个下一任务优先级相同；
   - 任务会改变整体架构；
   - 存在来源不明的未提交修改；
   - 需要生产环境权限；
   - 需要密钥或账号；
   - 涉及破坏性数据库迁移；
   - 文档与代码存在无法安全判断的严重冲突。

## 验证要求

- 共享配置或跨工作区变更必须通过格式、Lint、类型、单元测试和构建。
- 数据库变更必须验证 schema、migration、回滚策略和关键并发规则。
- 用户页面必须在 375、390、430、768 和 1440 CSS 像素检查主要流程、错误状态、离线状态、浏览器 Back、控制台和网络失败。
- 容量上限、并发抢占最后名额、快捷指令重复提交、用户数据隔离和离线同步是强制测试项。
