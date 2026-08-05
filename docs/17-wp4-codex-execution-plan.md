# 17 WP4 快捷指令、OCR 与统一录入 — Codex 可执行规划

文档版本：0.2<br>
状态：已完成本地实施与验收（验收报告见 `docs/18-wp4-acceptance-report.md`）<br>
更新：2026-08-05<br>
适用版本：V1.0

## 1. 任务目标

实现 WP4“快捷指令、OCR 与统一录入”：可撤销的最小权限设备凭证（DeviceCredential）、快捷指令 API 与配置指南、草稿中心（DraftRecord）、图片上传（Attachment）、OCR 适配器、文字规则解析与确认/丢弃。完成定义：支付后可经快捷指令生成草稿并确认入账；第三方不可用时仍可手填（`docs/12`）。

## 2. 前置条件与授权边界

- 前置：WP1/WP2/WP3 已完成本地验收（`docs/13`、`docs/14` v2.0、`docs/16`）。
- 开工前需用户另行授权。建议授权范围：
  - 创建 `codex/wp4-shortcuts-ocr` 分支；
  - 修改本地代码、Prisma schema/migration、OpenAPI、测试与文档；
  - 安装 WP4 必需的正常开发依赖；
  - 完成本地 checkpoint 与提交；
  - 禁止推送、PR、部署、购买服务、创建云资源、写入真实凭据；
  - 禁止实现 WP5（日程、待办、提醒）及之后的业务功能。
- 未授权前不得进入实现。

## 3. 开始前阅读顺序（按 AGENTS.md）

1. `.project/context.md`
2. `AGENTS.md`
3. `PROJECT_STATUS.md`、`SESSION_END.md`、`TODO.md`、`CHANGELOG.md`
4. `docs/README.md` → `docs/project-overview.md`、`docs/architecture.md`、`docs/progress.md`、`docs/roadmap.md`、`docs/decisions.md`
5. 当前工作包定义：`docs/12-development-handoff.md`（WP4 部分）与本文件
6. 实现与详细文档：`docs/03-business-rules.md`（BR-AI-*、BR-SYNC-*）、`docs/05-data-model-and-dictionary.md`、`docs/06-api-and-integrations.md`、`docs/07-technical-architecture-and-security.md`、`docs/08-ui-ux-and-wireframes.md`、`docs/09-test-and-acceptance.md`；现有实现参考 `apps/api/src/finance`、`apps/web/src/views`、`packages/api-contracts`

## 4. 只读检查（任一不满足即停止并报告）

1. WP3 是否完成并有最终验收报告（`docs/16`）。
2. `npm run quality` 是否通过（或先复跑）。
3. 工作树是否干净、无其他任务修改同一目录。
4. 当前工作包是否已正式切换到 WP4（TODO/MASTER_PLAN/状态文档一致）。

## 5. 设计约束（契约与业务不变量）

- 契约先行：先补全 Shortcuts/Drafts/Attachments 的 OpenAPI 请求、响应、DTO、错误码与共享类型（含 `ShortcutScope` 枚举），再实现。
- 设备凭证（DEC-108）：短期最小权限 Bearer 凭证；创建时明文只展示一次，数据库只存 SHA-256 哈希与安全前缀；支持单条撤销；撤销后立即不可用；禁止在快捷指令中保存账户密码（架构不变量）。
- 快捷指令作用域最小化：例如 `transaction:draft:create`、`finance:summary:read`；每个端点按声明的作用域鉴权。
- 幂等（BR-SYNC-001/002）：快捷指令草稿写入必须携带用户范围内唯一的 `clientMutationId`；相同键与相同请求返回原结果；相同键不同内容返回 `IDEMPOTENCY_CONFLICT`。
- 草稿与正式记录分离（BR-FIN-004、BR-AI-001）：快捷指令、OCR、文字解析只生成 `DRAFT`，不得直接创建 `CONFIRMED` 账单；未确认草稿不计入任何统计；确认必须由用户显式触发。
- AI/OCR 输出必须包含来源、置信提示与可编辑字段，不得伪装为确定事实（BR-AI-001）；新增普通草稿属低风险，用户一次确认后写入（BR-AI-002）。
- 高风险操作（批量丢弃/清空草稿、账号关闭）必须二次确认并审计（BR-AI-004）；账号关闭审计已在 WP2 覆盖，本工作包补齐草稿侧的批量操作确认与记录。
- 图片上传：限制 MIME、扩展名、大小与魔数；对象键随机生成并防止路径穿越；上传采用“短期上传意图 + 完成确认”，失败不得产生悬空正式附件（`docs/06`、`docs/07`）。
- 外部适配器：OCR/对象存储必须通过适配层接入并支持失败降级（架构不变量）；未确认供应商前使用假实现/本地临时存储，禁止购买服务或写入真实凭据（OPEN-004）。
- 所有草稿、凭证、附件强制 `userId` 范围；跨用户访问返回 404（延续 QA-SEC-001）；管理员默认不能读取用户内容（延续 QA-SEC-002）。
- 金额沿用 WP3 定点规则：草稿 `payloadJson` 中金额必须是两位小数字符串，禁止二进制浮点。
- API 时间为 ISO 8601；业务展示以 `Asia/Shanghai` 计算（BR-COMMON-001）。
- 日志禁止输出设备凭证明文、恢复令牌、图片内容与完整敏感字段（QA-SEC-004 延续）。

## 6. Checkpoints（逐个实现并验证）

1. OpenAPI、共享类型、错误码与契约测试：Shortcuts、Drafts、Attachments 端点补全；新增 `ShortcutScope` 枚举与必要错误码（如 `CREDENTIAL_INVALID/REVOKED`、`OCR_UNAVAILABLE`、`ATTACHMENT_TYPE_NOT_ALLOWED`、`ATTACHMENT_TOO_LARGE`、`ATTACHMENT_SCAN_FAILED`、`DRAFT_NOT_EDITABLE`），枚举与数据字典、Prisma、前端映射一致。
2. Prisma 实体、约束、索引、migration、seed 与回滚说明：`DeviceCredential`（tokenHash 唯一、scopes、revokedAt）、`DraftRecord`（targetType、payloadJson、confidenceJson、status、clientMutationId 幂等键）、`Attachment`（ownerType/ownerId、objectKey、mimeType、size、scanStatus）；用户索引与唯一约束；新 migration 空库可部署、可回滚。
3. 设备凭证生命周期：创建（明文一次）、列表（仅元数据）、撤销；Bearer 设备凭证守卫 + 作用域校验 + 限流；撤销即时生效。
4. 快捷指令 API：`POST /shortcuts/transaction-drafts`（幂等创建草稿，返回原结果或 `IDEMPOTENCY_CONFLICT`）；`GET /shortcuts/today-spend`（只读作用域，返回今日支出）；配置指南文档（Apple 快捷指令如何携带设备凭证与幂等键）。
5. 草稿中心后端：`POST /drafts/parse-text`（规则解析金额/商户/时间/备注）、`GET/PATCH /drafts`、`POST /drafts/:id/confirm`（事务内将草稿标记 `CONFIRMED` 并创建 `CONFIRMED` 账单，保留 `source` 与 `clientMutationId`）、`POST /drafts/:id/discard`；未确认草稿不计统计（QA-DRAFT-002）。
6. OCR 与图片上传：`POST /attachments/upload-intents`、`POST /attachments/:id/complete`、`DELETE /attachments/:id`；`StorageAdapter` 与 `OcrAdapter` 接口 + 假实现/本地临时存储；OCR 失败返回结构化错误并保留手动表单入口（QA-DRAFT-001）。
7. 前端统一录入：QuickCapture 入口（文字/截图）、草稿中心列表、`DraftReviewCard`（来源、置信提示、可编辑字段、确认/丢弃）、错误与网络失败状态、快捷指令配置指南页面。
8. 集成、并发、安全、前端与浏览器验收；文档、状态与 WP4 验收报告（`docs/18-wp4-acceptance-report.md`）同步。

## 7. 强制测试与停止条件

- QA-SC-001：同一幂等键重复提交只生成一个草稿。
- QA-SC-002：相同幂等键不同内容返回 `IDEMPOTENCY_CONFLICT`。
- QA-SC-003：撤销设备凭证后快捷指令立即不可写（401/403）。
- QA-DRAFT-001：OCR 失败仍可手动完成账单。
- QA-DRAFT-002：未确认草稿不进入正式统计。
- QA-DRAFT-003：批量丢弃/清空草稿需要二次确认并留下可追溯记录。
- QA-SEC-001（延续）：用户 A 不能读取/确认/丢弃用户 B 的草稿、凭证或附件（404）。
- QA-SEC-002（延续）：管理员不能调用草稿/快捷指令/附件用户内容 API（403）。
- QA-SEC-003（延续）：数据库无设备凭证明文；明文只展示一次；日志无凭证与敏感内容。
- 附件：非法类型/超大小被拒绝；上传意图过期不可用；完成前扫描状态门控；失败不产生悬空正式附件。
- 集成测试在真实 MySQL 空库通过（WP2+WP3+WP4 全量）；`prisma migrate deploy` 空库成功。
- `npm run quality` 与 `git diff --check` 通过。
- 浏览器矩阵 375/390/430/768/1440：快捷指令引导、统一录入、草稿中心确认/丢弃主流程与错误状态（OCR 失败、网络失败）无横向溢出，控制台 0 error / 0 warning。
- 文档、状态与 WP4 验收报告与实际一致；WP4 本地提交完成；不进入 WP5。

## 8. 风险与未决（不阻塞实现，需记录）

- OCR/AI 供应商未确认（OPEN-004）：使用适配器 + 假实现 + 手动降级；真实识别效果验收需供应商决策后另行进行。
- 对象存储供应商未确认：使用本地临时存储适配器；生产上传能力属部署决策（OPEN-006 阻塞上线，不阻塞本地实现）。
- Apple 快捷指令触发不保证完整金额/商户（RISK-002）：快捷指令主动询问并预览确认，不承诺全自动。
- OCR 格式多样导致误识别（RISK-003）：只生成草稿、字段可编辑、保留手动路径。
- 浏览器 QA 未固化为仓库内一键脚本（OPEN-009）：继续使用 `playwright-cli` 产物并记录证据。
- 幂等键冲突语义（BR-SYNC-002）在快捷指令与草稿确认链路中需与 WP7 同步契约保持一致。
