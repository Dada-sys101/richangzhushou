# 路线图（派生摘要）

updatedAt: 2026-08-10

> 完整 canonical 依赖和 Task Selection Policy 见 `PLANS.md` v2.1.1。

```text
V15-CTRL-001
→ PR6a
→ AI-DECISION-001 / PR2 / PR5 / PR6 / PR9
→ PR18 → PR19 → PR20（H7 human validation + merge gate）
→ REL-01（可提前设计，不建资源）
→ R1 Quality Gate → REL-02 → REL-03 → REL-04
→ REL-05（3→5→约10人，至少7个有效日历日）
→ REL-06（integration RC→main PR→main/tag→Production）
```

- R1.1：PR3→PR16→PR17（H6/H8，只阻塞 Push）；
- R2：PR4、PR7/8/13、PR14/15、PR21；
- R3：PR10/11/12、PR22/23。

当前不得开始 PR6a；多个 READY 任务不得自动并行。
