# R1 剩余阻塞复核与 REL-01 审批决策汇总

任务 ID：`REL-01-DECISION-RECORD-01`
关联任务：`R1-APPROVAL-PACKAGE-01`
复核日期：2026-09-02（`Asia/Shanghai`）
当前分支：`codex/v15-v2-ui-visual-freeze`
当前 HEAD：`a75b32f77c3bdeab1d4c4f405ff1ed8187ecdaa8`
当前远端 Integration HEAD：`299b1f71debbd5a3140d1ee19f9781372e67134b`

## 1. 决策结论

| 项目 | 当前状态 | 结论 |
|---|---|---|
| R1 Quality Gate | `BLOCKED / NOT_READY` | 保持阻塞，不得进入 R1 advancement 或 REL-02。 |
| H1 | `PARTIAL` | WebKit iPhone 13 模拟只能作为辅助证据，仍缺物理 iPhone Safari 正式记录。 |
| H2 | `PARTIAL` | PWA/离线模拟已有证据，但离线重开出现 WebKit 资源错误，仍缺物理 iPhone PWA 正式记录。 |
| 依赖审计 | `CANDIDATE_REJECTED / R1 BLOCKED` | 试验候选已撤回；当前没有通过兼容性、SBOM、license 和发布检查的正式依赖修复。 |
| REL-01 | `APPROVED / REL-02_AUTHORIZATION_PENDING` | D1-D8 已按设计稿推荐值批准；本记录只固化决策，不授权创建资源。 |
| REL-02 | `BLOCKED / NOT_STARTED` | 当前没有明确的 staging 资源创建授权，不创建任何云资源。 |

H7 已由 Dada 于 2026-09-01 明确关闭，但 H7 关闭不等于 Provider enablement、REL-04 或 R1 advancement 自动放行。

## 2. R1 阻塞与证据映射

| 门禁/事项 | 已有证据 | 只证明什么 | 仍缺什么 |
|---|---|---|---|
| H1：iPhone Safari | `docs/46-r1-webkit-emulation-validation.md`：WebKit iPhone 13 模拟下登录、列表/详情、返回、Back、刷新通过。 | 模拟浏览器中的页面流程可运行。 | `docs/45-r1-manual-device-evidence-template.md` 所要求的物理 iPhone 型号、iOS、Safari、网络、逐步结果、脱敏截图/录屏和正式结论。 |
| H2：iPhone PWA/离线重开 | `docs/46-r1-webkit-emulation-validation.md`：manifest、Service Worker、缓存、离线新增、联网同步和服务端去重在模拟环境通过。 | 本机 WebKit 模拟的离线业务闭环可运行。 | 物理 iPhone PWA 重开记录；并确认/排除离线重开期间的 `WebKit encountered an internal error`（涉及页面、manifest 和离线 API 资源）。 |
| 依赖审计 | `docs/44-r1-dependency-audit-review.md`：Prisma 7.10.0/传递依赖候选因 npm SBOM 将精确依赖声明标为 invalid，已完整撤回。回滚后 `npm ls`、SBOM 生成/校验和 license inventory 有记录。 | 候选不具备可交付的供应链可复现性，不能作为正式修复。 | 依赖负责人批准一个兼容的上游修复，且该修复重新通过 compatibility、audit、SBOM、license 和 release checks；不能用 root override 或自动延长例外替代。 |
| REL-01 | `docs/47-rel-01-staging-architecture-decision.md` 与本记录：单体 API、私网 MySQL 8.4、私有 OSS、HTTPS、最小权限、备份、RPO/RTO、readiness、开关与回滚边界。 | D1-D8 推荐值已完成人工决策固化。 | REL-02 独立资源/费用授权、R1 通过、具体执行参数和资源验收证据。 |

当前工作区只读复核还确认：没有 root `package.json`、`package-lock.json` 或依赖版本变更；`apps/api/package.json` 的未提交差异是已有 H7 评估命令，不是依赖修复。该结论不替代重新运行审计。

## 3. REL-01 D1-D8 审批表

下表中的“负责人”使用职责角色；未指定具体基础设施或成本负责人时，应由 Dada 在 REL-02 资源清单中明确指派。`APPROVED` 表示推荐方向和边界已批准，不表示实际资源、域名、账号、凭据或配置已经创建。

| 决策 | 推荐值 | 当前状态 | 负责人 | 批准前置条件 |
|---|---|---|---|---|
| D1 云厂商与地域 | 优先评估与现有 OSS 适配一致的阿里云同地域方案；`cn-beijing` 仅是现有样例，不视为已选定。 | `APPROVED / 执行细节待核对` | Dada（批准）；基础设施负责人（执行核对） | 资源创建前记录最终地域、可用区、数据驻留、私网能力、费用和销毁能力。 |
| D2 MySQL 方案 | 托管 Oracle MySQL 8.4，私网访问，单实例起步；runtime、migration、backup 账号分离。 | `APPROVED / 执行细节待核对` | Dada（批准）；基础设施/数据库负责人 | 记录实例规格、TLS/私网、备份恢复点、连接告警和最小权限。 |
| D3 OSS 方案 | 私有同地域 OSS Bucket，关闭公共读写，启用版本或延迟删除保护，RAM 按前缀最小授权。 | `APPROVED / 执行细节待核对` | Dada（批准）；基础设施/存储负责人 | 记录 Bucket 地域、生命周期、恢复策略、审计、备份账号和合成附件边界。 |
| D4 域名与 TLS | 用户端、管理端、API 三个独立 Staging 来源；HTTPS、HSTS、自动续期；CORS 精确白名单。 | `APPROVED / 执行细节待核对` | Dada（批准）；域名/基础设施负责人 | 记录域名所有权、DNS 审计、证书方案、Cookie/SameSite 和最终 CORS 来源。 |
| D5 基础设施费用 | 取得按计算、MySQL、磁盘/备份、OSS、流量、域名/TLS、日志拆分的报价；设置费用告警、停机和销毁负责人。 | `APPROVED / 执行细节待核对` | Dada（批准）；成本/基础设施负责人 | 记录报价日期、计费周期、预算、告警阈值、标签和销毁路径；未完成前不创建付费资源。 |
| D6 RPO/RTO | Staging MySQL/OSS 建议 RPO ≤24 小时、RTO ≤4 小时；静态资源/API 建议 RTO ≤1 小时；备份保留天数执行前确定。 | `APPROVED / 执行细节待核对` | Dada（批准）；发布/运维负责人 | 记录备份频率、保留期、加密与分权、隔离恢复演练和验收记录。 |
| D7 readiness 方案 | REL-03 增加非敏感 readiness，或由受控运维侧组合 liveness、数据库迁移和存储检查；当前 `/api/v1/health` 仅是 liveness。 | `APPROVED / REL-03 实现项` | Dada（批准边界）；API/运维负责人 | 记录不泄露凭据和内部拓扑的检查字段、失败门槛及实现归属。 |
| D8 初始功能开关 | live AI、live Push、RRULE、Import、IndexedDB cleanup 默认关闭；提醒调度仅在单 API 实例条件下开启；账号删除清理首次部署关闭。 | `APPROVED / 执行细节待核对` | Dada（批准）；产品/发布负责人 | 记录开关清单、单实例 scheduler 约束、合成数据范围和逐项启用授权；H7 关闭不自动开启 live AI。 |

## 4. 人工决策记录

- 决策记录 ID：`REL-01-DECISION-RECORD-01`。
- 批准内容：D1-D8 **全部按 `docs/47` 的推荐值批准**，包括架构、权限边界、费用控制规则、RPO/RTO 目标、readiness 边界和初始功能开关。
- 批准范围：REL-01 设计决策固化；不包含实际资源创建、部署、公开访问、生产发布或真实数据导入。
- REL-02 状态：`BLOCKED / NOT_STARTED`。本次指令没有形成明确的 staging 资源创建授权，故不执行资源创建；即使后续授权，仍须满足 R1 Quality Gate 和本清单的执行前置条件。
- 责任人：Dada 为本次决策批准人；基础设施、数据库、存储、域名、成本、发布和运维执行负责人仍需在 REL-02 资源清单中实名或按内部责任矩阵登记。

## 5. Codex 可继续执行与必须人工确认

### Codex 可以继续执行

- 维护本审批包、`docs/47` 和项目状态镜像中的证据映射与状态一致性。
- 在不接触真实业务数据的前提下，整理 REL-02/REL-03 的资源清单模板、权限矩阵、备份恢复清单、发布/回滚检查表和合成数据验收步骤。
- 对现有代码、OpenAPI、部署样例和文档做只读兼容性检查；记录 readiness 等实现缺口，但不在本任务中擅自实现。
- 在获得明确范围和环境后，运行已批准的本地/CI 检查；不把模拟、合成或历史证据升级为人工门禁通过。

### 必须人工确认

- H1/H2 是否以物理 iPhone Safari/PWA 记录关闭，以及 H2 WebKit 离线重开错误的处置结论。
- 依赖负责人批准正式兼容修复；该修复必须同时通过 compatibility、dependency audit、SBOM、license 和发布检查。
- REL-02 执行所需的最终地域、SKU、指定负责人、成本预算、告警阈值、备份保留期、readiness 实现责任和资源清单。
- REL-02 是否另行授权、REL-03/REL-04 是否放行，以及 R1 Quality Gate 是否可以从 `BLOCKED / NOT_READY` 转换。
- Codex 不得代替人工关闭 R1 Quality Gate 或其他发布门禁。

## 6. REL-01 与 REL-02 的明确区别

| 事项 | REL-01 批准 | REL-02 资源创建授权 |
|---|---|---|
| 性质 | 批准 Staging 架构、资源类型、权限边界、成本/RPO-RTO 建议和发布边界。 | 明确允许按已批准方案创建实际计算、MySQL、OSS、DNS/TLS、备份和监控资源。 |
| 前置条件 | D1-D8 推荐值已由本记录批准并固化。 | REL-01 已批准、R1 Quality Gate 达标，并取得独立的资源/费用授权。 |
| 是否创建资源 | 否。 | 仅限授权清单内资源，并需记录资源 ID、权限、费用告警和销毁路径。 |
| 是否产生凭据 | 否。不创建或分发 Secret。 | 仅在授权的受控环境注入最小权限 Secret；不得写入仓库、日志或验收证据。 |
| 是否导入真实数据 | 否。 | 仍不得导入真实用户或真实业务记录；只使用合成或明确脱敏数据。 |
| 是否部署/上线 | 否。REL-03/REL-04 仍是独立门禁。 | 也不自动授权部署、生产发布、Provider enablement 或公开注册。 |

因此，REL-01 通过不能解除 R1 Quality Gate，也不能被解释为 REL-02、REL-03、REL-04 或生产部署授权。

## 7. REL-02 执行前检查清单

当前清单状态：`NOT_READY / BLOCKED_BY_R1_AND_RESOURCE_AUTHORIZATION`。所有资源状态均为“未创建”。

| 检查域 | 执行前必须具备 | 当前状态 |
|---|---|---|
| 资源范围 | 单台 Linux VM/ECS 起步、托管 MySQL 8.4、私有同地域 OSS、三个 staging 来源、HTTPS 入口、日志/指标、加密备份；每项有资源名、地域、负责人和销毁路径。 | `NOT_CREATED` |
| 网络与权限 | 只公开 443；API、MySQL、OSS 走私网/私有端点；runtime、migration、backup、运维账号分离；禁止 `0.0.0.0/0` 数据库/SSH/管理访问和公共 OSS 读写。 | `NOT_CONFIGURED` |
| 环境变量 | 仅按批准的变量名准备受控环境配置：生产运行模式、时区、OSS provider、精确 CORS、scheduler 与 D8 开关；仓库只保留占位符。 | `NOT_INJECTED` |
| 密钥管理 | 使用受控 Secret 管理和最小权限；记录轮换、撤销和泄露处置；不在仓库、日志、截图、状态文档写入密码、Token、Cookie、数据库凭据或 API Key。 | `NOT_CREATED` |
| 费用控制 | 保存供应商报价日期、预算、告警阈值、超预算联系人、停机/销毁负责人和标签；未批准预算不创建付费资源。 | `NOT_APPROVED_FOR_EXECUTION` |
| 备份与恢复 | MySQL/OSS 加密备份、独立备份权限、RPO/RTO 目标、保留期、隔离恢复环境、恢复点和证据模板；优先向前修复，不以破坏性 migration 作为默认回滚。 | `NOT_RUN` |
| readiness | 当前 `/api/v1/health` 仅证明 liveness；readiness 的非敏感实现或受控组合探针由 REL-03 明确归属和失败门槛。 | `GAP_RECORDED` |
| 发布与回滚 | 使用明确的 Integration commit；发布前完成 migration 兼容检查、开关审查、回滚点、停止写入和向前修复步骤。 | `NOT_RUN` |
| 数据与验收 | 只允许合成/脱敏 staging 数据；验收覆盖登录、账单、日程、待办、同步、提醒、管理员脱敏页、用户隔离、备份恢复和销毁。 | `NOT_RUN` |
| 放行条件 | R1 Quality Gate 通过；REL-02 资源/费用授权明确；负责人、报价、权限、密钥、备份、回滚和验收证据齐全。 | `BLOCKED` |

## 8. 明确声明

- 本轮不补充真实业务记录，不使用真实用户数据、真实账单、日程、待办、行程、附件或真实 Provider 数据。
- 本轮不创建云资源、域名、DNS、数据库、Bucket、证书、凭据、监控服务或部署环境。
- 本轮不修改业务代码、API、Prisma、数据库、依赖、同步后端、CI 或部署配置。
- WebKit 模拟证据只作为 H1/H2 辅助证据；不替代物理 iPhone 正式证据。
- `R1 Quality Gate` 继续保持 `BLOCKED / NOT_READY`；REL-01 已为 `APPROVED / REL-02_AUTHORIZATION_PENDING`；REL-02 继续为 `BLOCKED / NOT_STARTED`。
- 本文包含 `REL-01-DECISION-RECORD-01` 的人工批准记录；该记录不构成 REL-02 资源创建、部署或生产发布授权。

## 9. 本轮复核范围与未验证内容

已复核：`AGENTS.md`、`PLANS.md`、`.project` 状态、`docs/44`～`docs/47`、当前 Git 分支/HEAD/工作区、远端 Integration ref、依赖相关差异、健康检查实现和 Staging 示例配置。

本轮已运行：`npm run check:context`、`npm run format:check`、`git diff --check`，均为 `PASS`。

未在本轮运行：业务测试、数据库测试、浏览器测试、依赖审计、SBOM、license inventory、部署或资源验证。上述结果仅引用已有证据文档和当前只读 Git/代码检查；任何需要新证据的门禁仍保持未验证或待人工确认。
