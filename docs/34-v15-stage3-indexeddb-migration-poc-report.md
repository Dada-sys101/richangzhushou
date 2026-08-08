# 日常助手 V2 技术选型 PoC：阶段3 IndexedDB 迁移与回滚验收报告

> 状态：阶段3方案、实现和专项测试已完成；以最终归档提交的专项PoC与完整CI作为关闭门禁。
> 分支：`codex/v15-tech-selection-poc`
> 前置依赖：阶段1 RRULE与阶段2本地加密结论已纳入v2结构。

## 1. 当前v1结构

当前Web应用使用数据库版本1，主要存储区如下：

| 存储区 | 主键 | 主要索引 | 内容 |
|---|---|---|---|
| `kv` | `key` | 无 | 游标、同步状态、ID映射等 |
| `entities` | `[userId, entityType, id]` | `entityId`、`userEntityType` | 本地实体，业务`data`为明文对象 |
| `pending` | `id` | `userId`、`createdAt` | 待同步队列，`payload/current/error`为明文 |

现有结构必须原样保留，直到v2迁移、验证、激活和回滚窗口全部完成。

## 2. 推荐方案

### 2.1 总体策略

采用：

```text
v1源存储保留
+ v2影子存储
+ 后台分批加密复制
+ 每条密文解密回验
+ 数量校验
+ 短事务切换activeSchema
+ 迁移日志
+ 指针回滚
```

不采用在`onupgradeneeded`中直接完成全部加密和数据搬迁。版本升级事务只负责创建结构，耗时加密在普通后台事务中分批执行。

### 2.2 两层原子性

第一层：结构升级原子性。

```text
IndexedDB version 1 -> version 2
只创建v2影子存储、索引和迁移日志
不删除v1
不切换业务读取路径
```

第二层：业务激活原子性。

```text
分批复制并加密
逐条解密验证
核对实体数与待同步记录数
在一个短事务内：
  activeSchema = v2
  journal.status = ACTIVE
```

激活事务失败时，读取路径仍保持v1。

## 3. v2存储结构

| 存储区 | 用途 |
|---|---|
| `entities_v2` | 保存实体查询元数据和加密信封 |
| `pending_v2` | 保存待同步操作元数据和加密信封 |
| `crypto_keys` | 保存阶段2确定的非导出CryptoKey |
| `migration_journal` | 保存迁移状态、进度、错误与激活信息 |
| `recurrence_series_v2` | 保存阶段1确定的重复规则系列 |
| `recurrence_exceptions_v2` | 保存“仅本次”等例外记录 |

### 3.1 `entities_v2`

主键：

```text
[userId, entityType, id]
```

明文查询字段：

```text
userId
entityType
id
pending
updatedAt
```

加密字段：

```text
data -> envelope.ciphertext
```

索引：

```text
userEntityType: [userId, entityType]
keyId: envelope.keyId
```

### 3.2 `pending_v2`

明文调度字段：

```text
id
userId
entityType
action
entityId
localId
version
status
createdAt
```

加密字段：

```text
payload
errorCode
errorMessage
current
```

索引：

```text
userId
createdAt
keyId
```

### 3.3 重复规则存储

`recurrence_series_v2`主键：

```text
[userId, id]
```

索引：

```text
userId
parentSeries: [userId, parentSeriesId]
```

`recurrence_exceptions_v2`主键：

```text
[userId, seriesId, originalRecurrenceId]
```

索引：

```text
series: [userId, seriesId]
```

这满足阶段1的“系列拆分”“仅本次修改”和稳定原始发生标识要求。

## 4. 迁移状态机

```text
v1 active
  -> COPYING
  -> VERIFYING
  -> ACTIVE(v2)
```

失败路径：

```text
COPYING失败
  -> 清空不完整v2影子记录和本次生成的密钥
  -> ROLLED_BACK
  -> activeSchema保持v1
```

```text
VERIFYING失败
  -> 禁止激活
  -> 清空v2影子记录和本次生成的密钥
  -> ROLLED_BACK
  -> activeSchema保持v1
```

崩溃或页面被关闭：

```text
COPYING_INTERRUPTED
  -> 下次启动检测非终态日志
  -> 清理不完整影子状态
  -> 从v1重新迁移
```

激活后的发布回退：

```text
ACTIVE(v2)
  -> activeSchema切回v1
  -> ROLLED_BACK_AFTER_ACTIVATION
  -> v1与v2均暂时保留，便于诊断和再次迁移
```

## 5. 可运行代码

迁移引擎：

```text
pocs/v15-tech-selection/lib/indexeddb-migration.mjs
```

专项测试：

```text
pocs/v15-tech-selection/tests/03-indexeddb-migration.test.mjs
```

运行命令：

```bash
cd pocs/v15-tech-selection
npm install --ignore-scripts
npm run test:indexeddb-migration
```

主要接口：

```js
openV1Database(indexedDB, databaseName)
openV2Database(indexedDB, databaseName)
migrateV1ToV2(options)
inspectMigrationState(options)
rollbackToV1(options)
verifyStoredKey(keyRow)
```

## 6. 专项测试场景与结果

测试环境：

```text
Ubuntu 24.04
Node.js 24.18.0
Web Crypto API
fake-indexeddb 6.2.5
```

测试数据：

```text
12条v1实体
4条v1待同步记录
2个用户
中文文本、账务字段、重复规则字段、同步错误和冲突current数据
```

| 场景 | 结果 | 验证内容 |
|---|---|---|
| v1到v2结构升级 | 通过 | v2影子、密钥、日志、重复规则存储及索引创建完成，但仍读取v1 |
| 正常加密迁移 | 通过 | 12条实体与4条pending全部加密复制并解密回验 |
| 多账号隔离 | 通过 | 两个用户生成不同非导出密钥，密文引用各自keyId |
| 明文泄露检查 | 通过 | v2实体没有`data`字段，v2 pending没有`payload`字段，敏感测试字符串不出现在目标记录JSON中 |
| 重复执行 | 通过 | 已激活v2时返回`ALREADY_ACTIVE`，不重复迁移 |
| 复制阶段故障 | 通过 | 第5条后注入失败，影子数据和本次密钥清空，v1完整保留 |
| 密文校验损坏 | 通过 | 篡改目标密文后解密验证失败，禁止激活并回滚 |
| 中断恢复 | 通过 | 保留模拟中断状态，下次启动识别并清理后成功重新迁移 |
| 激活后回退 | 通过 | 指针切回v1，v1与v2副本均保留 |
| 多标签页阻塞 | 通过 | 旧连接触发blocked，关闭旧连接后升级继续完成 |

专项测试结果：

```text
测试数：7
通过：7
失败：0
跳过：0
总耗时：约712ms
```

## 7. 回滚与旧数据保留策略

### 7.1 激活前失败

- 只清除`entities_v2`、`pending_v2`和本次生成的迁移密钥；
- `entities`、`pending`和原`kv`记录不删除；
- `activeSchema`保持`v1`；
- 日志记录失败原因；
- 用户仍可继续使用旧版本数据路径。

### 7.2 激活后回退

- 使用短事务把`activeSchema`切回`v1`；
- 不立即删除v2，便于诊断；
- 旧版本应用只访问原v1存储，不依赖v2结构；
- 回退后再次升级时重新验证和迁移，不盲目复用旧v2副本。

### 7.3 v1删除时机

不得在迁移版本中删除v1。

v1进入清理候选至少需要：

1. v2逐条解密验证和数量校验成功；
2. v2已完成至少一次完整同步；
3. 当前发布回滚窗口已经结束；
4. 线上监控没有迁移、解密或数据缺失异常；
5. 下一独立数据库版本提供专门清理迁移；
6. 清理前再次验证v2记录和密钥完整性。

具体保留天数应在发布计划阶段确定，本PoC不虚构固定天数。建议至少跨过一个稳定发布回滚周期，而不是在v2首次激活时删除。

## 8. 正式实现必须补充的运行时控制

### 8.1 写入协调

PoC使用静态测试数据。正式迁移时必须避免复制期间v1继续发生未捕获写入，可采用：

```text
短时写入屏障
或
迁移期间双写v1和v2
或
按updatedAt/revision增量追平后再激活
```

首选“分批初始复制 + revision增量追平 + 极短激活屏障”，避免长时间冻结用户操作。

### 8.2 多标签页协调

正式实现应使用：

```text
versionchange自动关闭旧连接
BroadcastChannel通知其他标签页
Web Locks保证同一时刻只有一个迁移执行者
blocked界面提示用户关闭旧页面或刷新
```

不得无限等待`blocked`事件。

### 8.3 容量预检

影子迁移会暂时同时保存v1明文、v2密文和密钥，空间可能接近原数据的两倍以上。迁移前应调用存储估算能力并设置安全余量；容量不足时保持v1，不启动迁移。

### 8.4 校验方式

PoC逐条解密并直接比较JSON。正式实现应增加：

- 规范化序列化或稳定内容哈希；
- 每批计数与校验摘要；
- 用户级和实体类型级统计；
- 失败记录ID但不记录明文payload；
- 迁移耗时、失败类型和恢复次数监控。

## 9. 结论

### 采纳“影子迁移 + 加密复制 + 解密校验 + 原子指针切换”

推荐理由：

1. 不在版本升级事务中执行长时间加密；
2. 激活前任何失败都不会破坏v1；
3. 页面关闭或崩溃后可以识别并重试；
4. 支持阶段2的非导出密钥与加密信封；
5. 支持阶段1的重复规则系列和例外存储；
6. 激活后仍能通过指针快速回退；
7. 多标签页阻塞行为已被明确验证。

## 10. 遗留风险

| 风险 | 影响 | 控制措施 |
|---|---|---|
| 临时双份数据 | 可能触发浏览器配额不足 | 迁移前容量预检、分批迁移、容量不足保持v1 |
| 迁移期间继续写入 | v2可能漏掉最新变更 | revision追平、短激活屏障或双写 |
| Safari及真机差异 | Node模拟不能替代真实浏览器 | 集成阶段增加iPhone Safari、Android Chrome与桌面浏览器真机门禁 |
| 多标签页长时间阻塞 | 升级无法开始 | versionchange、BroadcastChannel、Web Locks、超时提示 |
| JSON对象属性顺序 | 直接字符串比较可能产生误判 | 正式版使用规范化序列化或内容哈希 |
| 密钥或密文被浏览器清除 | v2数据不可读取 | 保持服务端副本、同步优先、阶段2密钥丢失策略 |
| 旧版本回退后产生新写入 | 再升级时旧v2已过期 | 回退后重新迁移或做revision增量验证 |
| 源数据长期保留 | 增加空间与敏感明文驻留时间 | 独立清理版本、满足清理门禁后删除v1 |

## 11. 对阶段4导入功能的约束

阶段4不得直接写死`entities`或`entities_v2`存储名，必须通过当前活动仓储接口写入。

导入期间必须：

- 检查迁移状态，不在`COPYING`或`VERIFYING`期间启动导入；
- 使用批量事务并限制批大小；
- 通过v2仓储自动加密敏感payload；
- 记录导入批次ID，支持整批回滚；
- 先做容量预估，考虑原文件、解析内存和IndexedDB写入空间；
- 导入完成后核对成功、失败、跳过和重复记录数量。

## 12. 阶段门禁

阶段3关闭需要同时满足：

- 完整迁移引擎已归档；
- 7项专项测试全部通过；
- v1源数据在成功、失败和回退场景均保留；
- 待同步队列已纳入加密迁移；
- 多账号隔离已验证；
- 中断恢复和多标签页阻塞已验证；
- Prettier、Lint、类型检查和完整CI通过；
- 最终格式化代码的专项PoC通过；
- `main`未修改、未部署；
- 用户确认后才进入阶段4。
