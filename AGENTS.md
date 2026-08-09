# AGENTS.md

## 项目范围

- 本项目实现独立的 Daily Assistant，不属于开封旅游助手。
- `docs/` 是产品、业务、数据、API、架构、测试、部署和开发交接的事实来源。
- V1.5 任务以 `PLANS.md`、`.project/v15-execution-state.md`、当前 `tasks/*.md` 与冻结基线为执行入口。
- 只实施当前任务契约明确允许的工作包。
- 未经用户明确要求，不得创建生产资源、购买服务、发布应用或开放公网注册。

## 产品不变量

- 首发面向约 10 名由管理员创建账号的受邀用户，容量上限可配置。
- 邮箱注册、邀请码注册和截图 OCR 已下线，不得继续作为当前产品不变量或执行依据。
- 账号关闭释放容量；暂停账号仍占容量；恢复必须重新检查容量。
- 同一用户的数据必须按用户 ID 强制隔离，管理员默认不能读取用户账单、日程、待办和行程正文。
- 金额使用定点小数或最小货币单位，禁止二进制浮点计算。
- 业务时间默认 `Asia/Shanghai`，API 时间使用 ISO 8601，API 边界 ID 使用字符串。
- 云端是同步主副本；客户端支持本地缓存、离线写入、重试和冲突确认。
- AI 只生成草稿、Proposal 或建议，不得未经确认写入正式账单、日程、待办或行程。

## 架构不变量

- 保持一个 NestJS 单体后端、一个 MySQL 数据库、一个 Vue PWA 用户端和一个 Vue Element Plus 管理端。
- 不引入微服务、消息队列、事件总线或未被具体用例要求的基础设施。
- 第三方 AI、通知和对象存储必须通过适配层接入，并提供失败降级。
- 快捷指令使用可撤销的设备凭证和幂等键，禁止在快捷指令中保存账户密码。
- V1.5 必须在现有 V1 上增量集成，不得无依据重复开发已有能力。

## 安全规则

- 使用安全密码哈希、DTO 校验、参数化数据库访问、登录限流、精确 CORS、安全 Cookie/令牌策略和生产安全错误响应。
- 不记录或提交密码、令牌、Cookie、数据库凭据、API Key、私钥、个人账单正文或原始敏感错误。
- 文件上传必须限制类型、大小、生成安全文件名并防止路径穿越。
- 所有管理写操作和高风险用户操作必须记录脱敏审计。

## 工作纪律

- 开始 V1.5 任务前必须按“Project State Recovery”与“Required Workflow Before Every Task”恢复项目状态，并读取 `PLANS.md`、`.project/v15-execution-state.md`、`.project/context.md`、`.project/session.md`、当前任务契约及 GitHub 实际状态。
- 修改前先分析现状并列出计划：说明任务目标、影响范围、涉及文件、兼容性检查和验证方式；发现计划超出任务范围时必须先与用户确认。
- 不得擅自改变整体架构、技术栈、目录结构或产品不变量；架构性变更必须先成文并经用户确认。
- 只修改任务相关文件；不得修改无关业务代码，不得删除已有功能，不得破坏用户未提交修改。
- 涉及数据库、接口、部署配置时，必须先检查兼容性：数据字典/枚举一致、OpenAPI 契约同步、migration 与回滚策略、环境变量、CORS/安全配置。
- 修改完成后必须运行对应检查或测试；跨工作区或共享配置变更必须通过 `npm run quality` 与 `git diff --check`。
- 完成任务后必须更新项目进度文档（`.project/v15-execution-state.md`、`.project/context.md`、`.project/session.md`、`docs/progress.md`、`docs/changelog.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`）。
- 完成功能时同步更新实现、测试、文档、状态与验收记录；未完成或未验证的功能不得写成已完成或已验证。
- 每个任务应形成清晰、独立的 Git 提交；提交前检查 `git diff`，只包含本任务相关改动。
- 无法确认的信息必须明确标注“待确认”“未发现实现”或“文档与代码不一致”，不得猜测或编造。
- 保留用户未提交修改，禁止破坏性 Git 操作和未经授权的历史改写。
- 数据库、API、前端枚举必须与数据字典一致。
- 未经授权不得提交、推送、创建 PR、部署或更改外部服务。

## 接手阅读顺序

1. `AGENTS.md`：项目约束与纪律。
2. `PLANS.md`：V1.5 唯一执行总路线。
3. `.project/v15-execution-state.md`：V1.5 实时任务、HEAD、PR、CI、门禁和证据。
4. `.project/context.md`：长期项目状态。
5. `.project/session.md`：当前或最近一次未完成任务。
6. 当前 `tasks/*.md`：当前任务执行契约。
7. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`：进度快照。
8. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`、`.project/decisions.md`：项目与架构上下文。
9. `docs/40-v15-final-development-baseline.md` 与当前任务相关详细文档。
10. 实现代码与对应详细文档：`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md` 等。

## Project State Recovery

1. 每次开始任何开发、修复、测试、重构或部署相关任务前，必须先恢复项目状态；恢复完成前不得修改业务代码。
2. 恢复顺序为：
   1. `AGENTS.md`
   2. `PLANS.md`
   3. `.project/v15-execution-state.md`
   4. `.project/context.md`
   5. `.project/session.md`
   6. 当前任务契约
   7. `docs/progress.md`
   8. `docs/roadmap.md`
   9. `docs/changelog.md`
   10. `docs/architecture.md`
   11. `README.md`
   12. 当前 Git 状态（分支、HEAD、`git status --short`、未提交修改）
   13. 最近相关提交、开放 PR 与 CI
   14. 与当前任务相关的实际代码
3. 不得依赖聊天历史作为项目唯一记忆。
4. 不得仅依据文档判断功能是否完成。
5. 必须使用实际代码、Git 历史、测试结果和项目文档交叉验证。
6. execution state 与 context/session 冲突时，先核验 GitHub 实际分支、HEAD、PR 和 CI，再同步修正；不得凭旧文档自行选择。
7. 在恢复项目状态之前，不得修改业务代码。
8. 当前用户明确提出的任务始终优先；状态恢复只补充上下文，不得覆盖用户当前指令。
9. 不得因为 roadmap 中存在其他任务，就擅自执行无关任务。
10. 用户只说“继续开发”或“接着做”且没有指定任务时，才按照以下顺序选择：
    - `.project/v15-execution-state.md` 中的 `IN_PROGRESS` 或 `VERIFYING` 任务；
    - `.project/session.md` 中未完成任务；
    - `.project/context.md` 中 Current Task；
    - `PLANS.md` 中依赖和门禁满足的下一任务。
11. 一次只执行一个范围明确的任务；不得在完成用户任务后自动连续执行其他任务。
12. 遇到以下情况必须暂停并询问用户：
    - 项目目录不正确；
    - 任务目标不明确；
    - 存在来源不明的未提交修改或未记录 PR/分支；
    - 文档与代码严重冲突且无法安全判断；
    - 需要密钥、账号或外部权限；
    - 需要修改生产环境；
    - 涉及破坏性数据库迁移；
    - 多个实现方案会改变整体架构。

## Required Workflow Before Every Task

## Step 1: Restore project state

读取：

- `PLANS.md`
- `.project/v15-execution-state.md`
- `.project/context.md`
- `.project/session.md`
- 当前任务契约
- `docs/progress.md`
- `docs/roadmap.md`
- `docs/changelog.md`
- 必要时读取 `README.md`、`docs/architecture.md` 和 `.project/decisions.md`

## Step 2: Inspect repository state

检查：

- 当前分支
- 当前 HEAD
- `git status --short`
- 当前未提交修改
- 最近相关 Git 提交
- 开放 PR 和 CI
- 当前任务涉及的代码

## Step 3: Reconstruct working context

恢复：

- 当前开发阶段
- 上次完成的任务
- 当前未完成任务
- 下一项任务
- 当前阻塞
- 已知问题
- 测试与构建状态
- 重要技术约束
- 当前修改过但未提交的文件

## Step 4: Reconcile

- 文档与代码交叉验证；
- 未测试功能不得标记为已完成；
- 计划中的功能不得写成已实现；
- 不覆盖未知未提交修改；
- 不猜测无法确认的状态。

## Step 5: Execute current user request

- 当前用户请求优先；
- 不执行无关 roadmap 任务；
- 先说明实施计划，再修改代码；
- 只修改当前任务相关文件。

## Step 6: Verify

根据项目能力运行适用的：

- `npm run check:context`
- `npm run quality`
- `git diff --check`
- focused lint/typecheck/unit/integration/database/E2E

明确区分：已通过、失败、未运行、无法运行。

## Step 7: Persist state

所有 V1.5 任务结束或暂停前必须更新：

- `.project/v15-execution-state.md`
- `.project/context.md`
- `.project/session.md`
- `docs/progress.md`
- `docs/changelog.md`

任务改变架构、范围或重要技术决策时，再更新：

- `PLANS.md`
- `docs/architecture.md`
- `.project/decisions.md`
- `docs/decisions.md`
- `docs/roadmap.md`
- `README.md`

## Step 8: Report

最终报告必须包含：

- 恢复出的项目状态
- 本次执行任务
- 修改文件
- 测试结果
- 未验证内容
- 阻塞问题
- 下一项建议任务
- Git 工作区状态
- 是否创建提交
- 提交哈希
- PR 与 CI 状态

## Task Completion State Updates

每次任务完成或暂停前，都必须更新项目状态；不得只更新代码而不更新项目状态文档。

如果任务尚未完成：

- `.project/v15-execution-state.md` 保留真实状态、分支、证据和 blocker；
- `.project/session.md` 保留当前任务；
- 记录完成比例、已完成步骤、下一步操作、阻塞原因；
- 不得将任务写入 Completed。

如果任务已完成：

- 在 execution state 中区分 `DONE_LOCAL`、`DONE_COMMITTED`、`DONE_PUSHED`、`DONE_INTEGRATION` 和 `RELEASED`；
- 将任务从 Current Task 移入 Last Completed Task；
- 清空或更新 session；
- 更新 Next Recommended Task；
- 记录测试结果、相关文件、真实 Git 提交和 PR 信息。

更新 `.project/context.md` 时必须：

- 更新 Last Updated；
- 更新当前分支和最近提交；
- 更新 Completed Work、Remaining Work、Verification Status、Recent Changes、Next Recommended Task；
- 记录未解决的 Blockers 和 Known Issues；
- 不得把未测试或失败的功能写成已完成；
- 不得把计划中的功能写成已实现；
- 不得记录任何密钥、密码、令牌、Cookie 或私钥。

提交顺序（如果本次任务需要创建 Git 提交）：

1. 先完成修改和可执行验证；
2. 更新项目状态文档；
3. 审查完整 diff；
4. 创建任务提交；
5. 记录真实提交哈希，不得虚构；
6. 不要为了只更新哈希而制造无限循环提交。

## Safety Rules

- 未经授权不得 `git push`；不自动部署；不修改生产环境。
- 不读取无关敏感文件；不提交 `.env`、密钥、令牌或私钥。
- 不执行破坏性 Git 命令，不 force push，不覆盖远程未知提交。
- 不删除已有功能；不进行无关重构。
- 不把失败或未测试功能标记为完成；不自动连续执行多个大型任务。

## 验证要求

- 共享配置或跨工作区变更必须通过格式、Lint、类型、单元测试和构建。
- 数据库变更必须验证 schema、migration、回滚策略和关键并发规则。
- 用户页面必须在 375、390、430、768 和 1440 CSS 像素检查主要流程、错误状态、离线状态、浏览器 Back、控制台和网络失败。
- 容量上限、并发抢占最后名额、快捷指令重复提交、用户数据隔离和离线同步是强制测试项。
- 项目状态文件一致性通过 `npm run check:context` 检查（已并入 `npm run quality`）。
