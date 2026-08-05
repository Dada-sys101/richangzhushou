# 18 WP4 验收报告

报告版本：1.0<br>
日期：2026-08-05<br>
分支：`codex/wp4-shortcuts-ocr`（未推送）<br>
结论：WP4 本地验收通过；未推送、未部署、未创建生产资源、未进入 WP5

## 范围结论

- 契约先行：`packages/api-contracts` 补全 Shortcuts/Drafts/Attachments 的 OpenAPI
  请求、响应、DTO、共享类型与错误码，新增 `ShortcutScope`
  （`transaction:draft:create` / `finance:summary:read`）、
  `AttachmentScanStatus`、`AttachmentOwnerType`、`DraftTargetType` 枚举，以及
  `CREDENTIAL_INVALID/REVOKED`、`OCR_UNAVAILABLE`、`ATTACHMENT_TYPE_NOT_ALLOWED`、
  `ATTACHMENT_TOO_LARGE`、`ATTACHMENT_SCAN_FAILED`、`DRAFT_NOT_EDITABLE`、
  `UPLOAD_INTENT_EXPIRED`、`UPLOAD_TOKEN_INVALID`、
  `CONFIRMATION_TOKEN_INVALID/EXPIRED` 等错误码；契约测试 112 项通过。
- 数据：Prisma 新增 `DeviceCredential`、`Attachment`、`DraftRecord` 与枚举
  `AttachmentScanStatus`、`AttachmentOwnerType`、`DraftTargetType`；migration
  `20260805085724_wp4_shortcuts_ocr` 由真实 Prisma 对空库生成，并在全新
  `daily_assistant_wp4` 库上 `migrate deploy` 通过（3 个 migration）。
- 设备凭证：创建（明文一次）/列表（仅元数据）/撤销（立即失效）；
  `DeviceCredentialGuard` 校验 SHA-256 哈希、撤销状态、账号状态、作用域并限流；
  数据库只存哈希与展示前缀（QA-SEC-003）。
- 快捷指令：`POST /shortcuts/transaction-drafts` 幂等创建 `PENDING` 草稿
  （QA-SC-001/002）；`GET /shortcuts/today-spend` 只读作用域返回今日支出；
  Apple 快捷指令配置指引已实现为前端页面（`/shortcuts`）。
- 草稿中心：文本规则解析、OCR 草稿、列表/编辑/确认/丢弃、批量丢弃二次确认与审计；
  确认在单事务内标记 `CONFIRMED` 并创建 `CONFIRMED` 交易，保留 `source` 与
  `clientMutationId`；未确认草稿不计入统计（QA-DRAFT-002）。
- 附件与 OCR：短期上传意图 + 一次性上传令牌 + 完成确认；`StorageAdapter`、
  `OcrAdapter`、`ScanAdapter` 接口与本地临时存储/假实现；OCR 失败返回
  `OCR_UNAVAILABLE` 且保留手动录入路径（QA-DRAFT-001）。
- 安全：所有用户内容 API 强制 `USER` 角色与 `userId` 范围，跨用户访问 404，
  管理员访问 403（延续 QA-SEC-001/002）；日志不含令牌与附件正文。

## 验收证据

| 检查 | 结果 |
| --- | --- |
| `npm run quality`（格式、lint、类型、单测、构建、Prisma、OpenAPI、migration diff、依赖审计） | PASS |
| 空库 `prisma migrate deploy`（MySQL 8.4.9，全新 `daily_assistant_wp4`） | PASS（3 个 migration，含 WP4） |
| `prisma:seed`（`SEED_DEMO_USER=true`） | PASS |
| `npm run test:integration`（真实 MySQL，WP2+WP3+WP4） | PASS（41/41：WP2 18 + WP3 11 + WP4 12） |
| API 单测（含规则解析器、金额/时区工具） | PASS（23/23；集成套件默认跳过 41） |
| 契约测试 | PASS（112/112） |
| `git diff --check` | PASS |
| 浏览器矩阵 375/390/430/768/1440 × 首页/快捷记录/草稿/快捷指令/账单 | PASS（25/25 无横向溢出） |
| 浏览器主流程：登录 → 文本解析 → 草稿确认 → 账单可见 → 快捷指令创建/撤销 → OCR 失败降级 | PASS |
| 控制台 | 0 error / 0 warning（仅 OCR 失败场景的预期 503 请求日志） |

## 强制验收场景映射

| 场景 | 结果 |
| --- | --- |
| QA-SC-001：同一幂等键重复提交只生成一个草稿 | PASS（返回同一 draft id） |
| QA-SC-002：相同幂等键不同内容返回 `IDEMPOTENCY_CONFLICT` | PASS |
| QA-SC-003：撤销设备凭证后快捷指令立即不可写（401 `CREDENTIAL_REVOKED`） | PASS（API 集成 + 浏览器） |
| 快捷指令作用域：只读凭证写草稿 403；写凭证读支出 403 | PASS |
| QA-DRAFT-001：OCR 失败仍可手动完成账单 | PASS（503 `OCR_UNAVAILABLE` + 手动入口；浏览器显示降级文案） |
| QA-DRAFT-002：未确认草稿不计入统计；确认后入账且保留 source/clientMutationId | PASS |
| QA-DRAFT-003：批量丢弃/清空需二次确认并写审计 | PASS（`DRAFT_BATCH_DISCARD`，before/after JSON） |
| QA-SEC-001（延续）：用户 A 不能读/改用户 B 的草稿、凭证、附件 | PASS（全部 404） |
| QA-SEC-002（延续）：管理员不能调用用户内容 API | PASS（全部 403） |
| QA-SEC-003：数据库无设备/上传令牌明文 | PASS（tokenHash/uploadTokenHash 均为 SHA-256） |
| 附件：非法类型/超大文件拒绝；意图过期不可用；完成前门控；扫描失败结构化错误 | PASS |
| 定点金额与幂等确认链路 | PASS（Decimal 校验 + 事务） |

## 浏览器验证记录（Playwright CLI）

- 使用 `playwright-cli` 完成登录（demo@example.com）、文本解析（“今天 14:30
  星巴克 38.50”）、草稿确认入账（账单页显示 -¥38.50）、快捷指令凭证创建/撤销、
  图片上传后 OCR 失败降级文案。
- 5 宽度 × 5 页面矩阵结果记录在
  `output/playwright/wp4/matrix.log`（gitignored），截图见
  `output/playwright/wp4/*.png`。

## 复现命令

```powershell
$env:DATABASE_URL='mysql://root@127.0.0.1:3307/<空库>'
npm run prisma:migrate:deploy --workspace @daily-assistant/api
$env:SEED_DEMO_USER='true'; npm run prisma:seed --workspace @daily-assistant/api
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run test:integration --workspace @daily-assistant/api
npm run quality
git diff --check
```

## 边界与剩余项

- OCR/AI 与对象存储供应商未确认（OPEN-004/006）：使用适配器 + 假实现 +
  手动降级；真实识别效果验收需供应商决策后另行进行。
- `FakeOcrAdapter` 默认不可用（设置 `FAKE_OCR_TEXT` 才返回文本），这正是
  QA-DRAFT-001 的手动降级路径；本地演示成功路径可通过环境变量开启。
- 本地临时存储位于 `apps/api/.local-storage`（gitignored）；生产上传能力属
  OPEN-006 阻塞上线，不阻塞本地实现。
- Apple 快捷指令配置指引在用户端页面（`/shortcuts`），真实 iPhone 端到端验证
  需部署可达域名后另行进行（RISK-002：快捷指令不承诺全自动，先草稿后确认）。
- 幂等键冲突语义（BR-SYNC-002）与 WP7 同步契约需在 WP7 保持一致性。
- 当前分支未推送；GitHub Actions 未运行；未创建生产资源、未部署、未进入 WP5。
