# 路线图（派生摘要）

updatedAt: 2026-08-11

> 完整 canonical 依赖和 Task Selection Policy 见 `PLANS.md` v2.1.1。

```text
V15-CTRL-001（DONE_INTEGRATION）
→ PR6a（DONE_INTEGRATION；PR #11）
→ AI-DECISION-001（DONE_LOCAL；ADR-027 Accepted；未提交/未推送/未建 PR）
→ PR2（BLOCKED，等待 AI-DECISION-001 DONE_INTEGRATION）→ PR5 / PR6 / PR9
→ PR18 → PR19 → PR20（H7 human validation + merge gate）
→ REL-01（可提前设计，不建资源）
→ R1 Quality Gate → REL-02 → REL-03 → REL-04
→ REL-05（3→5→约10人，至少7个有效日历日）
→ REL-06（integration RC→main PR→main/tag→Production）
```

- R1.1：PR3→PR16→PR17（H6/H8，只阻塞 Push）；
- R2：PR4、PR7/8/13、PR14/15、PR21；
- R3：PR10/11/12、PR22/23。

当前已停在 AI-DECISION-001 `DONE_LOCAL`，唯一 next 指针仍为 AI-DECISION-001。PR2 不得提前
标为 IN_PROGRESS；本任务达到 `DONE_INTEGRATION` 并重新核验实时依赖后，下一 canonical 任务为 PR2。
