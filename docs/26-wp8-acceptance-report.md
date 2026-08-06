# 26 WP8 全量质量与发布准备 —— 本地验收报告

文档版本：1.0<br>
状态：已完成本地验收（未推送、未部署、未创建生产资源）<br>
更新：2026-08-06<br>
适用版本：V1.0

## 1. 任务与授权范围

按 `docs/25-wp8-codex-execution-plan.md` 执行 WP8：安全复查、上传复查、可访问性、响应式矩阵、
OpenAPI/数据库/浏览器全量验证、备份恢复演练、账号删除演练与 staging 发布准备。
授权范围仅限本地代码修复、测试、文档与本地提交；未推送、未部署、未创建云资源、未开放公网注册。

## 2. 完成定义对照

| `docs/09` 质量门 | 结果 | 证据 |
| --- | --- | --- |
| 格式/Lint/类型/单测/构建 | PASS | `npm run quality` 全通过（格式、Lint、类型、单测、构建、Prisma validate、OpenAPI lint、migration diff、依赖审计 0 漏洞） |
| OpenAPI 校验与契约测试 | PASS | 契约测试 132/132；OpenAPI 路径与控制器 72/72 一致 |
| 空库 migration + seed | PASS | `daily_assistant_wp8`：6 migrations 全部应用 + seed |
| 集成测试 | PASS | `TEST_DATABASE_URL` 真库 63/63（WP2–WP7，含新增审计与魔数断言） |
| `git diff --check` | PASS | 无空白错误 |
| 浏览器矩阵 | PASS | Web 受保护页 102/102、公开页 30/30、管理端 42/42（375/390/430/768/1440 + 200% 缩放），无横向溢出 |

## 3. Checkpoint 结果

### CP1 全量契约与一致性复查 —— PASS（含修复）

- OpenAPI 路径 72 条与控制器路由逐一比对一致（`{id}` vs `:id` 仅为风格差异）。
- 枚举交叉核对：`packages/api-contracts/src/enums.ts` ↔ `openapi/openapi.yaml` ↔ `prisma/schema.prisma` ↔
  `docs/05` 数据字典 ↔ 前端使用值全部一致。
- 修复：
  - `ADMIN_AUDIT_ACTIONS` 补充 `DRAFT_BATCH_DISCARD`（代码已写入该 action，枚举此前缺失）。
  - `docs/05` 实体表补充 `RecoveryCode` 行（schema 存在但字典缺失）。
  - `docs/06` 端点清单补充 `DELETE /me/sessions`（控制器与 OpenAPI 已有）。
- 文档与代码不一致点已消除；DEC/OPEN 记录与代码交叉核对无新增漂移。

### CP2 安全复查 —— PASS（含修复）

- 基线核对：Argon2id 密码哈希、刷新令牌仅存 SHA-256、访问令牌内存保存、HttpOnly+SameSite=Lax Cookie、
  登录/找回/重置/同步/快捷指令限流、DTO allow-list（`forbidNonWhitelisted`+`whitelist`）、精确 CORS、
  Helmet、用户/管理员权限守卫、跨用户 404、脱敏审计、通用错误响应不泄露堆栈。
- 修复：
  - 生产环境强制要求 `CONFIRMATION_TOKEN_SECRET`（此前仅有默认值，批量丢弃二次确认令牌可被伪造）；
    `.env.example` 同步补充。
  - 用户自助高风险操作补写脱敏审计：`USER_CLOSE`（自助关号）、`USER_DELETE_REQUEST`（申请删除）、
    `USER_REOPEN`（恢复码重开），before/after 仅状态与时间戳，不存密码/令牌/邮箱正文；
    wp2 集成测试新增断言（含审计不含明文密码与邮箱）。
  - `.env.example` 补齐适配器/调度可选变量（`LOCAL_STORAGE_DIR`、`SHORTCUT_RATE_LIMIT`、
    `FAKE_OCR_TEXT`、`FAKE_SCAN_FAIL`、`FAKE_NOTIFICATION_FAIL`、`REMINDER_*`）。
- 日志复核：API 无请求级日志输出敏感正文；CLI 引导日志不含凭据。

### CP3 上传复查 —— PASS（含修复，遗留缺口已记录）

- 基线核对：MIME/扩展名白名单（jpeg/png/webp）、大小上限 10MB、随机 UUID 对象键、
  路径穿越防护（本地存储适配器拒绝绝对路径与 `..`）、扫描门控（`scanStatus=SCANNED` 且内容已存才可 OCR）、
  上传意图 15 分钟过期、上传令牌仅存哈希、失败不产生悬空正式附件。
- 修复：
  - 新增“魔数”校验：上传内容必须匹配声明 MIME（JPEG/PNG/WEBP 文件头），不匹配返回
    `ATTACHMENT_TYPE_NOT_ALLOWED`；wp4 集成测试改用合法 PNG 头并新增不匹配用例。
  - 超大上传流不再 `pause()`（避免连接悬挂），改为 `resume()` 丢弃剩余数据。
- 遗留缺口（如实记录，未伪装为完成）：过期/未完成上传意图与失败附件的自动清理未实现；
  V1 依赖对象存储生命周期策略或后续后台任务（`[待确认]`，见 `docs/10`）。

### CP4 可访问性与响应式 —— PASS

- 键盘路径：Tab 可依次到达导航、输入框与按钮；默认焦点环保留（无 `outline: none`）。
- 语义：页面区块使用 `aria-labelledby`，输入框有可访问名称，错误使用 `role="alert"`
  （登录失败、表单校验均有验证）。
- 颜色非唯一表达：同步状态徽标同时使用文字与图标（已同步/待同步/同步失败/有冲突）。
- 触控目标：主按钮高约 46px，页头与移动导航不低于 72px。
- 矩阵：Web 受保护 17 页、公开 5 页、管理端 7 页，全部通过 375/390/430/768/1440 与 200% 缩放无横向溢出；
  控制台仅有预期日志（未登录 401、故意访问不存在行程的 404）。

### CP5 全量功能回归 —— PASS

- `npm run quality` PASS；空库 6 migrations + seed PASS；集成 63/63 PASS。
- 浏览器主流程回归：注册、登录（含失败错误提示）、记账新增、日程新增、行程新增、离线写入→恢复→同步
  （66.66 离线排队 → 恢复网络后服务器仅 1 条 `APPLIED` sync_mutation）。
- 失败路径：API 进程停止时页面显示“服务暂时不可用”明确错误；`/trips/not-a-trip` 错误态正常渲染。
- 说明：Playwright CLI 的 `setOffline` 不翻转 `navigator.onLine`，离线横幅在真实浏览器由
  `navigator.onLine=false` 触发；本次通过“离线排队→恢复网络→单条落库”验证核心同步语义，
  与 WP7 验收（QA-SYNC-001~004）结论一致。

### CP6 备份恢复演练 —— PASS

- 备份：`mysqldump --single-transaction` 导出 `daily_assistant_wp8_browser`（51,837 字节）。
- 恢复：新建隔离库 `daily_assistant_wp8_restore` 完整恢复。
- 完整性核对：24/24 张表行数一致；抽查交易金额/状态、用户状态、密码哈希前缀（Argon2id）、
  刷新令牌哈希长度 64、sync_mutations `APPLIED=1`。
- migration 回滚说明：`apps/api/prisma/migrations/README.md` 已为 WP4–WP7 记录
  `prisma migrate resolve --rolled-back` 与手工 DROP/ALTER 回滚步骤；策略为向前修复优先。

### CP7 账号删除演练 —— 部分通过（清理缺口已如实记录）

- 通过：真实 API 流程注册演练用户 → 创建交易/日程/行程/草稿/附件 → 申请删除返回 202 →
  `DELETION_PENDING` 且记录 `deletionRequestedAt`；会话全部撤销；容量释放（不计入占用槽位）；
  审计写入 `USER_DELETE_REQUEST`（actor=用户本人、before ACTIVE → after DELETION_PENDING、
  requestId 存在、无明文邮箱/密码）。
- 缺口（未实现，不得视为完成）：期满后的批量清理路径不存在——无后台任务将
  `DELETION_PENDING` 用户转为 `DELETED` 并清理业务行、附件对象与脱敏保留。
  演练后用户内容（交易/日程/行程/草稿/附件各 1 条）仍保留在库中，附件文件仍在本地存储。
  上线前需单独确认清理实现与保留期（OPEN-007），见 `docs/27` 发布清单。

### CP8 发布准备 —— 产出完成

- 产出 `docs/27-wp8-staging-release-checklist.md`：staging 环境变量、CORS/HTTPS/Cookie 策略、
  健康检查、部署与回滚步骤、监控告警清单、隐私说明与小规模试用门禁、发布前待确认项 OPEN-001~011。
- 未解决外部项全部记录，未宣布“可开放体验/生产可用”。

## 4. 修改文件

- 契约/枚举：`packages/api-contracts/src/enums.ts`
- 后端：`apps/api/src/auth/auth.service.ts`、`account/account.controller.ts`、
  `common/security.service.ts`、`attachments/attachments.service.ts`、
  `attachments/attachments.controller.ts`
- 测试：`apps/api/src/integration/wp2.integration.test.ts`、`wp4.integration.test.ts`
- 配置/文档：`apps/api/.env.example`、`docs/05`、`docs/06`、`docs/README.md`、
  `docs/25`（规划，未提交）、`docs/26`（本报告）、`docs/27`（发布清单）
- 状态文件：`.project/context.md`、`.project/session.md`、`docs/progress.md`、
  `docs/changelog.md`、`PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`MASTER_PLAN.md`、`CHANGELOG.md`

## 5. 未验证 / 待确认

- 远程 CI：未推送，GitHub Actions 未运行（待授权）。
- 真实 OCR/AI/对象存储/邮件/通知供应商效果：仅验证适配器与降级路径（OPEN-003/004/005/006）。
- 账号删除期满批量清理：未实现（见 CP7）。
- 浏览器 QA 一键脚本：仍依赖 `playwright-cli` 手工流程，产物不入库（OPEN-009）。
- 多实例部署：提醒调度器未做数据库租约（单实例前提，docs/07）。
- 200% 缩放横幅与离线横幅联动：受测试工具限制未在自动化中复现，建议正式浏览器手工复核。

## 6. 提交

本地提交（分支 `codex/wp8-release-prep`），哈希以 `git log` 为准；未推送、未部署。
