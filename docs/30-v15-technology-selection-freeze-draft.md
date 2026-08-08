# 日常助手 V2 技术选型冻结版（PoC草案）

> 状态：待 GitHub Actions 自动PoC结果和真机/真实样本门禁完成后冻结。

## 执行顺序

1. RRULE双方案对比
2. 本地加密与密钥管理
3. IndexedDB v1→v2迁移
4. CSV/XLSX导入
5. Web Push
6. AI Adapter
7. 许可证、SBOM与依赖审计

## 候选与初步决策

| 能力 | 候选/方案 | PoC前状态 |
|---|---|---|
| 重复规则 | rrule.js 2.8.1 + Luxon 3.7.2；rrule-temporal 2.0.2 + Temporal | 双方案测试后冻结 |
| 本地加密 | Web Crypto AES-256-GCM；设备级非导出密钥 | 条件采纳 |
| IndexedDB迁移 | 影子存储 + 迁移日志 + 原子激活指针 | 推荐 |
| CSV | csv-parse 7.0.2 流式解析 | 推荐 |
| XLSX | read-excel-file 9.3.5 只读解析 | 推荐，需限制行数和文件大小 |
| Push | web-push 3.6.7 + 原生Push API/Service Worker | 条件采纳，需真机 |
| AI | OpenAI SDK 7.4.0 + 独立Provider Adapter + Ajv 8.20.0 | 推荐，需真实API门禁 |
| 异步工作 | 现有NestJS + MySQL租约任务表 | 保留自研方向 |

## 冻结原则

- 不替换现有认证、财务、行程、同步、幂等和StorageAdapter。
- 第三方日期库不得直接渗透业务实体，统一通过 `RecurrenceEngine`。
- 用户计划默认使用“本地墙上时间 + 系列TZID”语义；系统任务才允许绝对时间语义。
- 本地加密只保护本地草稿和缓存。设备密钥丢失后，未同步草稿不可恢复，必须明确告知用户。
- IndexedDB v2迁移期间保留v1数据，验证完成后才切换激活指针；不得在同一版本删除v1存储。
- Push是尽力而为的通知通道，不是提醒数据源。
- AI输出必须经过JSON Schema和领域校验，并由用户确认后才能写入业务表。
- 微信/支付宝真实导出样本、iPhone/Android真机和真实AI API均为发布前人工门禁。

## 待结果回填

GitHub Actions将生成：

- `01-rrule.json`
- `02-local-encryption.json`
- `03-indexeddb-migration.json`
- `04-import-correctness.json`
- `04-import-performance.json`
- `05-web-push.json`
- `06-ai-adapter.json`
- `dependency-license-matrix.json`
- `THIRD_PARTY_NOTICES.md`
- `npm-audit.json`
- `sbom.cdx.json`
