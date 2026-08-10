# 任务执行契约：PR6a

契约版本：v1.1（Round 1 安全与验证缺口修复）
任务名称：临时 MySQL 8.4 验证入口
批准日期：2026-08-10
当前状态：`DONE / DONE_LOCAL`

## 1. 目标与依赖

提供可重复、可诊断、强 fail-closed 的本机临时 MySQL 8.4 验证入口，统一执行空库全量
migration、数据库专项测试、权限隔离和清理验证。启动依赖 V15-CTRL-001
`DONE_INTEGRATION`；该依赖已由 PR #10、final-head CI 与 integration HEAD `371a43d...`
满足。

## 2. 允许与禁止范围

允许修改 PR6a 测试/脚本、治理配置、任务契约、操作说明、验收与状态文档。

禁止修改业务功能、Prisma schema/migrations、依赖版本/lockfile、正式 CI、生产数据库、云资源、
Staging 和 Production。入口不得读取默认应用数据库地址，不得管理不属于程序内部生成的
`daily_assistant_pr6a_*` 数据库、guard database 或 `daily_assistant_pr6a_u_*` 用户。

## 3. 安全契约

- 必须显式提供 `PR6A_MYSQL_ADMIN_URL`，只允许 `mysql:` 协议、`mysql` 系统库和
  `127.0.0.1`、`::1`、`localhost`；不存在非 loopback override；
- 必须验证 Oracle MySQL 8.4.x，拒绝 MySQL 8.0、MariaDB 和未知版本；readiness 为 12 次、
  每次间隔 500 ms 的有界重试；
- 管理凭据仅用于 readiness/version、CREATE/GRANT/SHOW GRANTS、隔离检查管理与 cleanup；
  migration/Vitest 子进程只接收随机临时用户的 URL；
- 临时用户只获当前随机目标库的 `ALL PRIVILEGES`，不得获得 `*.*`、`mysql.*`、
  `GRANT OPTION` 或其他库权限；同时使用任务自建 guard database 做真实拒绝访问检查；
- child env 使用操作系统变量 allowlist，不继承管理员 URL、既有数据库 URL 或任意
  token/secret/password/key/credential；stdout/stderr 全部 pipe 并统一脱敏；
- 随机数据库、guard database 和用户从内部生成后立即进入 cleanup eligible 集合；即使 CREATE
  抛错或 ACK 丢失，也执行对应 `DROP ... IF EXISTS`；
- Windows 用 `taskkill /PID <pid> /T /F`，POSIX 用独立 process group 终止完整子进程树；信号
  处理只接受首个信号，并在终止后进入幂等 cleanup；
- cleanup 分别删除目标库、guard database、临时用户，验证 DB/user 残留为 0，关闭管理连接；
  primary 与 cleanup 同时失败时保留两类脱敏诊断。

## 4. 执行入口

```powershell
$env:PR6A_MYSQL_ADMIN_URL = "mysql://<temporary-admin>@127.0.0.1:3306/mysql"
$env:PR6A_EVIDENCE_LABEL = "run-1"
npm run validate:mysql84:temporary
```

测试专用 failure injection：

```powershell
$env:PR6A_INJECT_FAILURE_STEP = "after-migration"
$env:PR6A_EVIDENCE_LABEL = "failure-run"
npm run validate:mysql84:temporary
```

失败注入必须返回 `41`，仍完成数据库、guard database 和用户清理。受控 signal run 在真实 DB
tests 子进程活动时向 CLI 发送终端 `Ctrl+C`，期望 `SIGINT`、退出码 `60`、进程树终止和完整清理。

## 5. 稳定退出码

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 10 | 配置、host 或内部标识不安全 |
| 20 | readiness 超时 |
| 21 | 非 Oracle MySQL 8.4 |
| 30 | bootstrap、grant 或隔离检查失败 |
| 40 | migration 失败 |
| 41 | DB tests 或注入失败 |
| 42 | 子进程 spawn 失败 |
| 50 | cleanup 或 evidence 写入失败 |
| 60 | SIGINT/SIGTERM 中断 |
| 70 | 未分类内部失败 |

cleanup 失败优先返回 `50`，但 evidence/终端中继续分别保留 `PRIMARY_FAILURE` 和
`CLEANUP_FAILURE`。

## 6. 本地验收证据

- 环境：Node 24.16.0、npm 11.13.0、仓库外独立临时 Oracle MySQL 8.4.9，仅绑定
  `127.0.0.1:33484`；
- focused tests：1 file / 26 tests；
- success Run #1 / #2：每次均为新随机 DB/user、9 migrations、14 files / 105 DB tests、
  guard isolation PASS、DB/user 残留 0；
- Failure Run：migration 后预期失败，exit 41，DB/user 残留 0；
- Signal Run：活动 Vitest 进程树收到真实终端 SIGINT，exit 60，tree termination requested，
  DB/user/process 残留 0；
- 独立 JSON 与 `.sha256` sidecar 位于本地忽略目录 `output/pr6a/evidence/`；详情与真实文件哈希见
  `docs/41-pr6a-mysql84-validation.md`。

## 7. 完成与授权边界

Round 1 的最终质量门通过后，本任务只回到 `DONE / DONE_LOCAL`。未创建提交、未 add、未 push、
未创建 PR、未合入 integration、未修改正式 CI、未部署。任何后续 Git 或交付晋级动作仍需独立
授权，且不得自动选择下一 canonical task。
