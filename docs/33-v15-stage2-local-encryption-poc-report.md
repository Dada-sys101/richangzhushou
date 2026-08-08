# 日常助手 V2 技术选型 PoC：阶段2 本地加密与密钥管理验收报告

> 状态：阶段2技术实现与自动化测试已完成，等待最终完整CI与人工确认。
> 分支：`codex/v15-tech-selection-poc`
> 前置依赖：阶段1 RRULE已正式关闭。

## 1. 方案说明

### 1.1 推荐方案

```text
Web Crypto API
AES-256-GCM
每用户、每设备、每密钥版本一把非导出CryptoKey
CryptoKey通过结构化克隆存入IndexedDB
敏感JSON字段加密后再写入本地数据库
```

核心参数：

| 项目 | 决策 |
|---|---|
| 对称算法 | AES-GCM |
| 密钥长度 | 256位 |
| IV | 每次加密随机生成12字节，禁止复用 |
| Authentication Tag | 128位 |
| 密钥导出 | 禁止，`extractable=false` |
| 密钥用途 | 仅`encrypt`、`decrypt` |
| 密钥粒度 | `userId + deviceId + keyVersion` |
| 密钥存储 | IndexedDB中的CryptoKey对象，不保存原始密钥字节 |
| 密文编码 | Base64URL |
| 版本字段 | `schemeVersion`、`keyVersion` |

### 1.2 AAD绑定

认证附加数据包含：

```text
app
tschemeVersion
userId
keyId
recordType
recordId
```

实际代码字段为：

```text
app
schemeVersion
userId
keyId
recordType
recordId
```

这使密文不能被静默移动到另一个用户、记录类型或记录ID下使用。任何密文或AAD身份字段变化都会导致AES-GCM认证失败。

### 1.3 加密范围

V2首发建议加密：

- 本地草稿的业务内容；
- 离线缓存中的敏感业务payload；
- 待同步队列中的敏感请求payload；
- 可能包含账务备注、地点、行程详情的本地字段。

以下索引元数据可保持明文，以支持IndexedDB查询和迁移：

- `userId`；
- `entityType` / `recordType`；
- `recordId`；
- 同步状态；
- 创建和更新时间；
- 密钥版本、加密方案版本。

本方案不是全数据库透明加密，也不承诺隐藏记录数量、类型、时间和账号标识等元数据。

## 2. 可运行代码

主要实现：

```text
pocs/v15-tech-selection/lib/local-crypto.mjs
```

测试：

```text
pocs/v15-tech-selection/tests/02-local-encryption.test.mjs
```

运行命令：

```bash
cd pocs/v15-tech-selection
npm install --ignore-scripts
npm run test:local-encryption
```

主要接口：

```js
buildKeyId(userId, deviceId, keyVersion)
generateDeviceKey(cryptoProvider)
encryptJson(...)
decryptJson(...)
IndexedDbLocalVault.getOrCreateKey(...)
IndexedDbLocalVault.encryptRecord(...)
IndexedDbLocalVault.decryptRecord(...)
IndexedDbLocalVault.eraseUser(userId)
```

密文信封结构：

```ts
interface LocalEncryptedEnvelope {
  scheme: "AES-256-GCM";
  schemeVersion: 1;
  keyId: string;
  userId: string;
  recordType: string;
  recordId: string;
  iv: string;
  ciphertext: string;
  updatedAt?: string;
}
```

## 3. 测试场景与实际结果

自动化环境：

```text
Ubuntu 24.04
Node.js 24.18.0 Web Crypto
fake-indexeddb 6.2.5
```

| 测试场景 | 结果 | 实际证据 |
|---|---|---|
| 非导出AES密钥生成 | 通过 | `extractable=false`，尝试`exportKey`被拒绝 |
| IndexedDB关闭、重开后的密钥持久化 | 通过 | 重开数据库后可使用原CryptoKey解密原草稿 |
| 正常加密/解密 | 通过 | 中文备注、金额和对象结构完整恢复 |
| 密文篡改 | 通过 | 修改密文首字节后解密失败 |
| 记录身份/AAD篡改 | 通过 | 将`recordId`改为其他记录后解密失败 |
| 同设备多账号隔离 | 通过 | 用户A/B生成不同keyId和CryptoKey |
| 跨账号密钥解密 | 通过 | 使用用户B密钥解密用户A密文被拒绝 |
| 密钥丢失 | 通过 | 密文仍存在，但因`LOCAL_KEY_UNAVAILABLE`无法恢复 |
| 显式退出 | 通过 | 只删除当前账号密钥和密文，不影响另一账号 |
| 会话暂时失效 | 通过 | 保留密钥和密文，数据库重开后仍可离线解密 |

阶段2专项测试：

```text
测试数：6
通过：6
失败：0
跳过：0
总耗时：约152ms
```

## 4. 密钥管理方案

### 4.1 设备标识

首次启用本地加密时生成随机`deviceId`，保存在应用Origin的非敏感KV区。

```text
deviceId = random UUID
keyId = daily-assistant-key:{encodedUserId}:{encodedDeviceId}:v{keyVersion}
```

不得使用设备型号、广告标识、用户名或可预测字符串作为设备ID。

### 4.2 多账号切换

- 每个账号使用独立keyId和CryptoKey；
- 记录的复合主键必须包含`userId`；
- 解密前校验密钥所属用户与记录用户一致；
- 切换账号只切换当前访问范围，不自动读取其他账号数据；
- 清除账号A时不能删除账号B的CryptoKey或密文。

### 4.3 会话失效与显式退出必须区分

| 场景 | 密钥 | 密文 | 原因 |
|---|---|---|---|
| Access Token过期、暂时断网 | 保留 | 保留 | 支持离线模式和稍后同步 |
| 用户主动退出登录 | 删除当前账号 | 删除当前账号 | 防止设备后续使用者读取 |
| 关闭账号/申请删除 | 删除当前账号 | 删除当前账号 | 与账号删除语义一致 |
| 切换到另一个账号 | 原账号可保留但不可访问 | 原账号可保留但不可访问 | 支持同设备多账号隔离；产品可配置为切换时清除 |
| 浏览器数据被用户清除/PWA卸载 | 丢失 | 通常同时丢失 | 本地数据不可恢复，重新登录后从服务端恢复已同步数据 |

现有认证Store中的本地清理是异步触发但未等待。正式接入时，显式退出、关闭账号和删除申请必须等待本地密钥与数据清除完成后再结束流程；会话刷新失败进入离线模式时不得调用清除。

### 4.4 密钥轮换

首发支持版本字段，但不要求自动周期轮换。

触发轮换的建议场景：

- 加密方案升级；
- 已知实现缺陷；
- 用户选择“重置本机离线数据”；
- 未来引入恢复密钥或包装密钥。

轮换流程：

```text
生成v2密钥
读取v1密文
使用v1解密
使用v2重新加密
验证v2密文
更新记录keyId
全部完成后再删除v1密钥
```

轮换必须可恢复，不能先删除旧密钥。

## 5. 密钥丢失场景处理策略

### 5.1 实际结论

当前推荐的非导出设备密钥在以下情况丢失后，无法从密文恢复：

- 用户清除站点数据；
- PWA被卸载并清除Origin数据；
- IndexedDB损坏；
- 代码主动删除CryptoKey；
- 设备丢失或更换设备。

没有独立的包装密钥、恢复口令或服务器密钥时，AES-GCM密文不可恢复。这是设计结果，不是实现Bug。

### 5.2 “不可恢复”是否可接受

结论：**有条件接受。**

可接受范围：

- 已经同步到服务端的数据缓存；
- 可以重新下载的数据；
- 用户明确同意可丢弃的临时缓存；
- 短期离线草稿，且界面持续显示“尚未同步、清除应用数据将无法恢复”。

不可接受范围：

- 用户数据的唯一副本；
- 长期保存但从不上传的高价值草稿；
- 用户被告知“加密后一定可恢复”的数据；
- 财务、行程等没有服务端副本且用户无导出手段的数据。

首发门禁：

1. 本地加密不得成为唯一备份机制；
2. 联网后优先同步未同步草稿；
3. 未同步数据必须有明显状态；
4. 用户执行退出、重置、清除缓存前显示不可恢复警告；
5. 退出前若仍有未同步数据，应要求用户确认或先尝试同步；
6. 服务端已有副本的数据在密钥丢失后允许重新下载重建缓存。

### 5.3 暂不采用的恢复方案

| 方案 | 当前结论 | 原因 |
|---|---|---|
| 直接使用登录密码作为AES密钥 | 不采纳 | 密码变更、离线暴力破解、KDF参数和登录协议耦合风险高 |
| 将原始设备密钥上传服务器 | 不采纳 | 破坏设备本地密钥边界，扩大服务端泄露影响 |
| 用户恢复口令包装设备密钥 | 延后 | 可实现，但增加恢复口令保管、轮换、忘记口令和支持成本 |
| 服务端KEK包装设备密钥 | 延后 | 可支持跨设备恢复，但需独立威胁模型、认证加强和密钥生命周期设计 |
| WebAuthn/平台凭据包装 | 延后 | 设备和浏览器能力差异较大，首发复杂度过高 |

## 6. 结论

### 采纳，但需限制用途并明确不可恢复风险

最终建议：

```text
Web Crypto AES-256-GCM
+ 非导出设备CryptoKey
+ IndexedDB结构化克隆持久化
+ 每用户/每设备/每版本隔离
+ AAD绑定用户和记录身份
```

采纳理由：

1. 不需要自行实现密码算法；
2. 原始密钥字节不暴露给应用代码和日志；
3. AES-GCM同时提供机密性与完整性验证；
4. 可以和现有IndexedDB及离线同步架构结合；
5. 多账号隔离、显式退出清除和会话失效保留均已通过自动化测试；
6. 不需要将登录密码与本地数据加密生命周期绑定。

## 7. 遗留风险

| 风险 | 影响 | 控制措施 |
|---|---|---|
| 同源XSS或恶意脚本 | 脚本可调用存储中的CryptoKey进行解密，即使密钥不可导出 | CSP、Trusted Types评估、依赖审计、禁止不可信脚本、输入输出安全 |
| 浏览器清除Origin数据 | 密钥与未同步密文丢失 | 自动同步、未同步警告、退出前确认、服务端重建缓存 |
| 元数据保持明文 | 可看到记录类型、数量、时间和账号标识 | 只保留查询必需字段，敏感payload全部加密 |
| 非硬件保证 | 浏览器不保证CryptoKey一定存于安全芯片 | 不宣传为硬件级保险箱，不存放唯一高价值秘密 |
| 多标签页同时首次创建密钥 | 可能发生同keyId并发创建 | 正式实现使用Web Locks或单写者协调，并增加并发测试 |
| 现有退出流程未等待异步清除 | 页面关闭或跳转时可能清理未完成 | 将清除改为可等待事务，退出接口等待本地清理结果 |
| 真机差异 | Node和fake-indexeddb不能替代Safari/Chrome真实实现 | 在WP6集成阶段增加iPhone、Android、桌面浏览器真机门禁 |
| 密钥版本升级 | 轮换中断可能造成部分记录不可读 | 影子写入、验证后切换、保留旧密钥；与阶段3迁移方案结合 |

## 8. 对阶段3 IndexedDB设计的输入

阶段3必须根据本阶段结论加入：

- `keys`存储或等价的密钥存储区；
- 加密信封字段；
- `schemeVersion`与`keyVersion`；
- 记录按`userId`隔离；
- v1明文到v2密文的影子迁移；
- 迁移完成前保留v1数据和旧密钥；
- 解密验证、数量校验和迁移日志；
- 回滚时不得删除v1数据；
- 显式退出的原子或可恢复清理；
- 多标签页密钥创建协调。

## 9. 阶段门禁

阶段2关闭需要同时满足：

- 实现代码已归档；
- 6项专项测试全部通过；
- 密钥丢失策略已明确；
- 多账号和退出策略已记录；
- Prettier、Lint、类型检查和完整CI通过；
- PoC分支未修改`main`；
- 等待用户确认后才进入阶段3。
