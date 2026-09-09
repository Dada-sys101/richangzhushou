# AGENTS.md

## 项目范围

- 本项目实现独立的 Daily Assistant，不属于开封旅游助手。
- `docs/` 是产品、业务、数据、API、架构、测试、部署和开发交接的事实来源。
- V1.5 任务以 `PLANS.md`、`.project/v15-execution-state.md`、当前 `tasks/*.md` 与冻结基线为执行入口。
- 有适用任务契约时，只实施其明确允许的工作包。用户明确指定、没有独立契约的常规本地调查、修复或文档工作，可在说明目标、范围和验证方式后开展；不得因此改变冻结架构、发布范围或关闭门禁。
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

- 开始 V1.5 任务前按“Project State Recovery”与“Required Workflow Before Every Task”恢复相关项目状态；读取当前适用契约，按任务依赖核验 GitHub 实际状态，避免重复读取本轮已核验且未变化的信息。
- 修改前先分析现状并列出计划：说明任务目标、影响范围、涉及文件、兼容性检查和验证方式；发现计划超出任务范围时必须先与用户确认。
- 不得擅自改变整体架构、技术栈、目录结构或产品不变量；架构性变更必须先成文并经用户确认。
- 只修改任务相关文件；不得修改无关业务代码，不得删除已有功能，不得破坏用户未提交修改。
- 涉及数据库、接口、部署配置时，必须先检查兼容性：数据字典/枚举一致、OpenAPI 契约同步、migration 与回滚策略、环境变量、CORS/安全配置。
- 修改完成后按影响范围运行检查或测试；影响运行、构建或依赖的跨工作区或共享配置变更必须通过 `npm run quality` 与 `git diff --check`。纯文档变更运行格式、适用的上下文一致性及差异检查，不因跨多个文档自动要求业务全量测试；集成和发布门禁仍须完整执行。
- 完成或暂停任务时按“Task Completion State Updates”持久化状态；只读任务无需写文件，本地变更只更新受影响的记录，canonical 任务进度或交付状态变化时同步核心状态文件及受影响的派生摘要。
- 完成功能时同步更新实现、测试、文档、状态与验收记录；未完成或未验证的功能不得写成已完成或已验证。
- 获得提交授权的任务应形成清晰、独立的 Git 提交；提交前检查 `git diff`，只包含本任务相关改动。未授权提交不妨碍将已验证的本地工作报告为 `DONE_LOCAL`，不得为满足完成要求自行提交。
- 无法确认的信息必须明确标注“待确认”“未发现实现”或“文档与代码不一致”，不得猜测或编造。
- 保留用户未提交修改，禁止破坏性 Git 操作和未经授权的历史改写。
- 数据库、API、前端枚举必须与数据字典一致。
- 未经授权不得提交、推送、创建 PR、部署或更改外部服务。

## 接手阅读顺序

1. `AGENTS.md`：项目约束与纪律。
2. `PLANS.md`：V1.5 唯一执行总路线。
3. `.project/v15-execution-state.md`：V1.5 最近一次合法治理更新时的任务、HEAD、PR、CI、门禁和证据快照；GitHub、Git、CI 和实际部署环境为实时事实。
4. `.project/context.md`：长期项目状态。
5. `.project/session.md`：当前或最近一次未完成任务。
6. 当前 `tasks/*.md`：当前任务执行契约。
7. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`：进度快照。
8. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`、`docs/changelog.md`、`.project/decisions.md`：项目与架构上下文。
9. `docs/40-v15-final-development-baseline.md` 与当前任务相关详细文档。
10. 实现代码与对应详细文档：`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md` 等。

## Project State Recovery

以下为完整恢复顺序。只读调查按问题读取相关规则、文件和证据；本地修改先读取 AGENTS、PLANS、execution-state、context/session 及适用契约，再补充受影响文档。仅当结论或动作依赖远端状态时核验 GitHub/CI/环境；无法访问时明确证据缺口，继续不依赖该事实的本地工作，不宣称远端或发布已验证。

1. 每次开始任何开发、修复、测试、重构或部署相关任务前，必须先恢复项目状态；恢复完成前不得修改业务代码。
2. 按本节任务类型选择相关项，完整恢复顺序为：
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
10. 用户只说“继续开发”或“接着做”且没有指定任务时，按 PLANS 的 Task Selection Policy 和 `nextCanonicalTask` 核验依赖、门禁及当前任务；execution-state、session、context 用于恢复进度，不作为与 PLANS 并行的任务排序源。存在冲突时先核验事实，无法安全归一再询问。
11. 一次只执行一个范围明确的任务；不得在完成用户任务后自动连续执行其他任务。
12. 先通过只读检查和已有上下文解决歧义；能安全隔离的无关修改、可逆实现细节和已存在的有效授权不要求再次确认。以下情况只暂停受影响的动作，并说明具体缺口；可继续独立、安全的工作：
    - 无法确认正确项目目录或任务目标，且合理假设会实质改变范围；
    - 未知修改与拟编辑内容重叠，无法在保留它们的前提下安全执行；未记录分支或 PR 先核验，不因缺少记录单独暂停；
    - 文档与代码严重冲突，无法依据实时事实及有效决策判断；
    - 必需的账号、密钥或外部权限缺失，不得读取无关敏感文件寻找凭据；
    - 生产操作、数据库迁移或其他独立授权动作尚未获得覆盖本次对象和环境的批准；
    - 需要改变整体架构、冻结范围或产品不变量，尚无批准的决策。

## 授权与技能适用边界

- 当前明确用户指令优先于旧状态快照；核验授权的任务、动作、对象、环境、约束及是否已消费。同一有效授权无需重复申请，一次性动作完成后不得复用，也不得扩大到新任务或对象。
- 历史 `NOT_GRANTED`、`PROHIBITED` 或契约 metadata 只约束原检查点和任务范围，不自动撤销后续有效授权；同样不能把历史许可推定为当前许可。
- PLANS 第 13 节的提交、推送、PR、合并、资源、迁移、真实服务及部署等动作仍各自独立授权。“继续”“修复”“调整”不自动包含这些动作。已有授权仍须满足其验证和门禁条件。
- 技能仅在适用任务范围内生效；流程建议和示例不产生额外人工审批。明确的安全保护和工具校验继续保留，不能把技能失败当作扩大权限或绕过门禁的依据。
- 技能或工具确实阻塞时，说明具体文件/规则或错误、受影响动作及可继续的工作；不得仅因推荐步骤未执行而把已验证的本地结果写成失败。用户明确指定执行器时，失败后不得静默换执行器。

## Required Workflow Before Every Task

## Step 1: Restore project state

按 Project State Recovery 的任务类型读取适用项：

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

检查本地状态，并按任务依赖核验远端项：

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

按下节任务类型持久化；canonical 任务进度、交付状态或门禁证据发生变化时更新：

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

最终报告按任务类型包含适用内容；只读任务报告结论、依据和未验证项，无需逐项填写无关状态：

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

按任务类型更新，避免为只读结论或无关状态制造文件改动：

- 只读审查、问答和调查：报告结论、依据及局限，无需更新状态文件。
- 常规本地代码、规则或文档变更：更新相关文档及受影响的进度/变更记录，注明本地完成或未完成、验证和后续步骤；不得覆盖原 canonical 任务。隔离实验在实验目录留证据，未改变项目状态时无需改仓库状态文件。
- canonical 任务进度、交付状态或门禁证据变化：同步 `.project/v15-execution-state.md`、`.project/context.md`、`.project/session.md`、`docs/progress.md`、`docs/changelog.md`，以及受影响的 `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`。保留最近合法治理快照的语义，不虚构晋级。

以下任务完成/暂停字段规则适用于对应 canonical 任务，不要求常规本地工作清空或替换 canonical session。

如果任务尚未完成：

- `.project/v15-execution-state.md` 保留最近一次合法治理更新时的状态、分支、证据和 blocker 快照；
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

- 未经对应独立授权不得 `git push`、部署或修改生产环境；已有授权仍须满足对象、环境、验证和发布门禁条件。
- 不读取无关敏感文件；不提交 `.env`、密钥、令牌或私钥。
- 不执行破坏性 Git 命令，不 force push，不覆盖远程未知提交。
- 不删除已有功能；不进行无关重构。
- 不把失败或未测试功能标记为完成；不自动连续执行多个大型任务。

## 验证要求

- 影响运行、构建或依赖的共享配置或跨工作区变更必须通过格式、Lint、类型、单元测试和构建；纯文档按工作纪律中的文档检查执行。
- 数据库变更必须验证 schema、migration、回滚策略和关键并发规则。
- 用户页面行为或布局变更必须在 375、390、430、768 和 1440 CSS 像素检查受影响主要流程、错误状态、离线状态、浏览器 Back、控制台和网络失败；正式页面验收保留完整矩阵。
- 容量上限、并发抢占最后名额、快捷指令重复提交、用户数据隔离和离线同步，在相关功能变更及完整集成/发布验收中是强制测试项；不要求无关文档任务重跑。
- 项目状态文件一致性通过 `npm run check:context` 检查（已并入 `npm run quality`）。
