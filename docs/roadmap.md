# 路线图（派生摘要）

updatedAt: 2026-09-11

> 完整 canonical 依赖、当前有效规则和 Task Selection Policy 仍以 `PLANS.md` v2.1.1 为准。
> ADR-028 已 Accepted；本页同步其有限 PR20 历史边界，不替代 canonical 规范。

当前移动端顺序：`R1.1 Web Push Candidate（DONE_INTEGRATION）→ MOBILE-A（VERIFYING）→ MOBILE-B → MOBILE-C`。MOBILE-A 自动化验收已通过，真实 iPhone/Android 返回手势仍待确认。

```text
V15-CTRL-001 → PR6a → AI-DECISION-001 → PR2 → PR5 → PR6 → PR9
→ PR18（DONE_INTEGRATION）→ PR19（DONE_INTEGRATION）
→ PR20 Adapter Integration（DONE_INTEGRATION）
→ PR20 Live Provider Validation（DONE_LOCAL / H7_CLOSED）
→ R1 Quality Gate（APPROVED / DONE）→ REL-02（SEPARATE_STAGING_WAIVED）→ REL-03（现有私有预览）→ REL-04
→ REL-05 → REL-06
```

- 当前 Gate：`REL-03 PRIVATE PREVIEW READINESS（READY；H7 CLOSED）`；Integration `6515b8f` 已部署并通过业务 smoke。真实 iPhone 为 `WAIVED_FOR_R1 / UNVERIFIED`，独立 Staging 已豁免。
- Prisma 7.9.1 + 精确 overrides + npm 11.18.0 已提交、合并、通过 CI 和目标 Linux 供应链验证并完成私有预览部署；依赖与许可证不再是当前阻塞项。
- 私有预览已完成发布包、服务、健康、数据库、备份、恢复及新候选部署复核；真实业务 smoke、readiness、公网 HTTPS/CORS 和域名审批后的入口复验仍是后续门禁。
- R1 阻塞期间按 PLANS.md 允许的提前路径形成并完成批准记录的 `REL-01` 设计稿见 `docs/47-rel-01-staging-architecture-decision.md`；D1-D8 已批准，但不代表资源创建或部署授权。
- `REL-01-DECISION-RECORD-01` 的 D1-D8 和原 REL-02 清单保留为未来参考。用户已决定省略独立 Staging，REL-02 为 `CANCELLED / SEPARATE_STAGING_WAIVED`；当前以现有 Alibaba 私有预览执行轻量 REL-03 readiness 与发布流程收口。
- H7 已由 Dada 于 2026-09-01 明确关闭；本机一次性合成数据验证、当前阶段 Provider/条款/结果和 ADR-029 策略均已接受。
  生产 Provider 使用、真实用户/生产数据评测、Provider enablement、REL-04 和生产发布仍需独立授权。
- 已生效两阶段语义：adapter integration 与 live Provider validation 分开记录；提示词补强后的可重复
  `h7-adr027-fixed-v1` 全量评估已形成脱敏证据并达到 provisional schema/effect 目标，`case-146` 另行 3/3 复测通过；
  Dada 已确认当前阶段暂定 DeepSeek、接受条款和评估结果，并接受 ADR-029 的自然月/暂不设固定金额上限临时策略；
  H7 人工关闭前仍不得启用 Provider 或推进 R1。
- PR20-03A/#22、PR20-03B/#23 deviation 均 `KEEP_AND_RECONCILE`；canonical R3 PR22/PR23
  仍为 Shrink 任务，未修改。
- R1.1：PR3→PR16→PR17（H6/H8，只阻塞 Push）；R2：PR4、PR7/8/13、PR14/15、PR21；
  R3：PR10/11/12、canonical PR22/PR23。

Integration HEAD（2026-08-29 只读重核）：`299b1f71debbd5a3140d1ee19f9781372e67134b`；最新 CI run `33043413216` 的
`quality`、`db-validation`、`browser-qa` SUCCESS，但 browser report upload 被跳过。
