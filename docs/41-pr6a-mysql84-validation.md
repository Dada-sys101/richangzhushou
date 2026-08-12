# PR6a 临时 MySQL 8.4 验证入口与 Round 1 本地验收

文档版本：1.1
日期：2026-08-10
状态：`DONE / DONE_LOCAL`

## 范围

PR6a 在不修改业务功能、依赖或正式 CI 的前提下，提供一个只连接本机 loopback 临时 Oracle
MySQL 8.4 的验证入口。入口以管理员凭据完成 bootstrap，以独立随机用户执行全部 migrations 和
`src/integration` 下的 DB tests（Round 1 为 9 个 migration、14 files / 105 tests；PR2 落地后
预期为 10 个 migration、15 files，测试数待真实运行确认），最后删除目标库、guard database 和
用户，并查询确认无残留。

## 强制安全边界

1. `PR6A_MYSQL_ADMIN_URL` 必须为 `mysql:`、选择 `mysql` 系统库，host 必须精确等于
   `127.0.0.1`、`::1` 或 `localhost`；不存在 override。
2. 管理员 URL 只进入 readiness/version、CREATE/GRANT/SHOW GRANTS、管理侧验证和 cleanup；
   不进入 npm、Prisma migration 或 Vitest 子进程。
3. 每次生成独立 `daily_assistant_pr6a_*` 目标库、`daily_assistant_pr6a_guard_*` guard database、
   `daily_assistant_pr6a_u_*` 用户和 256-bit 随机密码。
4. 临时用户只有目标库级 `ALL PRIVILEGES`；SHOW GRANTS 拒绝 `*.*`、额外数据库和
   `GRANT OPTION`。临时用户读取 guard marker 必须得到权限拒绝。
5. child env 只保留 Node/npm/Prisma/Vitest 运行所需的系统 allowlist，并注入临时用户的
   `DATABASE_URL`/`TEST_DATABASE_URL`；不展开继承 `process.env`。
6. 子进程 stdout/stderr 全部 pipe；管理员 URL、原始/URL-encoded 密码、临时 URL 和所有已知
   secret 在写终端与 evidence 前统一替换为 `[REDACTED]`。
7. 所有内部随机标识生成后立即 cleanup eligible；CREATE 失败或 ACK 丢失也会执行
   `DROP ... IF EXISTS`。外部输入名称无法进入 cleanup。
8. Windows 通过 `taskkill /PID <pid> /T /F` 终止完整树；POSIX 使用独立 process group。
   信号状态只设置一次，tree termination、DB/user cleanup 和连接关闭不重入。
9. readiness 固定最多 12 次、间隔 500 ms；不存在无限等待。
10. cleanup 独立记录每一步。primary 与 cleanup 同时失败时分别输出/记录
    `PRIMARY_FAILURE` 和 `CLEANUP_FAILURE`，cleanup 失败不会被静默吞掉。

## 子进程环境 allowlist

Windows：`PATH`、`PATHEXT`、`SystemRoot`、`WINDIR`、`TEMP`、`TMP`、`ComSpec`、
`USERPROFILE`、`APPDATA`、`LOCALAPPDATA`。POSIX：`PATH`、`HOME`、`TMPDIR`、`SHELL`、
`LANG`、`LC_ALL`、`TERM`。两端按存在性保留 `CI`、`NO_COLOR`，并设置 `FORCE_COLOR=0`。

不继承 `PR6A_MYSQL_ADMIN_URL`、原 `DATABASE_URL`/`TEST_DATABASE_URL` 或任何未列出的
token、secret、password、key、credential。

## 自动化测试

`apps/api/src/cli/validate-temporary-mysql84.test.ts` 共 26 个 focused tests，覆盖：

- loopback allowlist、任意 IP/域名拒绝和 override 无效；
- Oracle MySQL 8.4 guard、数据库/guard/user 命名空间；
- 管理员/临时凭据隔离、child env allowlist、grant scope 和统一 redaction；
- CREATE DATABASE 抛错后仍清理全部内部随机资源；
- readiness、migration、DB tests、spawn 和注入失败；
- success/repeated cleanup、cleanup failure、primary + cleanup 双失败；
- SIGINT/SIGTERM 下 tree termination、cleanup 和非零结果；
- Vitest evidence count 解析。

## 真实 MySQL 8.4 结果

环境：Node 24.16.0、npm 11.13.0、Oracle MySQL Community Server 8.4.9；实例位于仓库外，
仅监听 `127.0.0.1:33484`。未连接远程、开发、Staging 或 Production 数据库。

| 运行 | 结果 | migration / DB tests | isolation | cleanup / residual | exit |
| --- | --- | --- | --- | --- | --- |
| Run #1 | PASS | 9 / 14 files、105 tests | PASS | DB/guard/user true；DB 0、user 0 | 0 |
| Run #2 | PASS | 9 / 14 files、105 tests | PASS | DB/guard/user true；DB 0、user 0 | 0 |
| Failure Run | EXPECTED_FAILURE | 9 / migration 后注入 | PASS | DB/guard/user true；DB 0、user 0 | 41 |
| Signal Run | INTERRUPTED | 9 / 活动 Vitest 时 SIGINT | PASS；tree termination true | DB/guard/user true；DB 0、user 0 | 60 |

Run #1 与 Run #2 的 database/user identifier SHA256 均不同，证明使用两组 fresh 随机资源。

## 可独立复核 evidence

JSON 文件和匹配的 `.sha256` sidecar 位于 `.gitignore` 覆盖的本地目录，未 stage/commit。JSON
只含时间、版本、标识哈希、计数、隔离/清理/残留、退出码、结果和脱敏诊断，不含 URL、密码或
secret。

| 本地文件 | 文件 SHA256 | 结果 |
| --- | --- | --- |
| `output/pr6a/evidence/run-1.json` | `5338358038fb7749c2d42f233dff853373a375a16a9684a96245d2fb157d1711` | PASS |
| `output/pr6a/evidence/run-2.json` | `9727a29e67b907fa7223873a0e5839de0c21c02cf2b0043b5e0ae3caf81015c7` | PASS |
| `output/pr6a/evidence/failure-run.json` | `1c6f119d7d45be256439446038b377bb91a7ba496f70b0eb1eb1df09b3162c43` | EXPECTED_FAILURE |
| `output/pr6a/evidence/signal-run.json` | `71d4824ff73af40433f490349ca1d75fc97a56c370607379faa4a85b920e231c` | INTERRUPTED |

四个实际文件的重新计算 SHA256 与 sidecar 均匹配。最终 `npm run quality`、独立
`npm run check:context` 与 `git diff --check` 均通过。

## 退出码与执行入口

退出码定义见 `tasks/PR6a.md`。普通运行：

```powershell
$env:PR6A_MYSQL_ADMIN_URL = "mysql://<temporary-admin>@127.0.0.1:3306/mysql"
$env:PR6A_EVIDENCE_LABEL = "run-1"
npm run validate:mysql84:temporary
```

Failure Run 使用 `PR6A_INJECT_FAILURE_STEP=after-migration`。Signal Run 使用真实终端
`Ctrl+C` 触发 CLI 的 `SIGINT` handler；不使用 Windows 上会绕过 Node handler 的强制终止来
冒充成功证据。

## 交付边界

当前交付状态保持 `DONE_LOCAL`。未 add、未 commit、未 push、未创建 PR、未合入 integration，
未创建云资源，未部署 Staging 或 Production；不得自动开始其他 canonical task。

## PR2 落地后的验证状态（2026-08-12）

- 使用仓库外全新 datadir 启动 Oracle MySQL Community Server 8.4.9，仅绑定 loopback，
  为本次验证创建随机独立数据库和 scoped user；未连接任何已有、远程、Staging 或 Production 数据库。
- fresh empty DB 从 0 连续应用全部 10 migrations，重复 deploy 显示无 pending migration。
- PR2 AI focused tests：1 file / 12 tests PASS；account deletion focused tests：1 file / 11 tests PASS；
  `AiRequest`、`AiProposal`、`AiOperation`、`AiProviderAttempt` residual 均为 0，User tombstone 仍为 `DELETED`。
- 全量 DB integration：15 files / 117 tests PASS，0 failed，0 skipped。最终 `npm run quality`、
  `npm run check:context` 与 `git diff --check` PASS；临时 database/user/实例/datadir residual 为 0。
- 首次 focused 运行暴露 schema test 漏写三个 `created_at DEFAULT CURRENT_TIMESTAMP(3)` 预期；
  仅修复 `v15-ai-expand.integration.test.ts` 后从全新 empty DB 重跑上述完整验收链并通过。
