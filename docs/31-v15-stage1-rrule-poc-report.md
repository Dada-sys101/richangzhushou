# 日常助手 V2 技术选型 PoC：阶段1 RRULE 双方案验收报告

> 状态：阶段1已完成，等待人工确认后方可进入阶段2。
> 分支：`codex/v15-tech-selection-poc`
> 代码基线：`main @ 13bfad4d32157166fa6e8f5215ce5f813a1ad67c`
> 自动化环境：Ubuntu 24.04、Node.js 24.18.0、npm 11.16.0

## 1. 方案说明

本阶段比较以下两套候选：

### 方案A：`rrule` 2.8.1 + `Luxon` 3.7.2

- `rrule`负责RFC 5545风格重复规则展开。
- Luxon负责IANA时区、UTC转换和本地时间展示。
- 优势：生态成熟、使用范围广。
- 风险：`Date`、TZID、宿主机时区和浮动时间语义组合复杂，DST边界需要额外归一化。

### 方案B：`rrule-temporal` 2.0.2 + `temporal-polyfill` 1.0.1

- 重复实例直接返回带TZID的`ZonedDateTime`。
- 时间点、墙上时间和时区语义分离更明确。
- 优势：DST和跨时区语义直观，减少`Date`归一化代码。
- 风险：生态和生产案例少于`rrule`，需通过项目内接口隔离依赖。

无论采用哪套库，业务层均使用项目自有`RecurrenceEngine`接口，第三方库对象不得进入数据库实体或共享DTO。

## 2. 可运行代码

测试入口：

```bash
cd pocs/v15-tech-selection
npm install --ignore-scripts
npm run test:rrule
```

主要文件：

- `pocs/v15-tech-selection/tests/01-rrule.test.mjs`
- `pocs/v15-tech-selection/scripts/rrule-child.mjs`

建议领域接口：

```ts
export type RecurrenceTimeSemantics = "WALL_CLOCK" | "ABSOLUTE_INSTANT";

export interface RecurrenceSeriesInput {
  dtStartLocal: string;
  timeZone: string;
  rule: string;
  semantics: RecurrenceTimeSemantics;
}

export interface RecurrenceOccurrence {
  recurrenceId: string;
  localDateTime: string;
  timeZone: string;
  instant: string;
}

export interface RecurrenceEngine {
  expand(input: RecurrenceSeriesInput, rangeStart: string, rangeEnd: string): RecurrenceOccurrence[];
}
```

## 3. 测试场景与实际结果

### 3.1 DST切换

测试规则：

```text
DTSTART;TZID=America/New_York:20260301T090000
RRULE:FREQ=WEEKLY;COUNT=4
```

预期墙上时间：

| 日期 | 本地时间 | UTC时间 |
|---|---|---|
| 2026-03-01 | 09:00 EST | 14:00Z |
| 2026-03-08 | 09:00 EDT | 13:00Z |
| 2026-03-15 | 09:00 EDT | 13:00Z |
| 2026-03-22 | 09:00 EDT | 13:00Z |

结果：

| 候选 | 结果 | 说明 |
|---|---|---|
| 方案A：rrule + Luxon | 未达到预期 | 在首次真实运行中，2026-03-08生成了12:00Z而不是13:00Z；表明归一化链路对DST边界存在歧义和误用风险 |
| 方案B：rrule-temporal | 通过 | 四次实例均保持09:00墙上时间，并得到正确UTC时间 |

方案A之后改为“记录行为而非强行判定整个测试失败”，用于保留对比证据；这不代表其DST语义通过。

### 3.2 跨时区语义

验证了两类语义：

- `WALL_CLOCK`：用户计划在系列TZID下保持原本的本地时间，例如每周纽约09:00；设备切换到东京时只改变展示，不改变系列定义。
- `ABSOLUTE_INSTANT`：固定UTC时间点每周重复；DST后纽约本地展示会从09:00变为10:00。

结果：通过。

项目决策建议：

- 日程、待办、提醒默认使用`WALL_CLOCK + series TZID`。
- 系统清理、后台任务和严格间隔任务才使用`ABSOLUTE_INSTANT`。
- 设备时区变化不得自动重写已有系列TZID。

### 3.3 “仅本次”和“此后所有”

验证内容：

- “仅本次”：保存`originalRecurrenceId`，由例外记录替换单个实例。
- “此后所有”：旧系列在分割点前结束，新系列从分割点开始，二者不得重叠。

结果：通过。

该能力不是由第三方库单独完成，仍需项目自研：

- `RecurrenceSeries`
- `RecurrenceException`
- `originalOccurrenceAt`
- 系列拆分事务
- 单次取消/替换
- 旧系列截止规则

## 4. 结论

### 推荐：采纳方案B，但需注意生态成熟度

首选：

```text
rrule-temporal 2.0.2
+ temporal-polyfill 1.0.1
+ 项目自有 RecurrenceEngine
```

理由：

1. 在本项目最关键的DST测试中直接通过。
2. 返回`ZonedDateTime`，能够明确区分本地时间、TZID和绝对时间点。
3. 跨时区和DST代码更容易审查，减少对JavaScript `Date`特殊语义的依赖。
4. 后续IndexedDB和数据库可围绕明确的时间语义设计。

方案A不作为V2首选实现，但保留为回退候选。若后续发现方案B生态或兼容性阻塞，只能通过`RecurrenceEngine`内部替换，不得影响业务数据结构。

## 5. 对后续数据结构的冻结建议

周期系列至少保存：

```text
id
userId
entityType
entityId
dtStartLocal
timeZone
rrule
semantics                // WALL_CLOCK | ABSOLUTE_INSTANT
disambiguationPolicy     // EARLIER | LATER | REJECT | NEXT_VALID
seriesVersion
startsAtInstant
endsAtInstant nullable
createdAt
updatedAt
```

例外实例至少保存：

```text
seriesId
originalOccurrenceAt
operation                // CANCEL | REPLACE
replacementLocal nullable
replacementTimeZone nullable
replacementInstant nullable
payloadPatch nullable
```

原则：

- 不把设备当前时区当作系列时区。
- 不只保存UTC时间而丢弃原始本地时间和TZID。
- `originalOccurrenceAt`必须稳定，用于同步、幂等和例外匹配。
- “此后所有”必须创建新系列，不直接覆盖历史系列。

## 6. 遗留风险

| 风险 | 影响 | 控制措施 |
|---|---|---|
| `rrule-temporal`生态较新 | 未来API或兼容性可能变化 | 精确锁版本；通过`RecurrenceEngine`隔离；建立黄金测试集 |
| Temporal仍使用polyfill | 包体和运行时成本增加 | 仅在周期领域加载；构建时检查体积 |
| 不存在的本地时间 | 春季DST跳时可能无对应Instant | 业务层固定`disambiguationPolicy`并提示用户 |
| 重复本地时间 | 秋季DST回拨会对应两个Instant | 明确EARLIER/LATER策略并保存选择 |
| 长期无限系列 | 展开可能耗时 | 强制时间窗、最大实例数和迭代上限 |
| 时区数据库变化 | 历史或未来结果可能受规则更新影响 | 保存TZID和原始本地语义；关键实例可物化并记录引擎版本 |

## 7. 阶段门禁

阶段1自动化结论：通过。

但该结论只冻结以下内容：

- 选择`rrule-temporal + Temporal polyfill`作为首选。
- 引入项目自有`RecurrenceEngine`。
- 用户计划默认使用`WALL_CLOCK + series TZID`。
- 周期例外和系列拆分由项目自研。

本阶段未修改`main`、未部署、未开始本地加密实现。

> 等待用户确认后，才进入阶段2：本地加密与密钥管理PoC。
