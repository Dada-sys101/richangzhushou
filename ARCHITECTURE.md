# Architecture

版本：0.1  
状态：设计建议  
更新：2026-08-04

## 总体结构

- `apps/web`：Vue 3 响应式 PWA 用户端。
- `apps/admin`：Vue 3 + Element Plus 管理端。
- `apps/api`：NestJS 单体 API 与提醒调度。
- `packages/api-contracts`：OpenAPI、共享 DTO 类型和枚举。
- `packages/config`：共享 TypeScript、Lint 和构建配置。
- MySQL：业务数据和同步元数据。
- 对象存储：截图、小票和附件。
- 外部适配：OCR、AI、邮件和通知。

## 核心边界

- Web、管理端和快捷指令只通过版本化 API 访问数据。
- 数据访问层必须强制附带用户范围；管理接口与用户接口分离。
- 同步采用服务端版本号、客户端变更 ID 和幂等写入，不采用复杂事件平台。
- 提醒先由数据库计划任务驱动；规模增长前不引入队列。

详细设计见 `docs/07-technical-architecture-and-security.md`。
