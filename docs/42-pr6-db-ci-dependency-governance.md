# PR6 数据库 CI 与依赖治理实现

## 1. 正式入口与范围

本文档描述 PR6 中数据库 CI 分离、许可证清单和 CycloneDX SBOM 生成/校验的实现基线。实现范围仅限以下路径：

- `.github/workflows/ci.yml`
- `.gitignore`
- `.project/v15-execution-state.md`
- `apps/api/src/cli/validate-temporary-mysql84.ts`
- `apps/api/src/cli/validate-temporary-mysql84.test.ts`
- `docs/42-pr6-db-ci-dependency-governance.md`
- `package.json`
- `scripts/license-inventory.mjs`
- `scripts/license-inventory.test.mjs`
- `scripts/sbom-generate.mjs`
- `scripts/sbom-validate.mjs`
- `scripts/sbom-validate.test.mjs`

本实现不修改业务代码、Prisma schema 或迁移。`apps/api` 验证器的两处变更仅修正 CI evidence parsing 兼容性，`.project/v15-execution-state.md` 则属于 PR6 当时合法的最小状态同步范围。

`.project/v15-execution-state.md` 是仓库内 execution snapshot，不是 GitHub、CI 或实际环境的实时事实来源。发生差异时继续遵循以下优先级：Git / GitHub / CI / environment > repository execution snapshot。

## 2. 审计与人工门禁高阈值

许可证清单和 SBOM 生成仅做技术基线采集，不做法律批准。任何字段都不输出 `APPROVED`、`LEGAL_APPROVED`、`AUTO_APPROVAL` 或等价自动批准语义。

H8 人工门禁保持 `manual/open`，本 PR 不关闭、不替代人工法律审查。无法解析、缺失或语义不清的许可证元数据统一标记为 `MANUAL_REVIEW_REQUIRED`，留给后续人工审查。

## 3. 许可证清单技术基线

### 3.1 数据源

脚本读取 `package-lock.json` 的 `packages` map，并仅采集路径以 `node_modules/` 开头的已安装依赖条目，包含嵌套 `node_modules/`。

### 3.2 包名推导

包名取锁文件路径中最后一个 `node_modules/` 之后的段，正确处理 scoped 和嵌套包：

- `node_modules/@scope/pkg` → `@scope/pkg`
- `node_modules/foo/node_modules/bar` → `bar`
- `node_modules/@scope/parent/node_modules/@scope/child` → `@scope/child`

### 3.3 状态语义

- 普通条目：`METADATA_RECORDED`，仅记录元数据，不代表批准。
- 缺失、非字符串、空值、`UNKNOWN`、`UNLICENSED`、`SEE LICENSE IN ...`、语法歧义表达式、复合表达式，或 MPL/EPL/GPL/LGPL/EUPL/CDDL family identifier：`MANUAL_REVIEW_REQUIRED`。该规则仅识别需要人工政策复核的元数据形态，不对许可证作法律分类或批准。

输出包含包名、版本、声明许可证/许可证表达式、审查状态和原因数组。汇总包含包数量、唯一许可证表达式数量、缺失/未解析数量、人工审查数量。

### 3.4 输出路径与命令

```powershell
npm run inventory:licenses
```

输出：

```text
output/pr6/license-inventory.json
```

输出按包名、版本、许可证表达式、审查状态进行稳定排序，便于 diff 和审计。

## 4. CycloneDX SBOM

### 4.1 生成命令

使用 npm 11 内置 SBOM 能力，通过仓库内脚本封装，不依赖额外依赖或 shell 插值：

```text
npm sbom --package-lock-only --sbom-format cyclonedx --sbom-type application --workspaces
```

本地入口：

```powershell
npm run sbom:generate
```

输出：

```text
output/pr6/sbom.cdx.json
```

脚本在 `npm_execpath` 不可用时直接失败并给出诊断。SBOM 子进程仅继承运行 Node/npm 所需的最小 OS 环境 allowlist，不继承 GitHub token、npm auth、数据库 URL 或其他 credential 环境变量，也不会输出环境变量或密钥。

### 4.2 校验命令

```powershell
npm run sbom:validate
```

校验器要求：

- 输入为非空且可解析 JSON；
- 顶层 `bomFormat` 严格等于 `CycloneDX`；
- 存在非空 `specVersion` 或 `$schema` 标记；
- `components` 为非空数组；
- 通过后报告组件数量，失败时返回非零退出码。

## 5. CI 结构

`quality` 作业移除 MySQL service、作业级 `DATABASE_URL`、直接 migration 和 DB integration 步骤。它在锁定安装、Prisma generate 和共享 contracts/config 构建后继续运行 `npm run quality`，随后执行：

1. `npm run test:governance`
2. `npm run inventory:licenses`
3. `npm run sbom:generate`
4. `npm run sbom:validate`

新增 `db-validation` 作业，仅使用 `mysql:8.4` service 和 `MYSQL_ROOT_PASSWORD`，在单一验证步骤中通过 `PR6A_MYSQL_ADMIN_URL` 与 `PR6A_EVIDENCE_LABEL` 调用 `npm run validate:mysql84:ci`。该别名指向现有临时 MySQL 8.4 验证器，负责 migrations、真实数据库测试、隔离、清理和残余检查。

### 5.1 Vitest CI evidence parsing correction

CI #226 暴露了 Vitest 在 GitHub CI 中输出 ANSI control sequences 时，测试摘要 evidence parsing 无法稳定提取计数的问题。修正提交 `a407291388a0f35de8a337a2378ce4ebea3550ba` 在 `apps/api/src/cli/validate-temporary-mysql84.ts` 中新增 ANSI control-sequence normalization，使既有的 fail-closed evidence validation 能正确处理 GitHub CI 输出；同时在 `apps/api/src/cli/validate-temporary-mysql84.test.ts` 中补充 ANSI summary 成功解析场景，以及不可解析 summary 继续保持 fail-closed 的回归测试。该提交没有新增或重新设计 fail-closed mechanism。

该兼容性修正不是对 PR6a validator 的重新设计，没有改变：

- temporary database lifecycle；
- scoped database user semantics；
- credential boundary；
- database isolation；
- cleanup semantics；
- residual-resource checks；
- migration semantics。

修正后的实时 CI 证据如下：

- CI #226：historical failure，暴露 Vitest CI evidence parsing 问题；
- correction commit：`a407291388a0f35de8a337a2378ce4ebea3550ba`；
- CI #227：`SUCCESS`；
- PR-triggered CI #228：`SUCCESS`；
- CI #228 jobs：`quality = success`、`db-validation = success`、`browser-qa = success`。

## 6. 工件保留路径

CI 使用 `actions/upload-artifact@v4`，保留 7 天：

- `output/pr6/license-inventory.json`
- `output/pr6/sbom.cdx.json`
- `output/pr6a/evidence/`

上传步骤使用 `if: always()`，`if-no-files-found` 设为 `warn`。

## 7. 本地复现

```powershell
npm ci
npm run prisma:generate --workspace @daily-assistant/api
npm run build --workspace @daily-assistant/api-contracts
npm run build --workspace @daily-assistant/config
npm run test:governance
npm run inventory:licenses
npm run sbom:generate
npm run sbom:validate
```

数据库验证需要本机可发现的 loopback Oracle MySQL 8.4 管理 URL，且不得从 `.env` 或密钥文件读取：

```powershell
$env:PR6A_MYSQL_ADMIN_URL="mysql://root:<ci-only-password>@127.0.0.1:3306/mysql"
$env:PR6A_EVIDENCE_LABEL="pr6a-local"
npm run validate:mysql84:ci
```

## 8. 凭据边界

- CI 只使用 CI-only 字面密码，不 `echo`。
- `db-validation` 作业不设置作业级 `DATABASE_URL`、`TEST_DATABASE_URL` 或管理员 URL。
- 管理 URL 仅存在于验证步骤的 `env`，且验证器将其从子进程环境隔离。
- 脚本失败诊断不输出环境变量、令牌、数据库 URL 或密钥。
