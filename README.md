# 日常助手（Daily Assistant）

面向约 10 名管理员建号的首批用户。项目采用 Vue PWA、Vue 管理端、
NestJS 单体、Prisma 7 + MySQL 8.4 和 OpenAPI 共享契约。

## 分支

- `main`：稳定 V1；
- `codex/v15-integration-foundation`：V1.5 正式集成；
- `codex/v15-tech-selection-poc`：PoC 证据；
- Staging：未创建；
- Production：未部署。

执行入口：

1. `PLANS.md`
2. `.project/v15-execution-state.md`
3. `tasks/V15-CTRL-001.md`
4. `PROJECT_STATUS.md`

## 已有 V1

- 管理员建号、认证、容量、审计和用户隔离；
- 记账、分类、账户、预算、草稿和附件；
- 日历、待办、提醒、行程和快捷指令；
- PWA、IndexedDB、离线队列、同步和冲突；
- Playwright 浏览器 QA、GitHub Actions、OSS Adapter。

邮箱注册、邀请码注册和截图 OCR 已下线。

## V1.5 首发

R1 在现有 V1 上增量完成：

- AI Proposal/Operation；
- 一个真实 AI Provider；
- 统一 Repository；
- Staging、备份恢复和可回滚发布；
- 3→5→约 10 人封闭试用；
- 受控灰度。

AI 是硬门禁，正式写入必须经用户确认。

Web Push 属 R1.1，门禁未通过时保持关闭，站内提醒保底，不阻塞 R1。

Import、新 RRULE 切换、完整本地加密迁移和 Shrink 属 R2/R3，后移但不取消。

## 开发

要求 Node 24、npm 11、MySQL 8.4。

```bash
npm ci
npm run prisma:generate
npm run dev
npm run check:context
npm run quality
npm run test:e2e:smoke
```

不得提交真实 Secret。

## 文档

- 冻结基线：`docs/40-v15-final-development-baseline.md`
- 索引：`docs/README.md`
- 当前契约：`tasks/V15-CTRL-001.md`
- 发布 ADR：`docs/adr/ADR-026-v15-release-scope-r1.md`
