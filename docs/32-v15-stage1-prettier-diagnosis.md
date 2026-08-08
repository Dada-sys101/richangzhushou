# 日常助手 V2 阶段1：Prettier 诊断报告

> 诊断方式：仅运行 `prettier --check`，并将每个原文件与 `prettier <file>` 的标准输出做只读 diff；诊断阶段未写入9个源文件。

## 配置结论

- 仓库原先没有 `.prettierrc`，因此使用 Prettier 3.9 默认规则。
- `.editorconfig` 已明确：UTF-8、LF、2空格缩进、末尾换行。
- `.prettierignore` 只忽略依赖、构建产物、覆盖率、锁文件、生成目录和 Markdown；没有误忽略或误包含这9个PoC源文件。
- ESLint 使用 `eslint-config-prettier`，未发现 ESLint 与 Prettier 互相冲突。
- 此次失败不是解析错误，也不是业务代码问题，而是多个表达式超过默认 `printWidth: 80` 后未按 Prettier 预期换行。
- 为避免后续Prettier版本或开发环境默认值产生漂移，新增 `.prettierrc.json`，显式冻结当前规则，不改变既有风格。

## 逐文件问题清单

| 文件 | 问题类型 | 是否影响逻辑 | 修复方式 |
|---|---|---:|---|
| `scripts/generate-notices.mjs` | 长命名导入、嵌套三元表达式、长排序与写文件调用超过80列；补充结构性换行和尾随逗号 | 否 | 自动格式化；人工确认三元表达式中的 `?? null` 仅增加括号、语义不变 |
| `scripts/import-benchmark.mjs` | 长对象字面量、流式解析调用、乘法表达式、环境对象和 `writeFileSync` 超过80列 | 否 | 自动格式化；检查资源阈值数值和错误字符串未变化 |
| `scripts/rrule-child.mjs` | `process.stdout.write(JSON.stringify(...))` 嵌套调用需要多行展开 | 否 | 自动格式化；检查TZID、RRULE模板字符串和时间格式字符串保持逐字符一致 |
| `tests/01-rrule.test.mjs` | DateTime链式调用、回调、三元表达式、长断言和数组超过80列 | 否 | 自动格式化后重点人工审查DST输入、预期UTC时间、TZID、时间格式字符串及系列拆分逻辑 |
| `tests/02-local-encryption.test.mjs` | Web Crypto长参数调用、AAD模板字符串所在调用、长对象与断言回调超过80列 | 否 | 自动格式化；确认模板字符串内容、AES-GCM参数和Base64URL字段不变 |
| `tests/03-indexeddb-migration.test.mjs` | 复合keyPath对象、事务调用、迁移日志对象和结果对象超过80列 | 否 | 自动格式化；确认对象仓库名、复合键顺序、事务模式和回滚顺序不变 |
| `tests/04-import.test.mjs` | 长命名导入、参数解构、嵌套三元、条件语句、流式解析调用和长断言超过80列 | 否 | 自动格式化；确认扩展名判断、错误码、金额/编码断言和正则未变化 |
| `tests/05-web-push.test.mjs` | 长解构赋值、VAPID调用、平台条件数组和长说明字符串超过80列 | 否 | 自动格式化；确认VAPID参数顺序、平台版本条件和字符串内容不变 |
| `tests/06-ai-adapter.test.mjs` | 长枚举、条件抛错、`AggregateError`、异步回调、响应对象和断言超过80列 | 否 | 自动格式化；确认模型ID、错误码、Schema枚举和正则断言不变 |

## 自动格式化可能误伤检查

诊断diff显示：

- 没有修改任何字符串字面量内容。
- 没有修改RRULE多行模板字符串。
- 没有修改日期、时间、TZID、UTC预期值或Luxon格式字符串。
- 没有修改正则表达式。
- 没有调整函数参数顺序、对象字段值、数组元素顺序或条件表达式逻辑。
- 唯一新增的括号是 Prettier 为嵌套空值合并表达式增加的分组，语义等价。

因此这9个文件可使用当前锁定配置进行自动格式化，但格式化后仍需对RRULE文件做人工diff复核并重新运行完整CI。
