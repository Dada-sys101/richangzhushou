# Codex Cloud 原生 Integration Bootstrap

任务：V15-CLOUD-NATIVE-BOOTSTRAP-022。交付范围：本地实现与验证；无提交、推送、PR、合并或 Environment 发布。业务代码、依赖版本及既有 Setup 未改。

## 启动机制与推荐方案

| 机制 | 当前证据 | 使用方式 |
| --- | --- | --- |
| Environment Install script | 当前状态接口未返回 Install 正文、任务执行频率或缓存语义 | 用于依赖准备；不能据此认定每个任务会切换 Git 分支 |
| Environment Startup | 当前工具未提供可验证的任务级 Startup 能力 | NOT_VERIFIED；不作为本方案前提 |
| 仓库脚本 | Integration 有 `scripts/codex-cloud-setup.mjs`；本次增加独立 Bootstrap | Agent 在任务开始时明确执行 |
| AGENTS.md | 是 Agent 读取的规则，不是 shell hook | 可提示启动协议，不保证在任意旧分支上自动触发 |
| Skill / 可复用任务指令 | 可提供启动协议；本次未安装 Skill | 需要当前任务明确调用，不能推定为任务级自动执行 |
| 每次任务开头执行 Bootstrap | 原生 Git 切换与 Setup 已有实测证据 | **当前推荐**：复制一个任务前缀，由 Agent 执行全部初始化 |

移动端只能选择 Environment，不能选 Integration。当前无法证明零手动初始化；用户仍需在任务正文提供启动前缀。Agent 会执行 Git 和 Setup，用户无需在手机上逐条运行 shell 命令。

### 从旧 main 安全取得启动器

启动器是仅依赖 Node 内建模块的单文件，可以在 Git 切换前从批准提交导出到私有临时目录。启动器路径不存在时立即停止，不能运行旧 main 的替代脚本，也不能下载未经批准的 latest 版本。

下面是**正式交付后**的启动协议，不是本任务中已发布的操作：

1. 在 `/workspace/richangzhushou` 检查顶层目录、origin 身份与 Git Clean。保留任何现有更改。
2. Fetch `refs/heads/codex/v15-integration-foundation`；确认 `FETCH_HEAD` 等于当次完整批准 SHA。
3. 用 `git show <批准SHA>:scripts/codex-native-bootstrap.mjs` 导出到新建的私有临时目录；导出失败停止。
4. 用 Node 24 执行导出的单文件，传入原生仓库目录、任务 ID 和批准 SHA。脚本再次验证 Fetch、创建唯一功能分支、执行 Setup。
5. 仅 `BOOTSTRAP_READY` 或 `BOOTSTRAP_ALREADY_READY` 允许进入开发；后续命令必须显式使用输出的 `cwd`。Bootstrap 不改变 Agent 的默认执行目录。

当前批准 SHA `20f8e7044958b8f01278392a9b97f379839a8ad5` 还没有新启动器。本次测试从已审查的本地隔离实现调用脚本，初始化代码仍基于此 SHA。新任务不能依赖本地 scratch 路径恢复。Commit Gate、Push/PR/Merge Gate 完成后，必须重新批准包含启动器的 Integration SHA，再使用上述导出协议；不得继续使用旧 SHA 并假定启动器已存在。

## 本地 Bootstrap 使用

```bash
node /已审查的启动器路径/codex-native-bootstrap.mjs bootstrap \
  --repo /workspace/richangzhushou \
  --task 唯一任务ID \
  --sha 当次批准的40位SHA
```

任务 ID 允许字母、数字、点、下划线和连字符，最长 80 字符。每个新任务使用新 ID；同一初始化操作重试使用相同 ID。唯一分支名为 `codex/task-<任务ID>-<随机值>`，直接基于批准 Integration SHA 创建。不会覆盖 `work`、`main` 或现有 Integration 分支，不设置 upstream。

结果写 stdout JSON，阻断返回退出码 1。状态和 Setup 日志位于实际 Git metadata 目录下的 `codex-native-bootstrap/`；不进入 Git 差异。状态包含原始分支/HEAD、功能分支、批准 SHA、Setup 阶段和日志路径。

| 状态 | 含义 |
| --- | --- |
| `BOOTSTRAP_READY` | SHA、祖先、merge-base、空差异、Setup 和现有产物检查通过 |
| `BOOTSTRAP_ALREADY_READY` | 同一任务、同一功能分支、同一初始 HEAD，锁文件/关键产物指纹未变化，且固定范围依赖加载与锁定版本检查通过；重新 Fetch 验证批准 SHA，复用产物，不重复安装 |
| `BOOTSTRAP_BLOCKED` | 依据 `code` 停止。失败不自动 stash、reset、clean、切到其他分支或放宽网络权限 |

重复初始化要求工作区干净且 HEAD 仍为批准 SHA；开发后再次运行会停止，避免重置或污染已开展的任务。若其他分支处于活动状态，同一任务重试不会自动切回。Setup 失败保留功能分支、失败状态和日志；修复原因需对应授权，之后可在同一初始分支重试。进程异常留下锁文件时，先人工核查活动进程；脚本不擅自清除其他任务的锁。

重复运行还会在隔离子进程中检查 Prisma/Client/Adapter、argon2、TypeScript 和 tsx 的锁定版本，加载 Prisma runtime、生成 Client、原生密码库及两个共享包的模块图，并确认 Prisma CLI 入口存在。不会实例化 Prisma Client、连接数据库、执行 CLI、导入应用服务或调用 Provider。缺失内部模块、原生绑定、生成文件或明显版本错误会使 READY 失效；只尝试一次既有 Setup，仍不通过则保留非 READY 状态并停止，PR guard 也会拒绝。模块加载失败标记为 `DEPENDENCIES_INVALID`；安装或产物检查失败保留相应失败或待完成状态。此检查检测常见损坏，不是所有依赖文件的完整校验或供应链认证。

### 缓存、临时目录和凭据

复用既有 Setup 的 `setup` 模式，保持 npm 11.18.0、Prisma 7.9.1 和锁文件策略；不复制安装、Prisma 或构建逻辑，不执行 `verify` 或 Quality。

Setup 的隔离 npm 安装目录使用新建的任务私有 `TMPDIR`，规避共享临时目录中已有路径的属主问题。**当前批准 Setup 的 npm 包缓存仍是 `HOME/.npm`**；它不会转发调用方的 npm cache override。Bootstrap 检查该缓存及已有 `_cacache`、`_cacache/tmp`、`_logs` 的属主和写权限。失败返回 `NPM_CACHE_NOT_WRITABLE`，不伪称缓存已隔离、不改变 HOME、不 chmod/chown 既有缓存、不提权。深层缓存或安装问题仍由 Setup 非零退出阻断。

Setup 子进程只继承 OS 工具发现、现有代理和 CA 信任变量；不传入应用数据库、Provider、服务器或生产凭据。既有 Setup 再次过滤环境并固定本地假数据库、关闭 AI/Push/提醒开关。发现仓库运行时 `.env` 文件即停止，不读取其内容。Git 操作保留平台现有认证/代理环境，只允许检查、Fetch 和本地分支切换；进程级禁用 Git hooks，脚本没有 Commit、Push、PR、Merge、SSH 部署或真实 Provider 执行路径。

## 正式开发与 PR 基线保护

1. 开发前检查 Bootstrap READY 和输出分支。开发过程中审查 `git diff <批准SHA>`；获得独立 Commit Gate 后才提交。
2. 对已提交、Git Clean 的功能分支执行 guard。将人工审查的**完整变更路径列表**保存为仓库外的 JSON 数组；不能直接从 diff 自动生成列表并视为人工审查。脚本检查分支状态、批准 SHA 的祖先关系和 merge-base，严格比较 `IntegrationSHA...HEAD` 与该列表。

```bash
node /启动器路径/codex-native-bootstrap.mjs guard \
  --repo /workspace/richangzhushou --task 同一任务ID --sha 批准SHA \
  --scope /仓库外/reviewed-files.json
```

文件名校验不能证明变更语义只属于当前任务，仍需审查完整 diff。READY 状态是本地任务记录，不是防止恶意篡改的认证凭据。Git ancestry 检查也不替代范围审查。

3. guard 不执行交付操作。获得独立 Push 和 PR 授权后，显式使用仓库 `Dada-sys101/richangzhushou`、base `codex/v15-integration-foundation` 和实际远端功能分支 head。可以使用 GitHub 连接器的 `base/head` 参数或 `gh pr create --repo ... --base ... --head ... --body-file ...`。禁止用可能 Push 的 dry-run 验证。
4. 创建后从 GitHub **重新读取**完整 PR REST metadata 和所有分页的 Files changed。把未经投影的 PR JSON 与完整文件数组存到仓库外，再执行：

```bash
node /启动器路径/codex-native-bootstrap.mjs verify-pr \
  --repo /workspace/richangzhushou --task 同一任务ID --sha 批准SHA \
  --scope /仓库外/reviewed-files.json \
  --pr /仓库外/fresh-pr.json --files /仓库外/all-pr-files.json
```

校验双方仓库、base/head 分支、双方 SHA、完整文件数量和路径，处理 rename 的新旧路径；缺页、旧 main 基线或 SHA 漂移均停止。批准 Integration 在开发期间前移时，重新核查并取得适用批准，不能悄悄换用新版本。脚本只验证调用方提供的快照；快照真实、最新且分页齐全必须由实际 GitHub GET 流程保证。本任务不实际创建或读取测试 PR。

Codex 平台差异跟踪和自动 PR 默认 base 为 **NOT_VERIFIED**。所有输出固定 `automaticPrAllowed=false`；不能无检查地使用平台自动 PR。

## 验证与收尾

针对性测试：`node --test scripts/codex-native-bootstrap.test.mjs`。现有 CI quality job 在依赖安装、Prisma 生成及共享包构建后显式执行该测试；其 `actions/checkout` 使用 `fetch-depth: 0`。测试默认从自身文件位置定位仓库，支持显式 `BOOTSTRAP_TEST_REPOSITORY`，不依赖 Cloud 固定目录或当前 shell 目录。夹具只需要批准 Integration `20f8e704...` 及其通过 Git 解析的父提交，二者均为 PR head 的祖先；不依赖旧 main/work 提交或其分支名。缺少所需历史时明确失败并提示完整检出，测试不会自行 Fetch 或创建 Commit。

隔离克隆中覆盖首次/重复运行、tracked/untracked Dirty、SHA 漂移、错误仓库、网络失败、运行时 .env、Setup 失败、临时目录/缓存安全、任务锁、损坏依赖的探测/修复失败及 PR base/head/SHA/files/scope 阻断。模块图回归测试仅损坏临时目录中的假依赖，不修改真实依赖。测试不访问真实 Provider，不执行远端写操作。完整 GitHub Actions 的通过状态需要远端实际运行证明，本地模拟检出和测试步骤不等同于整个 CI 已通过。

真实原生首次与重复运行、Setup 和恢复证据存于本地任务交付目录；最终报告记录实际结果。原始 `work` 保护检查通过后恢复该分支，保留临时任务分支和日志。保留的 Integration 依赖产物不能视为适配旧版 work。

本地验证不需要修改 Environment。分发需要独立 Commit、Push、PR、Merge 授权，以及更新批准 Integration SHA；若今后要改变 Environment Install 或经过实际核验的 Startup 配置，还需独立 Environment 修改/Save/Republish 授权，并在全新任务中重新验证。

### 最简移动端前缀

当前启动器尚未进入远端，可以明确授权 Agent 执行以下**过渡协议**。这是任务正文触发的初始化，不冒充新启动器已发布，也不由 Install/AGENTS 自动触发：

> 先初始化原生仓库 `/workspace/richangzhushou`：核对 `Dada-sys101/richangzhushou` 和 Git Clean；Fetch `codex/v15-integration-foundation`，仅接受 SHA `20f8e7044958b8f01278392a9b97f379839a8ad5`；直接从该 SHA 创建唯一任务分支，校验 HEAD、祖先、merge-base、初始空差异及缓存/临时目录权限，再运行 `node scripts/codex-cloud-setup.mjs setup`。失败停止，不丢弃修改、不修权限、不运行真实 Provider。成功后执行下述任务；Commit/Push/PR/Merge 各自需要独立授权，PR base 必须显式为 Integration 并回读核验。

正式交付后的启动器前缀：

> 先按原生 Bootstrap 协议初始化 `/workspace/richangzhushou`：确认仓库 `Dada-sys101/richangzhushou` 和 Git Clean，Fetch `codex/v15-integration-foundation`，只接受批准 SHA `<包含启动器的完整SHA>`。从该 SHA 用 git show 导出 `scripts/codex-native-bootstrap.mjs` 到私有临时目录，执行 bootstrap，task=`<本次任务ID>`。路径缺失、SHA 不符或初始化失败即停止；READY 后再执行下述任务。禁止未经独立授权的 Commit/Push/PR/Merge；PR base 必须显式为 Integration 并回读核验。

本次实现还未提交，以上 `<包含启动器的完整SHA>` 无可用远端值；不能将当前 `20f8e704...` 填进去并声称已经具备新启动器。
